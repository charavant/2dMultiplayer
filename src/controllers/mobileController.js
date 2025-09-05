// src/controllers/mobileController.js
const fs = require('fs');
const path = require('path');

module.exports = (app) => {
  app.get('/space-battle/controller', (req, res) => {
    let playerSkins = [];
    try {
      const skinDir = path.join(__dirname, '../../assets/PlayersSkins');
      playerSkins = fs.readdirSync(skinDir)
        .filter(f => f.toLowerCase().endsWith('.png'));
    } catch (e) {}
    res.render('game1 - Battle/mobile', { playerSkins });
  });

  app.get('/game2/controller', (req, res) => {
    res.render('game2/mobile');
  });

  app.get('/game3/controller', (req, res) => {
    res.render('game3/mobile');
  });

  app.get('/game4/controller', (req, res) => {
    res.render('game4/mobile');
  });
};
