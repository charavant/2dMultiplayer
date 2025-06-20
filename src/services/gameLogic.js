// src/services/gameLogic.js
const gameState = require('../models/gameState');
let gameLoopInterval;
let ioInstance;

function startGameLoop(io) {
  ioInstance = io;
  gameLoopInterval = setInterval(() => {
    const now = Date.now();

    if (gameState.gamePaused) {
      const elapsed = gameState.pauseTime - (gameState.gameStartTime || gameState.pauseTime);
      io.emit('gameState', {
        players: gameState.players,
        bullets: gameState.bullets,
        scoreBlue: gameState.scoreBlue,
        scoreRed: gameState.scoreRed,
        gameTimer: Math.max(0, Math.floor((gameState.gameDuration - elapsed) / 1000)),
        gameDuration: Math.floor(gameState.gameDuration / 1000),
        gameOver: false,
        gamePaused: true,
        gameStarted: gameState.gameStarted
      });
      return;
    }
    
    // End game if duration expires
    if (gameState.gameStarted && now - gameState.gameStartTime >= gameState.gameDuration) {
      gameState.gameStarted = false;
    }
    
    // Update each player's position and stats
    Object.values(gameState.players).forEach(player => {
      if (!gameState.gameStarted && player.isBot) {
        if (!player.nextChange || now > player.nextChange) {
          player.angle = Math.random() * 360;
          player.nextChange = now + 1000 + Math.random() * 2000;
        }
      }
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
          if (ioInstance) {
            ioInstance.to(player.id).emit('levelUp', player.level);
          }
          player.maxLives = (player.maxLives || 3) + 2;
          player.lives = Math.min(player.maxLives, (player.lives || player.maxLives) + 2);
          if (player.shieldMax > 0) player.shield = player.shieldMax;
        } else {
          player.exp = 10;
        }
      }

      if (player.regenRate) {
        player.lives = Math.min(player.maxLives, player.lives + player.regenRate / 60);
      }

      if (player.shieldMax > 0 && player.shield < player.shieldMax) {
        if (!player.lastShieldRepair) player.lastShieldRepair = now;
        if (now - player.lastShieldRepair >= 1000) {
          player.shield++;
          player.lastShieldRepair = now;
        }
      }

      if ((gameState.gameStarted || player.isBot) &&
          now - player.lastShotTime >= player.bulletCooldown) {
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
              player.lastShieldRepair = now;
            } else {
              player.lives -= bullet.damage;
            }
            const shooter = gameState.players[bullet.shooterId];
            if (shooter) shooter.exp += 2;
            if (player.lives <= 0) {
              if (player.lastDamagedBy &&
                  player.lastDamagedBy !== bullet.shooterId &&
                  gameState.players[player.lastDamagedBy]) {
                const assister = gameState.players[player.lastDamagedBy];
                assister.assists = (assister.assists || 0) + 1;
              }
              if (shooter) {
                shooter.exp += 5;
                shooter.kills = (shooter.kills || 0) + 1;
              }
              player.deaths = (player.deaths || 0) + 1;
              if (gameState.gameStarted && shooter) {
                if (shooter.team === 'left') gameState.scoreBlue++;
                else gameState.scoreRed++;
              }
              player.lastDamagedBy = null;
              spawnPlayer(player);
            } else {
              player.lastDamagedBy = bullet.shooterId;
            }
            gameState.bullets.splice(i, 1);
            break;
          }
        }
      }
    }
    
    // Emit updated game state to all clients
    const elapsed = gameState.gameStartTime ? (now - gameState.gameStartTime) : 0;
    io.emit('gameState', {
      players: gameState.players,
      bullets: gameState.bullets,
      scoreBlue: gameState.scoreBlue,
      scoreRed: gameState.scoreRed,
      gameTimer: gameState.gameStarted
        ? Math.max(0, Math.floor((gameState.gameDuration - elapsed) / 1000))
        : 0,
      gameDuration: Math.floor(gameState.gameDuration / 1000),
      gamePaused: false,
      gameOver:
        !gameState.gameStarted &&
        gameState.gameStartTime &&
        elapsed >= gameState.gameDuration
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

  const diagLevel = player.upgrades && player.upgrades.diagonalBullets ? player.upgrades.diagonalBullets : 0;
  if (diagLevel > 0) {
    const diagAngles = [30,45,60];
    for (let i=0; i<Math.min(diagLevel, diagAngles.length); i++) {
      createBulletWithAngle(player, (player.team === 'left') ? diagAngles[i] : 180 - diagAngles[i], diagLevel >=3);
      createBulletWithAngle(player, (player.team === 'left') ? -diagAngles[i] : 180 + diagAngles[i], diagLevel >=3);
    }
  }
}

function createBulletWithAngle(player, angle, bounce=false) {
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
    bounce
  });
}

function spawnPlayer(player) {
  // Reset player's lives and position based on team
  if (!player.maxLives) player.maxLives = 3;
  player.lives = player.maxLives;
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

function createBot(team, id) {
  const bot = {
    id,
    name: 'Bot',
    team,
    isBot: true,
    level: 1,
    exp: 0,
    lives: 3,
    maxLives: 3,
    regenRate: 0,
    bulletDamage: 1,
    bulletCooldown: 1000,
    bulletSpeed: 8,
    upgradePoints: 0,
    angle: Math.random() * 360,
    speed: 3,
    radius: 20,
    shield: 0,
    shieldMax: 0,
    upgrades: {},
    lastShotTime: Date.now(),
    kills: 0,
    deaths: 0,
    assists: 0,
    lastDamagedBy: null
  };
  gameState.players[id] = bot;
  spawnPlayer(bot);
}

function createDemoBots() {
  for (let i = 0; i < 5; i++) {
    createBot('left', `botL_${i}`);
    createBot('right', `botR_${i}`);
  }
}

function stopGameLoop() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    console.log('Game loop stopped.');
  }
}

module.exports = {
  startGameLoop,
  stopGameLoop,
  spawnPlayer,
  createDemoBots
};
