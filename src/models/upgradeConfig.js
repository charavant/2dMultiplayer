const upgradeMax = {
  moreDamage: 5,
  diagonalBullets: 3,
  shield: 5,
  moreBullets: 5,
  bulletSpeed: 5,
  health: 5,
};

const TOTAL_UPGRADE_LEVELS = Object.values(upgradeMax).reduce((a, b) => a + b, 0);
const MAX_LEVEL_CAP = Math.floor(TOTAL_UPGRADE_LEVELS * 0.75);

const labels = {
  moreDamage: 'Damage',
  diagonalBullets: 'Diagonal',
  shield: 'Shield',
  moreBullets: 'More Bullets',
  bulletSpeed: 'Bullet Speed',
  health: 'Health'
};
const upgradeBreakdown = Object.entries(upgradeMax)
  .map(([k, v]) => `${v} ${labels[k]}`)
  .join(' + ');

module.exports = {
  upgradeMax,
  TOTAL_UPGRADE_LEVELS,
  MAX_LEVEL_CAP,
  upgradeBreakdown
};
