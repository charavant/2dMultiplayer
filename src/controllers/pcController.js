// src/controllers/pcController.js
module.exports = (app) => {
  app.get('/pc', (req, res) => {
    res.render('pc');
  });
};
