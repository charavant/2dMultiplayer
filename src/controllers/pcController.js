// src/controllers/pcController.js
module.exports = (app) => {
  app.get('/space-battle/pc', (req, res) => {
    res.render('pc');
  });

  app.get('/game2/pc', (req, res) => {
    res.render('game2/pc');
  });

  app.get('/game3/pc', (req, res) => {
    res.render('game3/pc');
  });

  app.get('/game4/pc', (req, res) => {
    res.render('game4/pc');
  });
};
