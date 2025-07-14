// src/services/gameLogic.js
const gameState = require('../models/gameState');
let gameLoopInterval;
let ioInstance;
let botCounter = 1;
let lastEmitTime = 0;

function spawnControlPoint(team) {
  const margin = 50;
  const half = gameState.canvasWidth / 2;
  const xMin = team === 'left' ? margin : half + margin;
  const xMax = team === 'left' ? half - margin : gameState.canvasWidth - margin;
  const yMin = margin;
  const yMax = gameState.canvasHeight - margin;
  return {
    x: Math.random() * (xMax - xMin) + xMin,
    y: Math.random() * (yMax - yMin) + yMin,
    radius: 40,
    startTime: Date.now(),
    pointsCollected: 0
  };
}

function startGameLoop(io) {
  ioInstance = io;
  gameLoopInterval = setInterval(() => {
    const now = Date.now();

    if (gameState.gamePaused) {
      const elapsed = gameState.pauseTime - (gameState.gameStartTime || gameState.pauseTime);
      io.emit('gameState', {
        players: gameState.players,
        bullets: gameState.bullets,
        scoreBlue: Math.floor(gameState.scoreBlue),
        scoreRed: Math.floor(gameState.scoreRed),
        mode: gameState.mode,
        currentRound: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        pointAreas: gameState.mode === 'control' ? gameState.pointAreas : undefined,
        gameTimer: Math.max(0, Math.floor((gameState.gameDuration - elapsed) / 1000)),
        gameDuration: Math.floor(gameState.gameDuration / 1000),
        gameOver: false,
        gamePaused: true,
        gameStarted: gameState.gameStarted
      });
      return;
    }

    if (!gameState.gameActive) {
      const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
      io.emit('gameState', {
        players: gameState.players,
        bullets: gameState.bullets,
        scoreBlue: Math.floor(gameState.scoreBlue),
        scoreRed: Math.floor(gameState.scoreRed),
        mode: gameState.mode,
        currentRound: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        pointAreas: gameState.mode === 'control' ? gameState.pointAreas : undefined,
        gameTimer: 0,
        gameDuration: Math.floor(gameState.gameDuration / 1000),
        gamePaused: false,
        gameOver:
          !gameState.gameStarted &&
          gameState.gameStartTime &&
          (elapsed >= gameState.gameDuration || gameState.forceGameOver)
      });
      return;
    }
    
    // End game if duration expires
    if (gameState.gameStarted && now - gameState.gameStartTime >= gameState.gameDuration) {
      gameState.gameStarted = false;
    }
    
    // Update each player's position and stats
    Object.values(gameState.players).forEach(player => {
      if (gameState.mode === 'tdm' && !player.isAlive) return;
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
        if (!player.lastRegen) player.lastRegen = now;
        if (now - player.lastRegen >= 1000) {
          const before = player.lives;
          player.lives = Math.min(player.maxLives, player.lives + player.regenRate);
          const gained = player.lives - before;
          player.lastRegen = now;
          if (ioInstance && gained > 0) {
            ioInstance.emit('regenPopup', {
              x: player.x,
              y: player.y - player.radius,
              amount: gained,
              type: 'health'
            });
          }
        }
      }

      if (player.shieldMax > 0 && player.shield < player.shieldMax) {
        if (!player.lastShieldRepair) player.lastShieldRepair = now;
        if (now - player.lastShieldRepair >= 1000) {
          player.shield++;
          player.lastShieldRepair = now;
          if (ioInstance) {
            ioInstance.emit('regenPopup', {
              x: player.x,
              y: player.y - player.radius,
              amount: 1,
              type: 'shield'
            });
          }
        }
      }

      if (gameState.gameStarted &&
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
        if (gameState.mode === 'tdm' && !player.isAlive) continue;
        if (player.team !== bullet.team) {
        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        const distSq = dx * dx + dy * dy;
        const rad = bullet.radius + player.radius;
        if (distSq < rad * rad) {
            let dmgAmount = bullet.damage;
            if (player.shield > 0) {
              player.shield--;
              player.lastShieldRepair = now;
              dmgAmount = 1; // shields absorb one point
            } else {
              player.lives -= bullet.damage;
            }
            if (ioInstance) {
              ioInstance.emit('damagePopup', {
                x: player.x,
                y: player.y - player.radius,
                amount: dmgAmount
              });
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
              handlePlayerDeath(player, shooter);
            } else {
              player.lastDamagedBy = bullet.shooterId;
            }
            gameState.bullets.splice(i, 1);
            break;
          }
        }
      }
    }

    if (gameState.mode === 'control' && gameState.gameStarted) {
      ['left', 'right'].forEach(team => {
        let area = gameState.pointAreas[team];
        if (!area) {
          gameState.pointAreas[team] = spawnControlPoint(team);
          area = gameState.pointAreas[team];
        }
        const elapsedArea = now - area.startTime;
        let count = 0;
        Object.values(gameState.players).forEach(p => {
          if (p.team === team) {
            const dx = p.x - area.x;
            const dy = p.y - area.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= area.radius * area.radius) count++;
          }
        });
        if (count > 0) {
          const gain = count / 60;
          if (team === 'left') gameState.scoreBlue += gain; else gameState.scoreRed += gain;
          area.pointsCollected += gain;
        }
        if (elapsedArea >= 30000 || area.pointsCollected >= 50) {
          gameState.pointAreas[team] = spawnControlPoint(team);
        }
      });
    }
    
    checkTdmRoundEnd();
    // Emit updated game state to all clients
    const elapsed = gameState.gameStartTime ? (now - gameState.gameStartTime) : 0;
    if (now - lastEmitTime >= 33) {
      io.emit('gameState', {
        players: gameState.players,
        bullets: gameState.bullets,
        scoreBlue: Math.floor(gameState.scoreBlue),
        scoreRed: Math.floor(gameState.scoreRed),
        mode: gameState.mode,
        currentRound: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        pointAreas: gameState.mode === 'control' ? gameState.pointAreas : undefined,
        gameTimer: gameState.gameStarted
          ? Math.max(0, Math.floor((gameState.gameDuration - elapsed) / 1000))
          : 0,
        gameDuration: Math.floor(gameState.gameDuration / 1000),
        gamePaused: false,
        gameOver:
          !gameState.gameStarted &&
          gameState.gameStartTime &&
          (elapsed >= gameState.gameDuration || gameState.forceGameOver)
      });
      lastEmitTime = now;
    }
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
  player.isAlive = true;
}

function handlePlayerDeath(player, shooter) {
  if (player.lastDamagedBy &&
      player.lastDamagedBy !== (shooter && shooter.id) &&
      gameState.players[player.lastDamagedBy]) {
    const assister = gameState.players[player.lastDamagedBy];
    assister.assists = (assister.assists || 0) + 1;
  }
  if (shooter) {
    shooter.exp += 5;
    shooter.kills = (shooter.kills || 0) + 1;
  }
  player.deaths = (player.deaths || 0) + 1;

  if (gameState.gameActive && shooter && gameState.mode === 'classic') {
    if (shooter.team === 'left') gameState.scoreBlue++;
    else gameState.scoreRed++;
  }
  if (ioInstance && shooter && gameState.gameActive) {
    const killerName = shooter.name || shooter.id;
    const victimName = player.name || player.id;
    ioInstance.emit('kill', { killer: killerName, victim: victimName });
  }
  player.lastDamagedBy = null;

  if (gameState.mode === 'tdm') {
    player.isAlive = false;
  } else {
    spawnPlayer(player);
  }
}

function startTdmRound() {
  gameState.bullets = [];
  Object.values(gameState.players).forEach(spawnPlayer);
  gameState.gameStarted = true;
  gameState.gameStartTime = Date.now();
}

function checkTdmRoundEnd() {
  if (gameState.mode !== 'tdm' || !gameState.gameStarted) return;
  const leftAlive = Object.values(gameState.players).some(p => p.team === 'left' && p.isAlive);
  const rightAlive = Object.values(gameState.players).some(p => p.team === 'right' && p.isAlive);
  if (leftAlive && rightAlive) return;
  const winner = leftAlive ? 'left' : 'right';
  if (winner === 'left') gameState.scoreBlue++; else gameState.scoreRed++;
  gameState.currentRound++;
  gameState.gameStarted = false;
  if (gameState.currentRound >= gameState.maxRounds) {
    gameState.forceGameOver = true;
  } else {
    setTimeout(startTdmRound, 3000);
  }
}

function createBot(team) {
  const id = `bot_${botCounter}`;
  const bot = {
    id,
    name: `Bot${botCounter}`,
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
  botCounter++;
}

function createBotsPerTeam(count) {
  for (let i = 0; i < count; i++) {
    createBot('left');
    createBot('right');
  }
}

function removeBots() {
  Object.keys(gameState.players).forEach(id => {
    if (gameState.players[id].isBot) delete gameState.players[id];
  });
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
  createBotsPerTeam,
  removeBots,
  startTdmRound
};
