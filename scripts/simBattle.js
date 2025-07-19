const gameState = require('../src/models/gameState');
const { startGameLoop, createBotsPerTeam } = require('../src/services/gameLogic');
const { MAX_LEVEL_CAP } = require('../src/models/upgradeConfig');
const { settings } = require('../src/models/settings');
const { maxLevelAtTime } = require('../src/utils/levelUtils');

const DURATION = 120000;
const STEP = 1000 / 60;

function computeLevelCap(minutes) {
  const tSec = Math.min(minutes, 10) * 60;
  const avg = settings.XP_PASSIVE;
  return Math.min(maxLevelAtTime(tSec, avg), MAX_LEVEL_CAP);
}

let bulletPeak = 0;
let simTime = 0;
const realStart = Date.now();
const origSetInterval = global.setInterval;
const origClearInterval = global.clearInterval;

global.setInterval = (fn, interval) => {
  if (interval === STEP) {
    while (simTime < DURATION) {
      fn();
      if (gameState.bullets.length > bulletPeak) bulletPeak = gameState.bullets.length;
      simTime += interval;
    }
    return 0;
  }
  return origSetInterval(fn, interval);
};

global.clearInterval = () => {};
Date.now = () => realStart + simTime;

// init state
Object.assign(gameState, {
  players: {},
  bullets: [],
  scoreBlue: 0,
  scoreRed: 0,
  gameDuration: DURATION,
  levelCap: computeLevelCap(DURATION / 60000),
  gameStarted: true,
  gameActive: true,
  gameStartTime: Date.now(),
});

createBotsPerTeam(3);

startGameLoop({ emit: () => {}, to: () => ({ emit: () => {} }) });

const players = Object.values(gameState.players);
const levels = players.map(p => p.level);
const totalXp = players.reduce((a, p) => a + p.exp, 0);
const dpsHist = {};
players.forEach(p => {
  const dps = p.damage / (DURATION / 1000);
  const bucket = Math.round(dps);
  dpsHist[bucket] = (dpsHist[bucket] || 0) + 1;
});

console.log('Levels reached:', levels);
console.log('Total XP:', Math.round(totalXp));
console.log('DPS histogram:', dpsHist);
console.log('Bullet count peak:', bulletPeak);
