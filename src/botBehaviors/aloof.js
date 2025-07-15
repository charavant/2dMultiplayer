module.exports = {
  name: 'aloof',
  init(bot) {
    bot.speed = (bot.speed || 3) + 1; // extra speed
  },
  update(bot, { now }) {
    if (!bot.nextMoveChange || now > bot.nextMoveChange) {
      bot.moveAngle = Math.random() * 360;
      bot.nextMoveChange = now + 400 + Math.random() * 600;
    }
  },
  pickUpgrade(bot, choices) {
    return choices[Math.floor(Math.random() * choices.length)];
  }
};
