const assert = require('node:assert');
const { test } = require('node:test');

const { randomBehavior, getBehavior } = require('../src/botBehaviors');

const names = ['aggressive', 'defensive', 'aloof'];

test('randomBehavior returns a defined behavior', () => {
  const b = randomBehavior();
  assert.ok(names.includes(b.name));
});

test('getBehavior retrieves by name', () => {
  names.forEach(n => {
    const b = getBehavior(n);
    assert.strictEqual(b.name, n);
  });
});
