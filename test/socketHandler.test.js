const assert = require('node:assert');
const { test, before, after } = require('node:test');
const { spawn } = require('node:child_process');
const path = require('node:path');
const ioClient = require('socket.io-client');

const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

let serverProcess;

before(async () => {
  // Start the server in a child process
  const serverPath = path.join(__dirname, '..', 'server.js');
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: `${SERVER_PORT}`, NODE_ENV: 'test' },
    stdio: 'ignore'
  });
  // Give the server a moment to boot
  await new Promise(res => setTimeout(res, 600));
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


