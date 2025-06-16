// src/services/socketHandler.js
const gameState = require('../models/gameState');
const { spawnPlayer } = require('./gameLogic');
const { TOTAL_UPGRADE_LEVELS, MAX_LEVEL_CAP, upgradeMax } = require('../models/upgradeConfig');

function computeLevelCap(minutes) {
  const ratio = Math.min(minutes, 10) / 10;
  const cap = Math.floor(TOTAL_UPGRADE_LEVELS * 0.75 * Math.pow(ratio, 0.7)) + 1;
  return Math.min(cap, MAX_LEVEL_CAP);
}

// set initial level cap based on default duration
gameState.levelCap = computeLevelCap(gameState.gameDuration / 60000);

const TEAM_COLORS = {
  left: { fill: '#007BFF', border: '#0056b3' },
  right: { fill: '#FF4136', border: '#d62d20' }
};

function assignTeam() {
  let left = 0, right = 0;
  Object.values(gameState.players).forEach(p => {
    if (p.team === 'left') left++; else if (p.team === 'right') right++;
  });
  return left <= right ? 'left' : 'right';
}

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Handle joinWithName event from mobile controller (pre-game)
    socket.on('joinWithName', (name) => {
      console.log(`Player ${socket.id} joined with name: ${name}`);
      const team = assignTeam();
      // Initialize player object
      gameState.players[socket.id] = {
        id: socket.id,
        name,
        team,
        level: 1,
        exp: 0,
        lives: 3,
        maxLives: 3,
        regenRate: 0,
        bulletDamage: 1,
        bulletCooldown: 1000,
        bulletSpeed: 8,
        upgradePoints: 0,
        angle: 0,
        speed: 3,
        radius: 20,
        fillColor: TEAM_COLORS[team].fill,
        borderColor: TEAM_COLORS[team].border,
        shield: 0,
        shieldMax: 0,
        upgrades: {},
        lastShotTime: Date.now()
      };
      gameState.players[socket.id].maxLevel = gameState.levelCap;
      // Spawn the player immediately only if the game has already started
      if (gameState.gameStarted) {
        spawnPlayer(gameState.players[socket.id]);
      }
      socket.emit('playerInfo', gameState.players[socket.id]);
    });

    socket.on('canvasDimensions', (dims) => {
      gameState.canvasWidth = dims.width;
      gameState.canvasHeight = dims.height;
    });

    socket.on('setGameTime', (minutes) => {
      const m = parseFloat(minutes);
      if (!isNaN(m) && m > 0) {
        const clamped = Math.min(m, 10);
        gameState.gameDuration = clamped * 60 * 1000;
        gameState.levelCap = computeLevelCap(clamped);
        Object.values(gameState.players).forEach(p => p.maxLevel = gameState.levelCap);
      }
    });

    socket.on('setMaxLevels', (levels) => {
      const l = parseInt(levels);
      if (!isNaN(l) && l > 0) {
        const clamped = Math.min(l, MAX_LEVEL_CAP);
        gameState.levelCap = clamped;
        Object.values(gameState.players).forEach(p => p.maxLevel = clamped);
      }
    });

    socket.on('startGame', () => {
      if (!gameState.gameStarted) {
        Object.keys(gameState.players).forEach(id => {
          if (gameState.players[id].isBot) delete gameState.players[id];
        });
        gameState.scoreBlue = 0;
        gameState.scoreRed = 0;
        gameState.bullets = [];
        gameState.gameStarted = true;
        gameState.gameStartTime = Date.now();
        Object.values(gameState.players).forEach(spawnPlayer);
      }
    });

    socket.on('pauseGame', () => {
      if (gameState.gameStarted && !gameState.gamePaused) {
        gameState.gamePaused = true;
        gameState.pauseTime = Date.now();
      }
    });

    socket.on('resumeGame', () => {
      if (gameState.gamePaused) {
        gameState.gamePaused = false;
        if (gameState.pauseTime) {
          gameState.gameStartTime += Date.now() - gameState.pauseTime;
          gameState.pauseTime = null;
        }
      }
    });

    socket.on('restartGame', () => {
      gameState.scoreBlue = 0;
      gameState.scoreRed = 0;
      gameState.bullets = [];
      gameState.gameStarted = true;
      gameState.gamePaused = false;
      gameState.gameStartTime = Date.now();
      Object.values(gameState.players).forEach(spawnPlayer);
    });

    socket.on('switchTeam', (playerId) => {
      const p = gameState.players[playerId];
      if (p && !gameState.gameStarted) {
        p.team = p.team === 'left' ? 'right' : 'left';
        // Do not spawn until the game actually starts
      }
    });

    socket.on('updateAngle', (angleDeg) => {
      if (gameState.players[socket.id]) {
        gameState.players[socket.id].angle = angleDeg;
      }
    });

    socket.on('upgrade', (option) => {
      const p = gameState.players[socket.id];
      if (!p || p.upgradePoints <= 0 || !upgradeMax[option]) return;
      if (!p.upgrades[option]) p.upgrades[option] = 0;
      if (p.upgrades[option] >= upgradeMax[option]) return;

      switch(option) {
        case 'moreDamage':
          p.bulletDamage++;
          break;
        case 'diagonalBullets':
          // handled in game loop when firing
          break;
        case 'shield':
          p.shieldMax++;
          p.shield = p.shieldMax;
          break;
        case 'moreBullets':
          // just increment level
          break;
        case 'bulletSpeed':
          p.bulletSpeed++;
          break;
        case 'health': {
          const newLvl = (p.upgrades.health || 0) + 1;
          p.maxLives += 10;
          p.lives += 10;
          p.radius *= 1.2;
          p.speed *= 0.9;
          p.regenRate = newLvl;
          break;
        }
      }

      p.upgrades[option]++;
      p.upgradePoints--;
      socket.emit('playerInfo', p);
    });

    socket.on('disconnect', () => {
      console.log(`Player ${socket.id} disconnected.`);
      delete gameState.players[socket.id];
    });
  });
}

module.exports = { initSocket };
