// Shared by the arena and the desktop controller. Backgrounds and glow textures
// are rasterized once; the per-snapshot path only draws cached images and ships.
(function () {
  const teams = {
    left: { color: '#64d9ff', glow: 'rgba(57,179,255,.28)' },
    right: { color: '#ff7b93', glow: 'rgba(255,75,111,.24)' }
  };
  const skins = new Map();
  const bolts = {};
  let backdrop;
  const nebula = new Image();
  nebula.onload = () => { backdrop = null; };
  nebula.src = '/images/space/nebula-v1.webp';

  function image(src) {
    const sprite = new Image();
    sprite.src = src;
    return sprite;
  }
  const defaults = {
    left: image('/assets/PlayersSkins/ship-interceptor.png'),
    right: image('/skin?file=ship-vanguard.png&w=128&h=128&flip=true')
  };

  function makeBolt(team) {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const brush = sprite.getContext('2d');
    const halo = brush.createRadialGradient(32, 32, 3, 32, 32, 31);
    halo.addColorStop(0, '#f4fbff');
    halo.addColorStop(.2, teams[team].color);
    halo.addColorStop(.38, teams[team].glow);
    halo.addColorStop(1, 'transparent');
    brush.fillStyle = halo;
    brush.fillRect(0, 0, 64, 64);
    brush.beginPath();
    brush.arc(32, 32, 9, 0, Math.PI * 2);
    brush.fillStyle = '#edfaff';
    brush.fill();
    return sprite;
  }
  bolts.left = makeBolt('left');
  bolts.right = makeBolt('right');

  function drawBackground(ctx, width, height) {
    if (!backdrop || backdrop.width !== width || backdrop.height !== height) {
      backdrop = document.createElement('canvas');
      backdrop.width = width;
      backdrop.height = height;
      const brush = backdrop.getContext('2d');
      brush.fillStyle = '#070e1c';
      brush.fillRect(0, 0, width, height);
      if (nebula.complete && nebula.naturalWidth) {
        const scale = Math.max(width / nebula.naturalWidth, height / nebula.naturalHeight);
        const w = nebula.naturalWidth * scale, h = nebula.naturalHeight * scale;
        brush.drawImage(nebula, (width - w) / 2, (height - h) / 2, w, h);
      }
      brush.fillStyle = 'rgba(3,9,20,.34)';
      brush.fillRect(0, 0, width, height);
      for (const team of ['left', 'right']) {
        const x = team === 'left' ? 0 : width;
        const tint = brush.createRadialGradient(x, height / 2, 0, x, height / 2, width * .55);
        tint.addColorStop(0, teams[team].glow);
        tint.addColorStop(1, 'transparent');
        brush.fillStyle = tint;
        brush.fillRect(0, 0, width, height);
      }
      // Deterministic stars and navigation marks; no animation or per-frame work.
      let seed = 73;
      const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < Math.min(160, width * height / 7000); i++) {
        const x = random() * width, y = random() * height;
        brush.fillStyle = `rgba(196,224,255,${.15 + random() * .35})`;
        brush.fillRect(x, y, i % 8 === 0 ? 2 : 1, 1);
      }
      brush.strokeStyle = 'rgba(173,207,236,.08)';
      brush.lineWidth = 1;
      for (let x = 40; x < width; x += 80) {
        for (let y = 40; y < height; y += 80) {
          brush.beginPath();
          brush.moveTo(x - 3, y); brush.lineTo(x + 3, y);
          brush.moveTo(x, y - 3); brush.lineTo(x, y + 3);
          brush.stroke();
        }
      }
      brush.strokeStyle = 'rgba(164,202,237,.16)';
      brush.setLineDash([4, 12]);
      brush.beginPath(); brush.moveTo(width / 2, 0); brush.lineTo(width / 2, height); brush.stroke();
      brush.setLineDash([]);
      brush.beginPath(); brush.arc(width / 2, height / 2, Math.min(height * .22, 135), 0, Math.PI * 2); brush.stroke();
      brush.strokeStyle = 'rgba(164,202,237,.08)';
      brush.strokeRect(16.5, 16.5, width - 33, height - 33);
    }
    ctx.drawImage(backdrop, 0, 0);
  }

  function drawShip(ctx, player, simple) {
    const team = teams[player.team] || teams.left;
    const radius = player.radius;
    const size = radius * 2;
    let sprite = defaults[player.team] || defaults.left;
    if (player.skin) {
      const key = `${player.skin}|${player.team}`;
      if (!skins.has(key)) skins.set(key, image(`/skin?file=${encodeURIComponent(player.skin)}&w=128&h=128&flip=${player.team === 'right'}`));
      const chosen = skins.get(key);
      if (chosen.complete && chosen.naturalWidth) sprite = chosen;
    }
    ctx.save();
    // The slim ring shows the unchanged circular hit area for every avatar.
    ctx.beginPath(); ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = team.color; ctx.lineWidth = 1.2;
    ctx.globalAlpha *= .45; ctx.stroke();
    ctx.globalAlpha /= .45;
    if (!simple && player.shield > 0) {
      ctx.beginPath(); ctx.arc(player.x, player.y, radius * 1.12, 0, Math.PI * 2);
      ctx.strokeStyle = team.color; ctx.lineWidth = 2; ctx.stroke();
    }
    if (sprite.complete && sprite.naturalWidth) {
      ctx.drawImage(sprite, player.x - radius, player.y - radius, size, size);
    } else {
      ctx.fillStyle = team.color;
      ctx.beginPath(); ctx.arc(player.x, player.y, radius * .5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBullet(ctx, bullet, simple) {
    const team = teams[bullet.team] || teams.left;
    const r = bullet.radius;
    if (simple) {
      ctx.fillStyle = team.color;
      ctx.beginPath(); ctx.arc(bullet.x, bullet.y, r, 0, Math.PI * 2); ctx.fill();
    } else {
      const extent = r * 2;
      ctx.drawImage(bolts[bullet.team] || bolts.left, bullet.x - extent, bullet.y - extent, extent * 2, extent * 2);
    }
  }

  function drawStatus(ctx, player, nameSize = 13) {
    const width = player.radius * 1.7;
    const x = player.x - width / 2;
    const above = player.y - player.radius > 42;
    const y = above ? player.y - player.radius - 12 : player.y + player.radius + 25;
    const hp = Math.max(0, Math.min(1, (player.lives || 0) / (player.maxLives || 1)));
    ctx.fillStyle = '#030a14e8';
    ctx.fillRect(x - 1, y - 1, width + 2, 6);
    ctx.fillStyle = hp > .3 ? '#7ce3b3' : '#ff986e';
    ctx.fillRect(x, y, width * hp, 4);
    if (player.shieldMax > 0) {
      const shield = Math.max(0, Math.min(1, (player.shield || 0) / player.shieldMax));
      ctx.fillStyle = '#030a14e8'; ctx.fillRect(x - 1, y + 6, width + 2, 4);
      ctx.fillStyle = (teams[player.team] || teams.left).color; ctx.fillRect(x, y + 7, width * shield, 2);
    }
    const name = String(player.name || 'Pilot');
    const label = `${name.length > 13 ? name.slice(0, 12) + '…' : name} · ${player.level || 1}`;
    ctx.font = `600 ${nameSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const labelWidth = ctx.measureText(label).width;
    ctx.fillStyle = '#071321d9';
    ctx.fillRect(player.x - labelWidth / 2 - 6, y - nameSize - 12, labelWidth + 12, nameSize + 7);
    ctx.fillStyle = '#e4f0fc';
    ctx.fillText(label, player.x, y - 10);
  }

  window.ArenaGraphics = { drawBackground, drawShip, drawBullet, drawStatus };
})();
