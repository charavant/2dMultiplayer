const assert = require('node:assert');
const { test } = require('node:test');
const events = require('events');

const gameState = require('../src/models/gameState');
const { initSocket } = require('../src/services/socketHandler');

function setup() {
  const io = new events.EventEmitter();
  io.to = () => ({ emit: () => {} });
  io.emit = () => {};
  let connectionCb;
  io.on = (ev, cb) => { if (ev === 'connection') connectionCb = cb; };
  initSocket(io);
  const socket = new events.EventEmitter();
  socket.id = 'testsocket';
  connectionCb(socket);
  return socket;
}

test('endGame clears pause state', () => {
  const socket = setup();
  gameState.gamePaused = true;
  gameState.pauseTime = Date.now();
  socket.emit('endGame');
  assert.strictEqual(gameState.gamePaused, false);
  assert.strictEqual(gameState.pauseTime, null);
});
