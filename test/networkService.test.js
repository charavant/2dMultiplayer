const assert = require('node:assert');
const { test } = require('node:test');

const { getLocalIp } = require('../src/services/networkService');

test('getLocalIp returns a string', () => {
  const ip = getLocalIp();
  assert.strictEqual(typeof ip, 'string');
  assert.ok(ip.length > 0);
});
