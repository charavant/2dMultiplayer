const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node scripts/splitSpriteSheet.js <imagePath> <outputDir> [--split]');
  process.exit(1);
}

const [imagePath, outputDir] = args;
const splitFrames = args.includes('--split');

const ROWS = 15; // rows of sprites
const COLS = 24; // columns of sprites
const FRAMES_PER_IMAGE = 8; // group size
const IMAGES_PER_ROW = 3; // 3 images per row

async function main() {
  const sheet = sharp(imagePath);
  const meta = await sheet.metadata();
  const buffer = await sheet.toBuffer();

  const frameWidth = Math.floor(meta.width / COLS);
  const frameHeight = Math.floor(meta.height / ROWS);

  for (let r = 0; r < ROWS; r++) {
    for (let i = 0; i < IMAGES_PER_ROW; i++) {
      const itemDir = path.join(outputDir, `item${i + 1}`);
      fs.mkdirSync(itemDir, { recursive: true });

      const left = (i * FRAMES_PER_IMAGE) * frameWidth;
      const top = r * frameHeight;

      if (splitFrames) {
        for (let f = 0; f < FRAMES_PER_IMAGE; f++) {
          const frameLeft = left + f * frameWidth;
          const outPath = path.join(itemDir, `r${r + 1}_f${f + 1}.png`);
          await sharp(buffer)
            .extract({ left: frameLeft, top, width: frameWidth, height: frameHeight })
            .toFile(outPath);
        }
      } else {
        const outPath = path.join(itemDir, `r${r + 1}.png`);
        await sharp(buffer)
          .extract({ left, top, width: frameWidth * FRAMES_PER_IMAGE, height: frameHeight })
          .toFile(outPath);
      }
    }
  }

  console.log('Sprites exported to', outputDir);
}

main().catch(err => {
  console.error('Error processing sprite sheet:', err);
  process.exit(1);
});
