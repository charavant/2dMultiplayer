// src/services/socketHandler.js
const gameState = require('../models/gameState');
const { spawnPlayer, createBotsPerTeam, removeBots, startTdmRound, createBot } = require('./gameLogic');
const botBehaviors = require('../botBehaviors');
const { releaseName } = require('../utils/botNameManager');
const { MAX_LEVEL_CAP, upgradeMax } = require('../models/upgradeConfig');
const { settings } = require('../models/settings');
const { maxLevelAtTime } = require('../utils/levelUtils');

function computeLevelCap(minutes) {
  const tSec = Math.min(minutes, 10) * 60;
  const avg = settings.XP_PASSIVE;
  return Math.min(maxLevelAtTime(tSec, avg), MAX_LEVEL_CAP);
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
    if (!p) return;
    if (p.team === 'left') left++; else if (p.team === 'right') right++;
  });
  return left <= right ? 'left' : 'right';
}

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    // Heartbeat: track last ack time per socket
    socket.data.lastAck = Date.now();
    socket.on('heartbeatAck', () => {
      socket.data.lastAck = Date.now();
      const p = gameState.players[socket.id];
      if (p && p.appInactive) {
        // Ignore ack while app is inactive/hidden
      } else if (p && p.disconnected) {
        p.disconnected = false;
        console.log(`[Heartbeat] Cleared status=disconnected (reason=ack) stableId=${p.id} socketId=${socket.id} name=${p.name} deviceId=${p.deviceId}`);
      } else if (!p && gameState.disconnectedPlayers[socket.id]) {
        // Client was marked stale but is actually alive; restore immediately
        const dp = gameState.disconnectedPlayers[socket.id];
        if (dp) {
          if (dp.appInactive) {
            // Stay disconnected while app reports inactive
          } else {
          dp.disconnected = false;
          const team = dp.team || assignTeam();
          dp.fillColor = TEAM_COLORS[team].fill;
          dp.borderColor = TEAM_COLORS[team].border;
          gameState.players[socket.id] = dp;
          delete gameState.disconnectedPlayers[socket.id];
          console.log(`[Heartbeat] Restored player from disconnected (reason=ack) stableId=${dp.id} socketId=${socket.id} name=${dp.name} deviceId=${dp.deviceId}`);
          }
        }
      }
      const now = Date.now();
      const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
      io.emit('gameState', {
        players: gameState.players,
        disconnectedPlayers: gameState.disconnectedPlayers,
        bullets: gameState.bullets,
        scoreBlue: gameState.scoreBlue,
        scoreRed: gameState.scoreRed,
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

    function resolvePlayerById(id) {
      let key = id;
      let player = gameState.players[id];
      if (!player) {
        key = Object.keys(gameState.players).find(k => gameState.players[k]?.id === id);
        if (key) player = gameState.players[key];
      }
      return { player, key };
    }

    function pauseIfNoActivePlayers(){
      try {
        if (Object.keys(gameState.players).length === 0 && gameState.gameStarted) {
          if (!gameState.gamePaused) {
            gameState.gamePaused = true;
            gameState.gameActive = false;
            gameState.pauseTime = Date.now();
          }
        }
      } catch {}
    }

    function resumeIfPaused(){
      try {
        if (gameState.gamePaused && gameState.gameStarted) {
          gameState.gamePaused = false;
          gameState.gameActive = true;
          if (gameState.pauseTime) {
            gameState.gameStartTime += Date.now() - gameState.pauseTime;
            gameState.pauseTime = null;
          }
        }
      } catch {}
    }

    // Handle joinWithName event from mobile controller (pre-game)
    socket.on('joinWithName', (info) => {
      let name = typeof info === 'string' ? info : info.name;
      name = (name || '').substring(0, 20); // enforce max length
      const device = info?.device || 'unknown';
      const deviceId = info?.deviceId || null;
      console.log(`Player ${socket.id} joined with name: ${name}`);

      // If this device had a disconnected player, restore them (keep team and stats)
      if (deviceId) {
        let foundOldId = null;
        let old = null;
        for (const [oldId, dp] of Object.entries(gameState.disconnectedPlayers)) {
          if (dp && dp.deviceId && dp.deviceId === deviceId) {
            foundOldId = oldId;
            old = dp;
            break;
          }
        }
        if (old) {
          const team = old.team || assignTeam();
          const stableId = old.id || foundOldId; // prefer previously exposed id
          const restored = {
            ...old,
            id: stableId,
            name,
            device,
            deviceId,
            team,
            fillColor: TEAM_COLORS[team].fill,
            borderColor: TEAM_COLORS[team].border,
            disconnected: false,
            skin: (info?.skin !== undefined ? info.skin : old.skin) || null,
            lastShotTime: old.lastShotTime || Date.now()
          };
          restored.maxLevel = gameState.levelCap;
          gameState.players[socket.id] = restored;
          delete gameState.disconnectedPlayers[foundOldId];
          if (stableId && stableId !== socket.id) {
            try { socket.join(stableId); } catch {}
          }
          if (gameState.gameStarted) {
            spawnPlayer(gameState.players[socket.id]);
          }
          console.log(`[Reconnect] Restored player stableId=${restored.id} socketId=${socket.id} name=${restored.name} deviceId=${restored.deviceId}`);
          socket.emit('playerInfo', gameState.players[socket.id]);
          return;
        }
      }

      const team = assignTeam();
      // Initialize new player
      gameState.players[socket.id] = {
        id: socket.id,
        name,
        device,
        deviceId,
        team,
        level: 1,
        exp: 0,
        lives: 3,
        maxLives: 3,
        regenRate: 0,
        bulletDamage: 1,
        bulletCooldownBase: 1000,
        bulletCooldown: 1000,
        bulletSpeed: 8,
        bulletRange: 1000,
        upgradePoints: 0,
        angle: 0,
        moveAngle: undefined,
        baseSpeed: 3,
        speed: 3,
        radius: 40,
        fillColor: TEAM_COLORS[team].fill,
        borderColor: TEAM_COLORS[team].border,
        shield: 0,
        shieldMax: 0,
        upgrades: {},
        lastShotTime: Date.now(),
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        lastDamagedBy: null,
        skin: info?.skin || null
      };
      gameState.players[socket.id].maxLevel = gameState.levelCap;
      if (gameState.gameStarted) {
        spawnPlayer(gameState.players[socket.id]);
      }
      console.log(`[Join] New player stableId=${gameState.players[socket.id].id} socketId=${socket.id} name=${name} deviceId=${deviceId}`);
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

    socket.on('setPointSpawnTime', (seconds) => {
      const s = parseFloat(seconds);
      if (!isNaN(s) && s > 0) {
        gameState.controlPointDuration = s * 1000;
      }
    });

    socket.on('setPointAreaSize', (pct) => {
      const p = parseInt(pct);
      if (!isNaN(p) && p > 0) {
        gameState.controlPointRadius = 40 * p / 100;
      }
    });

    socket.on('reloadSettings', (newSettings) => {
      Object.assign(settings, newSettings);
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
        disconnectedPlayers: gameState.disconnectedPlayers,
        bullets: gameState.bullets,
        scoreBlue: gameState.scoreBlue,
        scoreRed: gameState.scoreRed,
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

    socket.on('addBot', (team) => {
      if (team === 'left' || team === 'right') {
        createBot(team);
        const now = Date.now();
        const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
        io.emit('gameState', {
          players: gameState.players,
          disconnectedPlayers: gameState.disconnectedPlayers,
          bullets: gameState.bullets,
          scoreBlue: gameState.scoreBlue,
          scoreRed: gameState.scoreRed,
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

    socket.on('startGame', () => {
      if (!gameState.gameStarted) {
        gameState.gameActive = true;
        gameState.scoreBlue = 0;
        gameState.scoreRed = 0;
        gameState.bullets = [];
        gameState.pointAreas.left = [];
        gameState.pointAreas.right = [];
        gameState.forceGameOver = false;
        gameState.currentRound = 0;
        gameState.pauseTime = null;
        gameState.disconnectedPlayers = {};
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
        gameState.gameActive = false;
        gameState.pauseTime = Date.now();
      }
    });

    socket.on('resumeGame', () => {
      if (gameState.gamePaused) {
        gameState.gamePaused = false;
        gameState.gameActive = true;
        if (gameState.pauseTime) {
          gameState.gameStartTime += Date.now() - gameState.pauseTime;
          gameState.pauseTime = null;
        }
      }
    });

    socket.on('endGame', () => {
      if (gameState.gameStarted) {
        gameState.gameStarted = false;
        gameState.gameActive = false;
        gameState.gamePaused = false;
        gameState.pauseTime = null;
        gameState.forceGameOver = true;
      }
      // After the winner screen has been displayed for a few seconds
      // clear all remaining players so a fresh game can start next time.
      setTimeout(() => {
        if (!gameState.gameStarted) {
          Object.keys(gameState.players).forEach(id => {
            const p = gameState.players[id];
            if (p.isBot) {
              releaseName(p.name);
            }
            io.to(id).emit('kicked');
            delete gameState.players[id];
          });
          gameState.forceGameOver = false;
          gameState.gameActive = false;
          gameState.gamePaused = false;
          gameState.pauseTime = null;
          gameState.gameStartTime = null;
          gameState.scoreBlue = 0;
          gameState.scoreRed = 0;
          gameState.bullets = [];
          gameState.pointAreas.left = [];
          gameState.pointAreas.right = [];
          gameState.disconnectedPlayers = {};
        }
      }, 5000);
    });

    socket.on('restartGame', () => {
      gameState.scoreBlue = 0;
      gameState.scoreRed = 0;
      gameState.bullets = [];
      gameState.pointAreas.left = [];
      gameState.pointAreas.right = [];
      gameState.gameStarted = false;
      gameState.gamePaused = false;
      gameState.gameActive = false;
      gameState.gameStartTime = null;
      gameState.pauseTime = null;
      gameState.forceGameOver = false;
      gameState.currentRound = 0;
      gameState.disconnectedPlayers = {};
      Object.values(gameState.players).forEach(p => {
        p.level = 1;
        p.exp = 0;
        p.upgradePoints = 0;
        p.upgrades = {};
        p.bulletDamage = 1;
        p.bulletCooldownBase = 1000;
        p.bulletCooldown = 1000;
        p.bulletSpeed = 8;
        p.bulletRange = 1000;
        p.regenRate = 0;
        p.maxLives = 3;
        p.lives = 3;
        p.baseSpeed = 3;
        p.speed = 3;
        p.radius = 40;
        p.shield = 0;
        p.shieldMax = 0;
        p.kills = 0;
        p.deaths = 0;
        p.assists = 0;
        p.damage = 0;
        p.lastDamagedBy = null;
        p.maxLevel = gameState.levelCap;
        spawnPlayer(p);
      });
    });

    socket.on('setTeam', ({ playerId, team }) => {
      const { player: p } = resolvePlayerById(playerId);
      if (p && (team === 'left' || team === 'right')) {
        p.team = team;
        p.fillColor = TEAM_COLORS[p.team].fill;
        p.borderColor = TEAM_COLORS[p.team].border;
        if (gameState.gameStarted) spawnPlayer(p);
        io.to(p.id).emit('playerInfo', p);
      }
    });

    socket.on('setSkin', ({ playerId, skin }) => {
      const { player: p } = resolvePlayerById(playerId);
      if (p) {
        p.skin = skin;
        const now = Date.now();
        const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
        io.emit('gameState', {
          players: gameState.players,
          disconnectedPlayers: gameState.disconnectedPlayers,
          bullets: gameState.bullets,
          scoreBlue: gameState.scoreBlue,
          scoreRed: gameState.scoreRed,
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

    socket.on('changeName', ({ newName }) => {
      const p = gameState.players[socket.id];
      if (p && newName && newName.trim().length > 0) {
        const trimmedName = newName.trim().substring(0, 20); // enforce max length
        p.name = trimmedName;
        console.log(`Player ${socket.id} changed name to: ${trimmedName}`);
        
        // Send updated player info to the client
        socket.emit('playerInfo', p);
        
        // Broadcast updated game state to all clients
        const now = Date.now();
        const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
        io.emit('gameState', {
          players: gameState.players,
          disconnectedPlayers: gameState.disconnectedPlayers,
          bullets: gameState.bullets,
          scoreBlue: gameState.scoreBlue,
          scoreRed: gameState.scoreRed,
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

    // Client activity (screen/app visibility) -> mark disconnected/restore
    socket.on('clientActive', ({ active }) => {
      const p = gameState.players[socket.id];
      const now = Date.now();
      if (!active) {
        if (p) {
          delete gameState.players[socket.id];
          p.disconnected = true;
          p.appInactive = true;
          p.disconnectedAt = now;
          gameState.disconnectedPlayers[socket.id] = p;
          console.log(`[Activity] Marked status=disconnected (reason=inactive) stableId=${p.id} socketId=${socket.id} name=${p.name}`);
        }
      } else {
        // Active again: if in disconnected, restore; else ensure flag cleared
        if (!p && gameState.disconnectedPlayers[socket.id]) {
          const dp = gameState.disconnectedPlayers[socket.id];
          dp.disconnected = false;
          dp.appInactive = false;
          const team = dp.team || assignTeam();
          dp.fillColor = TEAM_COLORS[team].fill;
          dp.borderColor = TEAM_COLORS[team].border;
          gameState.players[socket.id] = dp;
          delete gameState.disconnectedPlayers[socket.id];
          console.log(`[Activity] Restored player (reason=active) stableId=${dp.id} socketId=${socket.id} name=${dp.name}`);
        } else if (p) {
          p.disconnected = false;
          p.appInactive = false;
        }
      }
      pauseIfNoActivePlayers();
      const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
      io.emit('gameState', {
        players: gameState.players,
        disconnectedPlayers: gameState.disconnectedPlayers,
        bullets: gameState.bullets,
        scoreBlue: gameState.scoreBlue,
        scoreRed: gameState.scoreRed,
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

    socket.on('removePlayer', (playerId) => {
      const { player: target, key } = resolvePlayerById(playerId);
      if (target) {
        if (!target.isBot) {
          io.to(target.id).emit('kicked');
        }
        if (target.isBot) {
          releaseName(target.name);
        }
        delete gameState.players[key];
      } else {
        // Try to remove from disconnected players by key, stable id, or device id
        let dpKey = null;
        let dp = gameState.disconnectedPlayers[playerId];
        if (dp) {
          dpKey = playerId;
        } else {
          for (const [k, v] of Object.entries(gameState.disconnectedPlayers)) {
            if (v && (v.id === playerId || v.deviceId === playerId)) { dpKey = k; dp = v; break; }
          }
        }
        if (dp) {
          if (dp.isBot) {
            releaseName(dp.name);
          }
          delete gameState.disconnectedPlayers[dpKey];
        }
      }
      pauseIfNoActivePlayers();
      const now = Date.now();
      const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
      io.emit('gameState', {
        players: gameState.players,
        disconnectedPlayers: gameState.disconnectedPlayers,
        bullets: gameState.bullets,
        scoreBlue: gameState.scoreBlue,
        scoreRed: gameState.scoreRed,
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

    socket.on('switchTeam', (playerId) => {
      const { player: p } = resolvePlayerById(playerId);
      if (p) {
        p.team = p.team === 'left' ? 'right' : 'left';
        // Update colors so the player sees the change immediately
        p.fillColor = TEAM_COLORS[p.team].fill;
        p.borderColor = TEAM_COLORS[p.team].border;
        if (gameState.gameStarted) {
          spawnPlayer(p);
        }
        // Inform the affected player about their new team
        io.to(p.id).emit('playerInfo', p);

        // Immediately broadcast updated state so popups refresh
        const now = Date.now();
        const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
        io.emit('gameState', {
          players: gameState.players,
          disconnectedPlayers: gameState.disconnectedPlayers,
          bullets: gameState.bullets,
          scoreBlue: gameState.scoreBlue,
          scoreRed: gameState.scoreRed,
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

    socket.on('setBotBehavior', ({ botId, behavior }) => {
      const bot = gameState.players[botId];
      const b = botBehaviors.getBehavior(behavior);
      if (bot && bot.isBot && b) {
        bot.behavior = behavior;
        if (b.init) b.init(bot);

        const now = Date.now();
        const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
        io.emit('gameState', {
          players: gameState.players,
          disconnectedPlayers: gameState.disconnectedPlayers,
          bullets: gameState.bullets,
          scoreBlue: gameState.scoreBlue,
          scoreRed: gameState.scoreRed,
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
      const p = gameState.players[socket.id];
      if (!p) return;
      p.angle = angleDeg;
      if (angleDeg === null || angleDeg === undefined) {
        p.moveAngle = undefined;
      } else {
        p.moveAngle = angleDeg;
      }
    });

    socket.on('upgrade', (option) => {
      const p = gameState.players[socket.id];
      if (!p || !upgradeMax[option]) return;
      if (!p.upgrades[option]) p.upgrades[option] = 0;
      if (p.upgrades[option] >= upgradeMax[option]) return;
      let cost = 1;
      if (option === 'shield') {
        const next = p.upgrades[option] + 1;
        if (next >= 3 && next <= 5) cost = 2;
      }
      if (p.upgradePoints < cost) return;

      switch(option) {
        case 'moreDamage': {
          const lvl = p.upgrades.moreDamage + 1;
          p.bulletDamage = require('./gameLogic').computeBulletDamage(lvl);
          break; }
        case 'diagonalBullets':
          break;
        case 'shield':
          p.shieldMax++;
          p.shield = Math.min(p.shield + 1, p.shieldMax);
          break;
        case 'moreBullets': {
          const lvl = p.upgrades.moreBullets + 1;
          p.bulletCooldown = require('./gameLogic').computeCooldown(p.bulletCooldownBase, lvl);
          break; }
        case 'bulletSpeed':
          p.bulletSpeed *= 1.15;
          p.bulletRange *= 0.95;
          break;
        case 'health': {
          const lvl = (p.upgrades.health || 0) + 1;
          const penalties = [0.06,0.14,0.24,0.36,0.50];
          p.maxLives += 10;
          p.lives += 10;
          p.regenRate = lvl * 0.6;
          const pen = penalties[lvl-1] || penalties[penalties.length-1];
          p.speed = p.baseSpeed * (1 - pen);
          break;
        }
      }

      p.upgrades[option]++;
      p.upgradePoints -= cost;
      socket.emit('playerInfo', p);
    });

    socket.on('disconnect', () => {
      console.log(`Player ${socket.id} disconnected.`);
      const p = gameState.players[socket.id];
      if (p) {
        delete gameState.players[socket.id];
        if (p.isBot) {
          releaseName(p.name);
        } else {
          p.disconnected = true;
          p.disconnectedAt = Date.now();
          gameState.disconnectedPlayers[socket.id] = p;
          console.log(`[Disconnect] Marked status=disconnected (reason=socket disconnect) stableId=${p.id} socketId=${socket.id} name=${p.name} deviceId=${p.deviceId}`);
        }
      }
      // If no active players remain, pause instead of resetting state
      pauseIfNoActivePlayers();
      // Broadcast immediate update so UI reflects disconnected state instantly
      const now = Date.now();
      const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
      io.emit('gameState', {
        players: gameState.players,
        disconnectedPlayers: gameState.disconnectedPlayers,
        bullets: gameState.bullets,
        scoreBlue: gameState.scoreBlue,
        scoreRed: gameState.scoreRed,
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
  });

  // Heartbeat loop
  setInterval(() => {
    io.emit('heartbeatPing');
    const now = Date.now();
    // Consider stale if no ack in last 2000ms (avoid false positives)
    const STALE_MS = 2000;
    Object.keys(gameState.players).forEach(sid => {
      const s = io.sockets.sockets.get(sid);
      if (!s) return;
      if ((now - (s.data.lastAck || 0)) > STALE_MS) {
        const p = gameState.players[sid];
        if (p) {
          // Move to disconnected immediately
          delete gameState.players[sid];
          p.disconnected = true;
          p.disconnectedAt = now;
          gameState.disconnectedPlayers[sid] = p;
          console.log(`[Heartbeat] Marked status=disconnected (reason=stale ack) ageMs=${now - (s.data.lastAck || 0)} stableId=${p.id} socketId=${sid} name=${p.name} deviceId=${p.deviceId}`);
          pauseIfNoActivePlayers();
          const elapsed = gameState.gameStartTime ? now - gameState.gameStartTime : 0;
          io.emit('gameState', {
            players: gameState.players,
            disconnectedPlayers: gameState.disconnectedPlayers,
            bullets: gameState.bullets,
            scoreBlue: gameState.scoreBlue,
            scoreRed: gameState.scoreRed,
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
      }
    });

    // Purge disconnected players older than TTL
    const TTL_MS = 5 * 60 * 1000; // 5 minutes
    let purged = false;
    Object.entries(gameState.disconnectedPlayers).forEach(([did, dp]) => {
      if (!dp || !dp.disconnectedAt) return;
      if ((Date.now() - dp.disconnectedAt) > TTL_MS) {
        console.log(`[Purge] Removing stale disconnected player stableId=${dp.id} socketId=${did} name=${dp.name}`);
        delete gameState.disconnectedPlayers[did];
        purged = true;
      }
    });
    if (purged) {
      const elapsed = gameState.gameStartTime ? Date.now() - gameState.gameStartTime : 0;
      io.emit('gameState', {
        players: gameState.players,
        disconnectedPlayers: gameState.disconnectedPlayers,
        bullets: gameState.bullets,
        scoreBlue: gameState.scoreBlue,
        scoreRed: gameState.scoreRed,
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
  }, 1000);
}

module.exports = { initSocket };
