// src/controllers/gameController.js
const gameState = require('../models/gameState');
const { TOTAL_UPGRADE_LEVELS, MAX_LEVEL_CAP, upgradeBreakdown } = require('../models/upgradeConfig');
const { behaviors } = require('../botBehaviors');

module.exports = (app) => {
  function renderGame(res, view, controllerPath) {
    app.locals.joinURL = `${app.locals.baseURL}${controllerPath}`;
    res.render(view, {
      joinURL: app.locals.joinURL,
      totalUpgrades: TOTAL_UPGRADE_LEVELS,
      maxAllowedCap: MAX_LEVEL_CAP,
      defaultCap: gameState.levelCap,
      upgradeBreakdown,
      botBehaviors: Object.keys(behaviors)
    });
  }

  app.get('/space-battle', (req, res) => {
    renderGame(res, 'game', '/space-battle/controller');
  });

  app.get('/game2', (req, res) => {
    renderGame(res, 'game2/game', '/game2/controller');
  });

  app.get('/game3', (req, res) => {
    renderGame(res, 'game3/game', '/game3/controller');
  });

  app.get('/game4', (req, res) => {
    renderGame(res, 'game4/game', '/game4/controller');
  });
};
