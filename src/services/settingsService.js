const fs = require('fs');
const path = require('path');
const { settings } = require('../models/settings');

const settingsPath = path.join(__dirname, '../data/balanceSettings.json');

function loadSettings() {
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      Object.assign(settings, data);
    } catch (err) {
      console.error('Failed to read balance settings:', err);
    }
  }
  return settings;
}

module.exports = { loadSettings, settingsPath };

