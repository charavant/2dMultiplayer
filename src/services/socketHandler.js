// src/services/socketHandler.js
const gameState = require('../models/gameState');
const { spawnPlayer, createBotsPerTeam, removeBots, startTdmRound } = require('./gameLogic');
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
    socket.emit('teamNames', gameState.teamNames);

    // Handle joinWithName event from controllers (pre-game)
    socket.on('joinWithName', (data) => {
      const name = typeof data === 'string' ? data : data.name;
      let team = typeof data === 'object' && data.team ? data.team : assignTeam();
      if (team !== 'left' && team !== 'right') team = assignTeam();
      console.log(`Player ${socket.id} joined with name: ${name} team: ${team}`);
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
        lastShotTime: Date.now(),
        kills: 0,
        deaths: 0,
        assists: 0,
        lastDamagedBy: null
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

    socket.on('setMaxRounds', (rounds) => {
      const r = parseInt(rounds);
      if (!isNaN(r) && r > 0) {
        gameState.maxRounds = r;
      }
    });

    socket.on('setGameMode', (mode) => {
      if (mode === 'classic' || mode === 'control' || mode === 'tdm') {
        gameState.mode = mode;
      }
    });

    socket.on('setBots', ({ enable, count }) => {
      if (enable) {
        removeBots();
        const n = parseInt(count);
        if (!isNaN(n) && n > 0) {
          createBotsPerTeam(n);
        }
      } else {
        removeBots();
      }
      const now = Date.now();
      const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
      io.emit('gameState', {
        players: gameState.players,
        bullets: gameState.bullets,
        scoreBlue: gameState.scoreBlue,
        scoreRed: gameState.scoreRed,
        teamNames: gameState.teamNames,
        mode: gameState.mode,
        currentRound: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        gameTimer: gameState.gameStarted
          ? Math.max(0, Math.floor((gameState.gameDuration - elapsed) / 1000))
          : 0,
        gameDuration: Math.floor(gameState.gameDuration / 1000),
        gamePaused: gameState.gamePaused,
        gameStarted: gameState.gameStarted,
        gameOver:
          !gameState.gameStarted &&
          gameState.gameStartTime &&
          elapsed >= gameState.gameDuration,
      });
    });

    socket.on('startGame', () => {
      if (!gameState.gameStarted) {
        gameState.scoreBlue = 0;
        gameState.scoreRed = 0;
        gameState.bullets = [];
        gameState.pointAreas.left = null;
        gameState.pointAreas.right = null;
        gameState.forceGameOver = false;
        gameState.currentRound = 0;
        if (gameState.mode === 'tdm') {
          startTdmRound();
        } else {
          gameState.gameStarted = true;
          gameState.gameStartTime = Date.now();
          Object.values(gameState.players).forEach(spawnPlayer);
        }
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

    socket.on('endGame', () => {
      gameState.gameStarted = false;
      gameState.forceGameOver = true;
      gameState.gamePaused = false;
      gameState.pauseTime = null;
    });

    socket.on('restartGame', () => {
      gameState.scoreBlue = 0;
      gameState.scoreRed = 0;
      gameState.bullets = [];
      gameState.pointAreas.left = null;
      gameState.pointAreas.right = null;
      gameState.gameStarted = false;
      gameState.gamePaused = false;
      gameState.gameStartTime = null;
      gameState.forceGameOver = false;
      gameState.currentRound = 0;
      Object.values(gameState.players).forEach(spawnPlayer);
    });

    socket.on('setTeamName', ({ team, name }) => {
      if ((team === 'left' || team === 'right') && typeof name === 'string') {
        gameState.teamNames[team] = name.trim().slice(0, 20) || gameState.teamNames[team];
        io.emit('teamNames', gameState.teamNames);
      }
    });

    socket.on('setTeam', ({ playerId, team }) => {
      const p = gameState.players[playerId];
      if (p && (team === 'left' || team === 'right')) {
        p.team = team;
        p.fillColor = TEAM_COLORS[p.team].fill;
        p.borderColor = TEAM_COLORS[p.team].border;
        if (gameState.gameStarted) spawnPlayer(p);
        io.to(playerId).emit('playerInfo', p);
      }
    });

    socket.on('removePlayer', (playerId) => {
      if (gameState.players[playerId]) {
        io.to(playerId).emit('kicked');
        delete gameState.players[playerId];
      }
    });

    socket.on('switchTeam', (playerId) => {
      const p = gameState.players[playerId];
      if (p) {
        p.team = p.team === 'left' ? 'right' : 'left';
        // Update colors so the player sees the change immediately
        p.fillColor = TEAM_COLORS[p.team].fill;
        p.borderColor = TEAM_COLORS[p.team].border;
        if (gameState.gameStarted) {
          spawnPlayer(p);
        }
        // Inform the affected player about their new team
        io.to(playerId).emit('playerInfo', p);

        // Immediately broadcast updated state so popups refresh
        const now = Date.now();
        const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
        io.emit('gameState', {
          players: gameState.players,
          bullets: gameState.bullets,
          scoreBlue: gameState.scoreBlue,
          scoreRed: gameState.scoreRed,
          teamNames: gameState.teamNames,
          mode: gameState.mode,
          currentRound: gameState.currentRound,
          maxRounds: gameState.maxRounds,
          gameTimer: gameState.gameStarted
            ? Math.max(0, Math.floor((gameState.gameDuration - elapsed) / 1000))
            : 0,
          gameDuration: Math.floor(gameState.gameDuration / 1000),
          gamePaused: gameState.gamePaused,
          gameStarted: gameState.gameStarted,
          gameOver:
            !gameState.gameStarted &&
            gameState.gameStartTime &&
            elapsed >= gameState.gameDuration,
        });
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
