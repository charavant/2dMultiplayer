// src/controllers/gameController.js
const gameState = require('../models/gameState');
const { TOTAL_UPGRADE_LEVELS, MAX_LEVEL_CAP, upgradeBreakdown } = require('../models/upgradeConfig');

module.exports = (app) => {
  app.get('/', (req, res) => {
    res.render('game', {
      joinURL: app.locals.joinURL,
      totalUpgrades: TOTAL_UPGRADE_LEVELS,
      maxAllowedCap: MAX_LEVEL_CAP,
      defaultCap: gameState.levelCap,
      upgradeBreakdown
    });
  });
};
