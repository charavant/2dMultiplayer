// src/controllers/mobileController.js
module.exports = (app) => {
  app.get('/space-battle/controller', (req, res) => {
    res.render('mobile');
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
