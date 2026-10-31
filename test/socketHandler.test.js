const assert = require('node:assert');
const { test, before, after } = require('node:test');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const ioClient = require('socket.io-client');

let SERVER_URL;

let serverProcess;

before(async () => {
  const portFinder = net.createServer();
  await new Promise(resolve => portFinder.listen(0, '127.0.0.1', resolve));
  const port = portFinder.address().port;
  await new Promise(resolve => portFinder.close(resolve));
  SERVER_URL = `http://127.0.0.1:${port}`;
  // Start the server in a child process
  const serverPath = path.join(__dirname, '..', 'server.js');
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: `${port}`, NODE_ENV: 'test' },
    stdio: 'ignore'
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`${SERVER_URL}/healthz`);
      if (response.ok) return;
    } catch {}
    if (serverProcess.exitCode !== null) throw new Error('Game server exited during startup');
    await new Promise(res => setTimeout(res, 100));
  }
  throw new Error('Game server did not become ready');
});

after(async () => {
  // Tell server to shutdown gracefully
  try {
    await fetch(`${SERVER_URL}/exit`, { method: 'POST' });
  } catch {}
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
});

test('joinWithName initializes player and returns playerInfo', async (t) => {
  const socket = ioClient(SERVER_URL, { transports: ['websocket'] });
  await new Promise((res) => socket.on('connect', res));

  const playerInfo = await new Promise((res) => {
    socket.once('playerInfo', (p) => res(p));
    socket.emit('joinWithName', { name: 'Tester', device: 'mobile', skin: 'spaceship-blue.png' });
  });

  assert.strictEqual(playerInfo.name, 'Tester');
  assert.ok(playerInfo.id);
  assert.ok(playerInfo.team === 'left' || playerInfo.team === 'right');
  assert.strictEqual(playerInfo.skin, 'spaceship-blue.png');

  socket.disconnect();
});

test('updateAngle sets moveAngle and clearing works with null', async (t) => {
  const socket = ioClient(SERVER_URL, { transports: ['websocket'] });
  await new Promise((res) => socket.on('connect', res));

  await new Promise((res) => {
    socket.once('playerInfo', () => res());
    socket.emit('joinWithName', { name: 'Mover', device: 'mobile' });
  });

  // Send an angle and then clear it
  socket.emit('updateAngle', 45);
  await new Promise(res => setTimeout(res, 50));
  socket.emit('updateAngle', null);
  await new Promise(res => setTimeout(res, 50));

  // Request a gameState and ensure our player exists
  const gameState = await new Promise((res) => {
    socket.once('gameState', (gs) => res(gs));
    socket.emit('setBots', { enable: false }); // triggers a gameState broadcast
  });

  const me = gameState.players[socket.id];
  assert.ok(me);
  assert.strictEqual(me.moveAngle, undefined);

  socket.disconnect();
});

function waitFor(socket, event, accept = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 5000);
    function handler(value) {
      if (!accept(value)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(value);
    }
    socket.on(event, handler);
  });
}

async function connect(t, role) {
  const socket = ioClient(SERVER_URL, { transports: ['websocket'], auth: { role } });
  t.after(() => socket.disconnect());
  await waitFor(socket, 'connect');
  return socket;
}

async function join(socket, deviceId) {
  const info = waitFor(socket, 'playerInfo');
  socket.emit('joinWithName', { name: 'Pilot', device: 'mobile', deviceId });
  return info;
}

test('connected players stay in the match without custom heartbeat replies', { timeout: 8000 }, async t => {
  const socket = await connect(t, 'controller');
  await join(socket, 'heartbeat-regression');
  await new Promise(resolve => setTimeout(resolve, 3200));
  const state = await waitFor(socket, 'gameState');
  assert.ok(state.players[socket.id], 'Socket.IO is connected; the player must remain active');
  assert.ok(!state.disconnectedPlayers[socket.id]);
});

test('mobile controllers receive no bullets while displays receive compact bullets', async t => {
  const display = await connect(t);
  const mobile = await connect(t, 'controller');
  await join(mobile, 'payload-regression');
  t.after(() => {
    display.emit('setBots', { enable: false });
    display.emit('restartGame');
  });
  display.emit('setBots', { enable: true, count: 8 });
  display.emit('startGame');
  const state = await waitFor(display, 'gameState', state => state.bullets.length > 0);
  assert.deepStrictEqual(Object.keys(state.bullets[0]).sort(), ['radius', 'team', 'x', 'y']);
  const controllerState = await waitFor(mobile, 'gameState', state => state.gameStarted);
  assert.deepStrictEqual(controllerState.bullets, []);
  assert.ok(controllerState.players[mobile.id]);
  display.emit('setBots', { enable: false });
  display.emit('restartGame');
  await waitFor(display, 'gameState', state => !state.gameStarted && Object.keys(state.players).length === 1);
});

test('rejoining preserves identity and resumes only an automatically paused match', async t => {
  const display = await connect(t);
  let mobile = await connect(t, 'controller');
  const original = await join(mobile, 'reconnect-regression');
  display.emit('restartGame');
  display.emit('startGame');
  await waitFor(display, 'gameState', state => state.gameStarted);
  mobile.disconnect();
  await waitFor(display, 'gameState', state => state.gamePaused);
  mobile = await connect(t, 'controller');
  const restored = await join(mobile, 'reconnect-regression');
  assert.strictEqual(restored.id, original.id);
  assert.strictEqual(restored.team, original.team);
  await waitFor(display, 'gameState', state => state.gameStarted && !state.gamePaused);
  display.emit('pauseGame');
  await waitFor(display, 'gameState', state => state.gamePaused);
  mobile.disconnect();
  await waitFor(display, 'gameState', state => Object.keys(state.players).length === 0);
  mobile = await connect(t, 'controller');
  await join(mobile, 'reconnect-regression');
  const paused = await waitFor(display, 'gameState', state => !!state.players[mobile.id]);
  assert.ok(paused.gamePaused, 'A deliberate pause must survive reconnecting');
  display.emit('restartGame');
});


