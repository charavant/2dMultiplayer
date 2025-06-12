// src/services/socketHandler.js
const gameState = require('../models/gameState');

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Handle joinWithName event from mobile controller (pre-game)
    socket.on('joinWithName', (name) => {
      console.log(`Player ${socket.id} joined with name: ${name}`);
      // Initialize player object with all necessary properties
      gameState.players[socket.id] = {
        id: socket.id,
        name: name,
        team: 'left', // You can implement team balancing here if desired
        level: 1,
        exp: 0,
        lives: 3,
        bulletDamage: 1,
        bulletCooldown: 1000,
        bulletSpeed: 8,
        upgradePoints: 0,
        angle: 0,
        // Default starting position (adjust as needed)
        x: 100,
        y: gameState.canvasHeight ? gameState.canvasHeight / 2 : 300,
        shield: 0,
        shieldMax: 0,
        upgrades: {},
        lastShotTime: Date.now()
      };
      socket.emit('playerInfo', gameState.players[socket.id]);
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
