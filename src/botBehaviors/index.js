const aggressive = require('./aggressive');
const defensive = require('./defensive');
const aloof = require('./aloof');

const behaviors = { aggressive, defensive, aloof };

function randomBehavior() {
  const keys = Object.keys(behaviors);
  const name = keys[Math.floor(Math.random() * keys.length)];
  return behaviors[name];
}

function getBehavior(name) {
  return behaviors[name];
}

module.exports = {
  behaviors,
  randomBehavior,
  getBehavior
};
