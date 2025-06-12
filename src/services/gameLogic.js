// src/services/gameLogic.js
const gameState = require('../models/gameState');
let gameLoopInterval;

function startGameLoop(io) {
  gameLoopInterval = setInterval(() => {
    const now = Date.now();
    
    // End game if duration expires
    if (gameState.gameStarted && now - gameState.gameStartTime >= gameState.gameDuration) {
      gameState.gameStarted = false;
    }
    
    // Update each player's position and stats
    Object.values(gameState.players).forEach(player => {
      const rad = player.angle * Math.PI / 180;
      player.x += Math.cos(rad) * (player.speed || 3);
      player.y += Math.sin(rad) * (player.speed || 3);
      
      // Boundary checks (assuming canvasWidth and canvasHeight are set)
      if (player.team === 'left') {
        if (player.x < player.radius) player.x = player.radius;
        if (player.x > gameState.canvasWidth / 2 - player.radius) player.x = gameState.canvasWidth / 2 - player.radius;
      } else {
        if (player.x < gameState.canvasWidth / 2 + player.radius) player.x = gameState.canvasWidth / 2 + player.radius;
        if (player.x > gameState.canvasWidth - player.radius) player.x = gameState.canvasWidth - player.radius;
      }
      if (player.y < player.radius) player.y = player.radius;
      if (player.y > gameState.canvasHeight - player.radius) player.y = gameState.canvasHeight - player.radius;
      
      // Leveling and auto-fire
      if (gameState.gameStarted) {
        player.exp += 0.5 / 60;
      }
      if (player.exp >= 10) {
        const cap = player.maxLevel || gameState.levelCap || Infinity;
        if (player.level < cap) {
          player.exp -= 10;
          player.level++;
          player.upgradePoints++;
          if (player.shieldMax > 0) player.shield = player.shieldMax;
        } else {
          player.exp = 10;
        }
      }
      
      if (gameState.gameStarted && now - player.lastShotTime >= player.bulletCooldown) {
        fireBullets(player);
        player.lastShotTime = now;
      }
    });
    
    // Update bullets and collision detection
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
      const bullet = gameState.bullets[i];
      bullet.x += bullet.speedX;
      bullet.y += bullet.speedY;
      
      if (bullet.bounce && (bullet.y - bullet.radius < 0 || bullet.y + bullet.radius > gameState.canvasHeight)) {
        bullet.speedY = -bullet.speedY;
      }
      
      if (bullet.x < -50 || bullet.x > gameState.canvasWidth + 50 ||
          bullet.y < -50 || bullet.y > gameState.canvasHeight + 50) {
        gameState.bullets.splice(i, 1);
        continue;
      }
      
      for (const pid in gameState.players) {
        const player = gameState.players[pid];
        if (player.team !== bullet.team) {
          const dx = bullet.x - player.x;
          const dy = bullet.y - player.y;
          if (Math.sqrt(dx * dx + dy * dy) < bullet.radius + player.radius) {
            if (player.shield > 0) {
              player.shield--;
            } else {
              player.lives -= bullet.damage;
            }
            const shooter = gameState.players[bullet.shooterId];
            if (shooter) shooter.exp += 2;
            if (player.lives <= 0) {
              if (shooter) shooter.exp += 5;
              if (shooter) {
                if (shooter.team === 'left') gameState.scoreBlue++;
                else gameState.scoreRed++;
              }
              spawnPlayer(player);
            }
            gameState.bullets.splice(i, 1);
            break;
          }
        }
      }
    }
    
    // Emit updated game state to all clients
    io.emit('gameState', {
      players: gameState.players,
      bullets: gameState.bullets,
      scoreBlue: gameState.scoreBlue,
      scoreRed: gameState.scoreRed,
      gameTimer: gameState.gameStarted ? Math.max(0, Math.floor((gameState.gameDuration - (now - gameState.gameStartTime)) / 1000)) : 0,
      gameOver: !gameState.gameStarted && gameState.gameStartTime && now - gameState.gameStartTime >= gameState.gameDuration
    });
  }, 1000 / 60);
}

function fireBullets(player) {
  const count = 1 + (player.upgrades && player.upgrades.moreBullets ? player.upgrades.moreBullets : 0);
  let angles = [];
  if (count > 1) {
    const spread = 10;
    for (let i = 0; i < count; i++) {
      const offset = -spread / 2 + (spread / (count - 1)) * i;
      angles.push(offset);
    }
  } else {
    angles.push(0);
  }
  const base = (player.team === 'left') ? 0 : 180;
  angles.forEach(angle => {
    createBulletWithAngle(player, base + angle);
  });
  if (player.diagonalBullets) {
    createBulletWithAngle(player, (player.team === 'left') ? 30 : 150);
    createBulletWithAngle(player, (player.team === 'left') ? -30 : 210);
    if (player.diagonalBounce) {
      const len = gameState.bullets.length;
      if (len >= 2) {
        gameState.bullets[len - 1].bounce = true;
        gameState.bullets[len - 2].bounce = true;
      }
    }
  }
}

function createBulletWithAngle(player, angle) {
  const bulletSpeed = player.bulletSpeed;
  const rad = angle * Math.PI / 180;
  gameState.bullets.push({
    x: player.x,
    y: player.y,
    radius: 5 + (player.bulletDamage - 1) * 2,
    team: player.team,
    color: '#fff',
    speedX: bulletSpeed * Math.cos(rad),
    speedY: bulletSpeed * Math.sin(rad),
    damage: player.bulletDamage,
    shooterId: player.id,
    bounce: false
  });
}

function spawnPlayer(player) {
  // Reset player's lives and position based on team
  player.lives = 3;
  player.x = player.team === 'left'
    ? 100
    : gameState.canvasWidth - 100;
  player.y = gameState.canvasHeight / 2;
  player.lastShotTime = Date.now();
  if (player.shieldMax > 0) {
    player.shield = player.shieldMax;
    player.lastShieldRepair = Date.now();
  }
  player.maxLevel = gameState.levelCap;
}

function stopGameLoop() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    console.log('Game loop stopped.');
  }
}

module.exports = { startGameLoop, stopGameLoop, spawnPlayer };
