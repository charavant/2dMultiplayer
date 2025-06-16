const assert = require('node:assert');
const { test } = require('node:test');

const { upgradeMax, TOTAL_UPGRADE_LEVELS, upgradeBreakdown } = require('../src/models/upgradeConfig');

test('TOTAL_UPGRADE_LEVELS is sum of upgradeMax values', () => {
  const sum = Object.values(upgradeMax).reduce((a, b) => a + b, 0);
  assert.strictEqual(TOTAL_UPGRADE_LEVELS, sum);
});

test('upgradeBreakdown mentions each upgrade', () => {
  const labels = ['Damage', 'Diagonal', 'Shield', 'More Bullets', 'Bullet Speed', 'Health'];
  labels.forEach(label => {
    assert.ok(upgradeBreakdown.includes(label));
  });
});
