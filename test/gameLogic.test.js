const assert = require('node:assert');
const { test } = require('node:test');

const gameState = require('../src/models/gameState');
const { spawnPlayer } = require('../src/services/gameLogic');

test('spawnPlayer positions players based on team', () => {
  const left = { team: 'left', maxLives: 3 };
  spawnPlayer(left);
  assert(left.x >= 50 && left.x <= gameState.canvasWidth / 2 - 50);
  assert(left.y >= 50 && left.y <= gameState.canvasHeight - 50);
  assert.strictEqual(left.lives, left.maxLives);

  const right = { team: 'right', maxLives: 5 };
  spawnPlayer(right);
  assert(right.x >= gameState.canvasWidth / 2 + 50 && right.x <= gameState.canvasWidth - 50);
  assert(right.y >= 50 && right.y <= gameState.canvasHeight - 50);
  assert.strictEqual(right.lives, right.maxLives);
});
