// src/controllers/mobileController.js
module.exports = (app) => {
  app.get('/controller', (req, res) => {
    // Render the "mobile" view (mobile.ejs). You can pass additional variables if needed.
    res.render('mobile');
  });
};
