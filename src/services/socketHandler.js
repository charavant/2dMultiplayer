// src/services/socketHandler.js
const gameState = require('../models/gameState');
const { spawnPlayer } = require('./gameLogic');
const { TOTAL_UPGRADE_LEVELS, MAX_LEVEL_CAP } = require('../models/upgradeConfig');

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
      spawnPlayer(gameState.players[socket.id]);
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
        gameState.gameStarted = true;
        gameState.gameStartTime = Date.now();
        Object.values(gameState.players).forEach(spawnPlayer);
      }
    });

    socket.on('updateAngle', (angleDeg) => {
      if (gameState.players[socket.id]) {
        gameState.players[socket.id].angle = angleDeg;
      }
    });

    socket.on('upgrade', (option) => {
      const p = gameState.players[socket.id];
      if (!p || p.upgradePoints <= 0) return;
      switch(option) {
        case 'moreDamage':
          if (!p.upgrades.moreDamage) p.upgrades.moreDamage = 0;
          if (p.upgrades.moreDamage < 2) {
            p.bulletDamage++;
            p.upgrades.moreDamage++;
          }
          break;
        case 'diagonalBullets':
          if (!p.upgrades.diagonalBullets) p.upgrades.diagonalBullets = 0;
          if (p.upgrades.diagonalBullets < 2) {
            p.upgrades.diagonalBullets++;
            if (p.upgrades.diagonalBullets === 1) p.diagonalBullets = true;
            else if (p.upgrades.diagonalBullets === 2) p.diagonalBounce = true;
          }
          break;
        case 'shield':
          if (!p.upgrades.shield) p.upgrades.shield = 0;
          if (p.upgrades.shield < 3) {
            p.shieldMax++;
            p.shield = p.shieldMax;
            p.upgrades.shield++;
          }
          break;
        case 'moreBullets':
          if (!p.upgrades.moreBullets) p.upgrades.moreBullets = 0;
          if (p.upgrades.moreBullets < 4) {
            p.upgrades.moreBullets++;
          }
          break;
        case 'bulletSpeed':
          if (!p.upgrades.bulletSpeed) p.upgrades.bulletSpeed = 0;
          if (p.upgrades.bulletSpeed < 3) {
            p.bulletSpeed++;
            p.upgrades.bulletSpeed++;
          }
          break;
      }
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
