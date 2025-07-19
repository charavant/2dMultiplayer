const { XP_PASSIVE, XP_PER_HIT, XP_PER_KILL } = require('./constants');

const settings = {
  XP_PASSIVE,
  XP_PER_HIT,
  XP_PER_KILL,
  xpBase: 10,
  xpGrowthExp: 0,
  dmgStepLow: 0.75,
  dmgStepCap: 2,
  dmgStepHi: 1
};

function xpRequired(level) {
  const base = settings.xpBase ?? 10;
  const growth = settings.xpGrowthExp ?? 0;
  return Math.ceil(base * Math.pow(level, growth));
}

module.exports = { settings, xpRequired };
