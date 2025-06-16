const assert = require('node:assert');
const { test } = require('node:test');

const gameState = require('../src/models/gameState');
const { spawnPlayer } = require('../src/services/gameLogic');

test('spawnPlayer positions players based on team', () => {
  const left = { team: 'left', maxLives: 3 };
  spawnPlayer(left);
  assert.strictEqual(left.x, 100);
  assert.strictEqual(left.y, gameState.canvasHeight / 2);
  assert.strictEqual(left.lives, left.maxLives);

  const right = { team: 'right', maxLives: 5 };
  spawnPlayer(right);
  assert.strictEqual(right.x, gameState.canvasWidth - 100);
  assert.strictEqual(right.y, gameState.canvasHeight / 2);
  assert.strictEqual(right.lives, right.maxLives);
});
