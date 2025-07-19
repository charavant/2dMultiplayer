const { settings } = require('../models/settings');

/**
 * Returns the highest whole level reachable after tSec seconds,
 * given an averageXPPerSec, xpBase, and xpGrowthExp.
 */
function maxLevelAtTime(tSec, averageXPPerSec,
                        xpBase = settings.xpBase,
                        alpha  = settings.xpGrowthExp) {
  if (alpha === 0) {                      // flat cost
    return Math.floor((averageXPPerSec * tSec) / xpBase);
  }

  const top = (alpha + 1) * averageXPPerSec * tSec / xpBase;
  return Math.floor(Math.pow(top, 1 / (alpha + 1)));
}

module.exports = { maxLevelAtTime };
