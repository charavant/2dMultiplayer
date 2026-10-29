const gameState = require('../models/gameState');

const CONTROLLER_ROOM = 'controllers';
const lastBroadcasts = new WeakMap();

function snapshot(now = Date.now()) {
  const clock = gameState.gamePaused ? gameState.pauseTime : now;
  const elapsed = gameState.gameStartTime ? clock - gameState.gameStartTime : 0;
  return {
    players: gameState.players,
    disconnectedPlayers: gameState.disconnectedPlayers,
    // Rendering needs only these fields; physics stays on the server.
    bullets: gameState.bullets.map(({ x, y, radius, team }) => ({ x, y, radius, team })),
    scoreBlue: Math.floor(gameState.scoreBlue),
    scoreRed: Math.floor(gameState.scoreRed),
    mode: gameState.mode,
    currentRound: gameState.currentRound,
    maxRounds: gameState.maxRounds,
    pointAreas: gameState.mode === 'control' ? gameState.pointAreas : undefined,
    gameTimer: gameState.gameStarted
      ? Math.max(0, Math.floor((gameState.gameDuration - elapsed) / 1000)) : 0,
    gameDuration: Math.floor(gameState.gameDuration / 1000),
    gamePaused: gameState.gamePaused,
    gameStarted: gameState.gameStarted,
    gameOver: !!(!gameState.gameStarted && gameState.gameStartTime &&
      (elapsed >= gameState.gameDuration || gameState.forceGameOver))
  };
}

function broadcastGameState(io, force = false) {
  const now = Date.now();
  const last = lastBroadcasts.get(io) || { display: -Infinity, controller: -Infinity };
  const displayDue = force || now - last.display >= 1000 / 30;
  const controllerDue = force || now - last.controller >= 100;
  if (!displayDue && !controllerDue) return;
  const state = snapshot(now);
  // A newer snapshot replaces a late one. Never queue old frames behind a slow client.
  if (displayDue) {
    io.except(CONTROLLER_ROOM).volatile.emit('gameState', state);
    last.display = now;
  }
  if (controllerDue) {
    io.to(CONTROLLER_ROOM).volatile.emit('gameState', { ...state, bullets: [] });
    last.controller = now;
  }
  lastBroadcasts.set(io, last);
}

module.exports = { broadcastGameState, CONTROLLER_ROOM };
