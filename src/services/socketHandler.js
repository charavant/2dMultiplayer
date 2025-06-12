// src/services/socketHandler.js
const gameState = require('../models/gameState');
const { spawnPlayer } = require('./gameLogic');

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
        shield: 0,
        shieldMax: 0,
        upgrades: {},
        lastShotTime: Date.now()
      };
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
        gameState.gameDuration = m * 60 * 1000;
      }
    });

    socket.on('startGame', () => {
      if (!gameState.gameStarted) {
        gameState.gameStarted = true;
        gameState.gameStartTime = Date.now();
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
