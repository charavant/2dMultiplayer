// src/controllers/gameController.js
module.exports = (app) => {
  app.get('/', (req, res) => {
    // Render the "game" view (game.ejs) and pass the joinURL variable.
    res.render('game', { joinURL: app.locals.joinURL });
  });
};
