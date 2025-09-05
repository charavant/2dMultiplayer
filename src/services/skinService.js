const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '../../assets/PlayersSkins');

/**
 * Resize and optionally flip a PNG skin image.
 * @param {string} filePath relative path under assets
 * @param {number} width desired width
 * @param {number} height desired height
 * @param {boolean} flipHoriz flip image horizontally
 * @returns {Promise<Buffer>} processed PNG buffer
 */
async function getSkinImage(filePath, width, height, flipHoriz = false) {
  const safePath = path.normalize(filePath).replace(/^\.\.\/+/,'');
  const fullPath = path.join(ASSETS_DIR, safePath);
  if (!fullPath.startsWith(ASSETS_DIR) || !fs.existsSync(fullPath)) {
    throw new Error('Invalid skin path');
  }
  let img = sharp(fullPath).resize(width, height);
  // Use horizontal flip (flop) so right-side team faces left
  if (flipHoriz) img = img.flop();
  return img.png().toBuffer();
}

module.exports = { getSkinImage };
