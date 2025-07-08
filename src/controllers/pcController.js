// src/controllers/pcController.js
const gameState = require('../models/gameState');

module.exports = (app) => {
  app.get('/pc', (req, res) => {
    res.render('pc', { teamNames: gameState.teamNames });
  });
};
