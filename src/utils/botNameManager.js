const names = require('../data/botNames.json');
const used = new Set();

function getRandomName() {
  const available = names.filter(n => !used.has(n));
  if (available.length === 0) return null;
  const name = available[Math.floor(Math.random() * available.length)];
  used.add(name);
  return name;
}

function releaseName(name) {
  used.delete(name);
}

module.exports = { getRandomName, releaseName };

