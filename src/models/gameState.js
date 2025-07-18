// src/models/gameState.js
module.exports = {
    players: {},       // Store active players keyed by socket id
    disconnectedPlayers: {}, // Keep scores for those who left
    bullets: [],       // Array of bullet objects
    scoreBlue: 0,
    scoreRed: 0,
    mode: 'classic',
    pointAreas: { left: [], right: [] },
    controlPointDuration: 30000,
    controlPointRadius: 40,
    gameStarted: false,
    gameStartTime: null,
    gamePaused: false,
    gameActive: false,
    pauseTime: null,
    forceGameOver: false,
    gameDuration: 2 * 60 * 1000,  // default 2 minutes in ms
    maxRounds: 5,
    currentRound: 0,
    levelCap: 1,
    canvasWidth: 800,
    canvasHeight: 600
    // Additional state properties can be added as needed
  };

