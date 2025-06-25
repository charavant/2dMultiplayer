// src/models/gameState.js
module.exports = {
    players: {},       // Store players keyed by socket id
    bullets: [],       // Array of bullet objects
    scoreBlue: 0,
    scoreRed: 0,
    mode: 'classic',
    pointAreas: { left: null, right: null },
    gameStarted: false,
    gameStartTime: null,
    gamePaused: false,
    pauseTime: null,
    forceGameOver: false,
    gameDuration: 2 * 60 * 1000,  // default 2 minutes in ms
    levelCap: 1,
    canvasWidth: 800,
    canvasHeight: 600
    // Additional state properties can be added as needed
  };

