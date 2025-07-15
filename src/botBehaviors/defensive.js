const defenseChoices = ['shield', 'health'];

module.exports = {
  name: 'defensive',
  init(bot) {
    // nothing special for now
  },
  update(bot, { gameState, now }) {
    const centerX = gameState.canvasWidth / 2;
    const centerY = gameState.canvasHeight / 2;
    const ang = Math.atan2(centerY - bot.y, centerX - bot.x) * 180 / Math.PI;
    if (!bot.nextMoveChange || now > bot.nextMoveChange) {
      bot.moveAngle = ang + (Math.random() * 60 - 30);
      bot.nextMoveChange = now + 1000;
    }
  },
  pickUpgrade(bot, choices) {
    const preferred = choices.filter(c => defenseChoices.includes(c));
    const pool = preferred.length > 0 ? preferred : choices;
    return pool[Math.floor(Math.random() * pool.length)];
  }
};
