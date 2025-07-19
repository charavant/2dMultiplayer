const assert = require('node:assert');
const { test } = require('node:test');

const { maxLevelAtTime } = require('../src/utils/levelUtils');

// Using flat cost (alpha = 0)
test('maxLevelAtTime flat growth', () => {
  const level = maxLevelAtTime(120, 1, 10, 0); // 120 sec at 1 xp/s, base 10
  assert.strictEqual(level, 12);
});

test('maxLevelAtTime exponential growth', () => {
  const level = maxLevelAtTime(120, 1, 10, 1); // alpha=1
  assert.strictEqual(level, 4); // sqrt(24) -> 4.89 -> floor 4
});
