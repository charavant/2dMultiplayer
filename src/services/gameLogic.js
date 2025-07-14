// src/services/gameLogic.js
const gameState = require('../models/gameState');
const { upgradeMax } = require('../models/upgradeConfig');
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
    radius: gameState.controlPointRadius || 40,
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
      if (gameState.mode === 'tdm') {
        const leftAliveCount = Object.values(gameState.players).filter(p => p.team === 'left' && p.isAlive).length;
        const rightAliveCount = Object.values(gameState.players).filter(p => p.team === 'right' && p.isAlive).length;
        const winner = leftAliveCount === rightAliveCount ? 'draw' : (leftAliveCount > rightAliveCount ? 'left' : 'right');
        endTdmRound(winner);
      } else {
        gameState.gameStarted = false;
      }
    }
    
    // Update each player's position and stats
    Object.values(gameState.players).forEach(player => {
      if (gameState.mode === 'tdm' && !player.isAlive) return;

      if (player.isBot) {
        if (gameState.gameStarted) {
          const enemies = Object.values(gameState.players)
            .filter(p => p.team !== player.team && (gameState.mode !== 'tdm' || p.isAlive));
          if (enemies.length > 0) {
            const target = enemies.reduce((closest, p) => {
              const dx = p.x - player.x;
              const dy = p.y - player.y;
              const distSq = dx * dx + dy * dy;
              if (!closest || distSq < closest.distSq) return { p, distSq };
              return closest;
            }, null).p;
            const aim = Math.atan2(target.y - player.y, target.x - player.x) * 180 / Math.PI;
            player.angle = aim;
            if (!player.nextMoveChange || now > player.nextMoveChange) {
              player.moveAngle = aim + (Math.random() * 120 - 60);
              player.nextMoveChange = now + 800 + Math.random() * 1200;
            }
          }
        } else if (!player.nextMoveChange || now > player.nextMoveChange) {
          player.moveAngle = Math.random() * 360;
          player.nextMoveChange = now + 1000 + Math.random() * 2000;
        }

        // simple bullet avoidance
        for (const b of gameState.bullets) {
          if (b.team === player.team) continue;
          const dx = player.x - b.x;
          const dy = player.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 10000) continue; // >100 px
          const dot = dx * b.speedX + dy * b.speedY;
          if (dot > 0) {
            const avoid = Math.atan2(dy, dx) + Math.PI / 2;
            player.moveAngle = avoid * 180 / Math.PI;
            player.nextMoveChange = now + 300;
            break;
          }
        }
      }

      let moveRad;
      if (player.moveAngle !== undefined) {
        moveRad = player.moveAngle * Math.PI / 180;
      } else if (player.isBot) {
        moveRad = player.angle * Math.PI / 180;
      } else {
        moveRad = null;
      }
      if (moveRad !== null) {
        player.x += Math.cos(moveRad) * (player.speed || 3);
        player.y += Math.sin(moveRad) * (player.speed || 3);
      }
      
      // Boundary checks (assuming canvasWidth and canvasHeight are set)
      let bounced = false;
      if (player.team === 'left') {
        if (player.x < player.radius) { player.x = player.radius; bounced = true; }
        if (player.x > gameState.canvasWidth / 2 - player.radius) { player.x = gameState.canvasWidth / 2 - player.radius; bounced = true; }
      } else {
        if (player.x < gameState.canvasWidth / 2 + player.radius) { player.x = gameState.canvasWidth / 2 + player.radius; bounced = true; }
        if (player.x > gameState.canvasWidth - player.radius) { player.x = gameState.canvasWidth - player.radius; bounced = true; }
      }
      if (player.y < player.radius) { player.y = player.radius; bounced = true; }
      if (player.y > gameState.canvasHeight - player.radius) { player.y = gameState.canvasHeight - player.radius; bounced = true; }
      if (bounced && player.isBot) {
        player.moveAngle = (player.moveAngle + 180) % 360;
        player.nextMoveChange = now + 500;
      }
      
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
          if (player.isBot) {
            player.upgradePoints--;
            applyRandomUpgrade(player);
          }
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
      updateControlPoints(now);
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
  if (gameState.mode === 'tdm') {
    const margin = 50;
    const half = gameState.canvasWidth / 2;
    const xMin = player.team === 'left' ? margin : half + margin;
    const xMax = player.team === 'left' ? half - margin : gameState.canvasWidth - margin;
    const yMin = margin;
    const yMax = gameState.canvasHeight - margin;
    player.x = Math.random() * (xMax - xMin) + xMin;
    player.y = Math.random() * (yMax - yMin) + yMin;
  } else {
    player.x = player.team === 'left'
      ? 100
      : gameState.canvasWidth - 100;
    player.y = gameState.canvasHeight / 2;
  }
  player.lastShotTime = Date.now();
  if (player.isBot) {
    if (player.moveAngle === undefined) {
      player.moveAngle = Math.random() * 360;
    }
  } else {
    player.moveAngle = undefined;
  }
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
  if (ioInstance) ioInstance.emit('roundStart', { round: gameState.currentRound + 1 });
}

function endTdmRound(winner) {
  if (winner === 'left') gameState.scoreBlue++;
  else if (winner === 'right') gameState.scoreRed++;
  gameState.currentRound++;
  gameState.gameStarted = false;
  if (ioInstance) ioInstance.emit('roundEnd', { winner });
  if (gameState.currentRound >= gameState.maxRounds) {
    gameState.forceGameOver = true;
  } else {
    if (ioInstance) {
      let count = 3;
      const interval = setInterval(() => {
        ioInstance.emit('roundCountdown', { count });
        count--;
        if (count === 0) {
          clearInterval(interval);
          startTdmRound();
        }
      }, 1000);
    } else {
      setTimeout(startTdmRound, 3000);
    }
  }
}

function checkTdmRoundEnd() {
  if (gameState.mode !== 'tdm' || !gameState.gameStarted) return;
  const leftAlive = Object.values(gameState.players).some(p => p.team === 'left' && p.isAlive);
  const rightAlive = Object.values(gameState.players).some(p => p.team === 'right' && p.isAlive);
  if (leftAlive && rightAlive) return;
  const winner = leftAlive ? 'left' : 'right';
  endTdmRound(winner);
}

function updateControlPoints(now) {
  const teams = ['left', 'right'];
  teams.forEach(team => {
    const areas = gameState.pointAreas[team];
    for (let i = areas.length - 1; i >= 0; i--) {
      const area = areas[i];
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
      if (elapsedArea >= gameState.controlPointDuration || area.pointsCollected >= 50) {
        areas.splice(i, 1);
      }
    }
  });

  if (gameState.pointAreas.left.length === 0 && gameState.pointAreas.right.length === 0) {
    const count = Math.floor(Math.random() * 3) + 1;
    teams.forEach(team => {
      gameState.pointAreas[team] = [];
      for (let i = 0; i < count; i++) {
        gameState.pointAreas[team].push(spawnControlPoint(team));
      }
    });
  }
}

function applyRandomUpgrade(bot) {
  const choices = Object.keys(upgradeMax).filter(k => (bot.upgrades[k] || 0) < upgradeMax[k]);
  if (choices.length === 0) return;
  const option = choices[Math.floor(Math.random() * choices.length)];
  switch (option) {
    case 'moreDamage':
      bot.bulletDamage++;
      break;
    case 'diagonalBullets':
      break;
    case 'shield':
      bot.shieldMax++;
      bot.shield = bot.shieldMax;
      break;
    case 'moreBullets':
      break;
    case 'bulletSpeed':
      bot.bulletSpeed++;
      break;
    case 'health':
      const newLvl = (bot.upgrades.health || 0) + 1;
      bot.maxLives += 10;
      bot.lives += 10;
      bot.radius *= 1.2;
      bot.speed *= 0.9;
      bot.regenRate = newLvl;
      break;
  }
  bot.upgrades[option] = (bot.upgrades[option] || 0) + 1;
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
    moveAngle: Math.random() * 360,
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
  createBot,
  createBotsPerTeam,
  removeBots,
  startTdmRound
};
