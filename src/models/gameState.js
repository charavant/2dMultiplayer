// src/models/gameState.js
module.exports = {
    players: {},       // Store players keyed by socket id
    bullets: [],       // Array of bullet objects
    scoreBlue: 0,
    scoreRed: 0,
    gameStarted: false,
    gameStartTime: null,
    gameDuration: 10 * 60 * 200,  // 2 minutes in ms
    canvasWidth: 800,
    canvasHeight: 600
    // Additional state properties can be added as needed
  };
  