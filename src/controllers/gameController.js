// src/controllers/gameController.js
const gameState = require('../models/gameState');
const { TOTAL_UPGRADE_LEVELS, MAX_LEVEL_CAP, upgradeBreakdown } = require('../models/upgradeConfig');
const { behaviors } = require('../botBehaviors');
const fs = require('fs');
const path = require('path');

module.exports = (app) => {
  function renderGame(res, view, controllerPath) {
    app.locals.joinURL = `${app.locals.baseURL}${controllerPath}`;
    let musicTracks = [];
    try {
      const dir = path.join(__dirname, '../../public/music');
      musicTracks = fs.readdirSync(dir).filter(f => /\.(mp3|ogg|wav)$/i.test(f));
    } catch (e) {}
    let playerSkins = [];
    try {
      const skinDir = path.join(__dirname, '../../assets/PlayersSkins');
      playerSkins = fs.readdirSync(skinDir)
        .filter(f => f.toLowerCase().endsWith('.png'));
    } catch (e) {}
    res.render(view, {
      joinURL: app.locals.joinURL,
      totalUpgrades: TOTAL_UPGRADE_LEVELS,
      maxAllowedCap: MAX_LEVEL_CAP,
      defaultCap: gameState.levelCap,
      upgradeBreakdown,
      botBehaviors: Object.keys(behaviors),
      musicTracks,
      settings: require('../models/settings').settings,
      playerSkins
    });
  }

  app.get('/space-battle', (req, res) => {
    renderGame(res, 'game1 - Battle/game', '/space-battle/controller');
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
