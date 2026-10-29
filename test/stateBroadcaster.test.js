const assert = require('node:assert/strict');
const { test } = require('node:test');
const gameState = require('../src/models/gameState');
const { broadcastGameState } = require('../src/services/stateBroadcaster');

test('snapshot traffic is bounded in active, idle and paused states', t => {
  const originalClock = Date.now;
  const originalState = { ...gameState };
  t.after(() => { Date.now = originalClock; Object.assign(gameState, originalState); });
  let now = 1000;
  Date.now = () => now;
  gameState.bullets = Array.from({ length: 1000 }, () => ({ x: 10, y: 20, radius: 5, team: 'left', speedX: 8, damage: 20, shooterId: 'a' }));
  for (const mode of ['active', 'idle', 'paused']) {
    gameState.gameActive = mode === 'active';
    gameState.gamePaused = mode === 'paused';
    const counts = { display: 0, controller: 0 };
    const endpoint = type => ({ volatile: { emit(event, state) {
      assert.equal(event, 'gameState');
      counts[type]++;
      if (type === 'controller') assert.equal(state.bullets.length, 0);
    } } });
    const io = { except: () => endpoint('display'), to: () => endpoint('controller') };
    for (let frame = 0; frame < 60; frame++) {
      broadcastGameState(io);
      now += 1000 / 60;
    }
    assert.ok(counts.display <= 30, `${mode}: ${counts.display} display frames`);
    assert.ok(counts.controller <= 10, `${mode}: ${counts.controller} controller frames`);
  }
});
