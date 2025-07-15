const attackChoices = ['moreDamage', 'moreBullets', 'bulletSpeed', 'diagonalBullets'];

module.exports = {
  name: 'aggressive',
  init(bot) {
    // no specific initialisation for now
  },
  update(bot, { enemies, gameState, now }) {
    if (enemies && enemies.length > 0) {
      const target = enemies.reduce((closest, p) => {
        const dx = p.x - bot.x;
        const dy = p.y - bot.y;
        const distSq = dx * dx + dy * dy;
        if (!closest || distSq < closest.distSq) return { p, distSq };
        return closest;
      }, null).p;
      const aim = Math.atan2(target.y - bot.y, target.x - bot.x) * 180 / Math.PI;
      bot.angle = aim;
      if (!bot.nextMoveChange || now > bot.nextMoveChange) {
        bot.moveAngle = aim;
        bot.nextMoveChange = now + 500;
      }
    } else {
      const centerX = gameState.canvasWidth / 2;
      const centerY = gameState.canvasHeight / 2;
      const ang = Math.atan2(centerY - bot.y, centerX - bot.x) * 180 / Math.PI;
      bot.moveAngle = ang;
    }
  },
  pickUpgrade(bot, choices) {
    const preferred = choices.filter(c => attackChoices.includes(c));
    const pool = preferred.length > 0 ? preferred : choices;
    return pool[Math.floor(Math.random() * pool.length)];
  }
};
