// Regenerate the selectable ship PNGs from these small, editable vector sources.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const ships = {
  interceptor: { color: '#65dcff', hull: 'M22 49 43 34 49 19 64 36 111 64 64 92 49 109 43 94 22 79 38 64Z', wing: 'M43 39 59 49 87 64 59 79 43 89 52 64Z' },
  vanguard: { color: '#ffbd72', hull: 'M22 30 55 36 73 25 103 48 114 64 103 80 73 103 55 92 22 98 34 77 34 51Z', wing: 'M38 42 67 50 95 64 67 78 38 86 48 64Z' },
  spectre: { color: '#c4a0ff', hull: 'M14 23 62 39 105 51 116 64 105 77 62 89 14 105 39 70 39 58Z', wing: 'M41 46 64 54 97 64 64 74 41 82 56 64Z' },
  comet: { color: '#8defba', hull: 'M28 43 48 43 53 21 77 42 104 55 114 64 104 73 77 86 53 107 48 85 28 85 37 64Z', wing: 'M48 47 68 48 95 64 68 80 48 81 56 64Z' }
};

async function build() {
  const directory = path.join(__dirname, '../assets/PlayersSkins');
  for (const [name, ship] of Object.entries(ships)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs><linearGradient id="h" x2=".2" y2="1"><stop stop-color="#b8cee3"/><stop offset=".45" stop-color="#49627d"/><stop offset="1" stop-color="#172c43"/></linearGradient>
      <linearGradient id="c"><stop stop-color="${ship.color}"/><stop offset="1" stop-color="#efffff"/></linearGradient>
      <radialGradient id="e"><stop stop-color="#e9ffff"/><stop offset=".4" stop-color="${ship.color}" stop-opacity=".8"/><stop offset="1" stop-color="${ship.color}" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="26" cy="64" rx="22" ry="13" fill="url(#e)"/>
      <path d="${ship.hull}" fill="url(#h)" stroke="#aac5df" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="${ship.wing}" fill="#111f33" stroke="${ship.color}" stroke-width="1.2"/>
      <path d="M51 58 77 54 92 64 77 74 51 70Z" fill="url(#c)" stroke="#e1f8ff" stroke-width="1"/>
      <path d="M39 48 50 52M39 80 50 76" stroke="${ship.color}" stroke-width="3" stroke-linecap="round"/>
      <path d="M97 61 109 64 97 67" fill="#f2fbff"/>
      <path d="M31 55V73" stroke="#b2eaff" stroke-width="3"/>
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(directory, `ship-${name}.png`));
  }
  console.log('Built 4 ship avatars.');
}
build().catch(error => { console.error(error); process.exitCode = 1; });
