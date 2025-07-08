// src/controllers/mobileController.js
const gameState = require('../models/gameState');

module.exports = (app) => {
  app.get('/controller', (req, res) => {
    res.render('mobile', { teamNames: gameState.teamNames });
  });
};
