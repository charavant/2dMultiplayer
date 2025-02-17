// app.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const os = require('os');

// ----------------------------------
// 1) Get local IP for QR join URL
// ----------------------------------
function getLocalIp() {
  const nets = os.networkInterfaces();
  let ip = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ip = net.address;
        break;
      }
    }
    if (ip !== 'localhost') break;
  }
  return ip;
}
const localIp = getLocalIp();
const PORT = process.env.PORT || 3000;
const joinURL = `http://${localIp}:${PORT}/controller`;

// ----------------------------------
// 2) Setup Express & Socket.io
// ----------------------------------
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// ----------------------------------
// 3) Global Game Variables & Helpers
// ----------------------------------
let players = {};    // key: socket.id -> player object
let bullets = [];    // array of bullet objects
let gameStarted = false;
let gameStartTime = null;
let gameDuration = 10 * 60 * 1000; // default 10 minutes (ms)
let scoreBlue = 0, scoreRed = 0;

let canvasWidth = 800, canvasHeight = 600;
function leftMaxX() { return canvasWidth / 2; }
function rightMinX() { return canvasWidth / 2; }

// Team assignment: Blue for team "left", Red for "right"
function assignTeam() {
  let blueCount = 0, redCount = 0;
  for (const id in players) {
    if (players[id].team === 'left') blueCount++;
    else if (players[id].team === 'right') redCount++;
  }
  return (blueCount <= redCount) ? 'left' : 'right';
}

function spawnPlayer(p) {
  p.lives = 3;
  if (p.team === 'left') p.x = 100;
  else p.x = canvasWidth - 100;
  p.y = canvasHeight / 2;
  p.lastShotTime = Date.now();
  if (p.shieldMax > 0) {
    p.shield = p.shieldMax;
    p.lastShieldRepair = Date.now();
  }
}

function randomColor() {
  return '#' + Math.floor(Math.random()*16777215).toString(16);
}

// Upgrade maximums
const upgradeMax = {
  moreDamage: 2,
  diagonalBullets: 2,
  shield: 3,
  moreBullets: 4,
  bulletSpeed: 3
};

// When firing bullets, number = 1 + moreBullets upgrade.
// They are fired in a small spread.
function fireBullets(player) {
  const count = 1 + player.upgrades.moreBullets; // number of bullets
  let spread = 10; // total spread angle in degrees
  let angles = [];
  if (count > 1) {
    for (let i = 0; i < count; i++) {
      let offset = -spread/2 + (spread/(count-1)) * i;
      angles.push(offset);
    }
  } else {
    angles.push(0);
  }
  const base = (player.team === 'left') ? 0 : 180;
  angles.forEach(a => {
    createBulletWithAngle(player, base + a);
  });
  // Diagonal upgrade: fire extra bullets at ±30.
  if (player.diagonalBullets) {
    createBulletWithAngle(player, (player.team === 'left') ? 30 : 150);
    createBulletWithAngle(player, (player.team === 'left') ? -30 : 210);
    if (player.diagonalBounce) {
      // Mark these two bullets for bounce.
      bullets[bullets.length-1].bounce = true;
      bullets[bullets.length-2].bounce = true;
    }
  }
}

function createBulletWithAngle(player, angle) {
  const bulletSpeed = player.bulletSpeed;
  const rad = angle * Math.PI / 180;
  bullets.push({
    x: player.x,
    y: player.y,
    radius: 5 + (player.bulletDamage - 1) * 2,
    team: player.team,
    color: '#fff',
    speedX: bulletSpeed * Math.cos(rad),
    speedY: bulletSpeed * Math.sin(rad),
    damage: player.bulletDamage,
    shooterId: player.id,
    bounce: false
  });
}

// ----------------------------------
// 4) Socket.IO Events
// ----------------------------------
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // (A) PC game screen sends canvas dimensions.
  socket.on('canvasDimensions', (dims) => {
    canvasWidth = dims.width;
    canvasHeight = dims.height;
    io.emit('gameState', {
      players, bullets, scoreBlue, scoreRed,
      gameTimer: gameStarted ? Math.max(0, Math.floor((gameDuration - (Date.now()-gameStartTime)) / 1000)) : 0,
      gameOver: gameStarted && (Date.now()-gameStartTime >= gameDuration)
    });
  });

  // (B) PC screen sets game duration.
  socket.on('setGameTime', (minutes) => {
    const m = parseFloat(minutes);
    if (!isNaN(m) && m > 0) {
      gameDuration = m * 60 * 1000;
      console.log(`Game duration set to ${m} minutes.`);
    }
  });

  // (C) PC screen notifies that QR modal is closed => start game.
  socket.on('startGame', () => {
    if (!gameStarted) {
      gameStarted = true;
      gameStartTime = Date.now();
      console.log('Game started!');
    }
  });

  // (D) Mobile controller joins.
  socket.on('joinAsController', () => {
    const team = assignTeam();
    players[socket.id] = {
      id: socket.id,
      team: team,  // 'left' (Blue) or 'right' (Red)
      x: (team === 'left') ? 100 : canvasWidth - 100,
      y: canvasHeight / 2,
      radius: 20,
      fillColor: randomColor(),
      borderColor: randomColor(),
      speed: 3,
      angle: 0,
      lives: 3,
      level: 1,
      exp: 0,
      upgradePoints: 0,
      bulletCooldown: 1000,   // ms between shots
      bulletDamage: 1,
      bulletSpeed: 8,
      diagonalBullets: false,
      diagonalBounce: false,
      shieldMax: 0,
      shield: 0,
      upgrades: { moreDamage: 0, diagonalBullets: 0, shield: 0, moreBullets: 0, bulletSpeed: 0 },
      lastShotTime: Date.now(),
      lastShieldRepair: Date.now()
    };
    console.log(`Player ${socket.id} joined on team ${team}`);
    socket.emit('playerInfo', players[socket.id]);
    io.emit('gameState', {
      players, bullets, scoreBlue, scoreRed,
      gameTimer: gameStarted ? Math.max(0, Math.floor((gameDuration - (Date.now()-gameStartTime)) / 1000)) : 0,
      gameOver: false
    });
  });

  // (E) Mobile controller sends joystick angle update.
  socket.on('updateAngle', (angleDeg) => {
    if (players[socket.id]) {
      players[socket.id].angle = angleDeg;
    }
  });

  // (F) Mobile controller requests an upgrade.
  socket.on('upgrade', (option) => {
    const p = players[socket.id];
    if (!p || p.upgradePoints <= 0) return;
    switch(option) {
      case 'moreDamage':
        if (p.upgrades.moreDamage < upgradeMax.moreDamage) {
          p.bulletDamage += 1;
          p.upgrades.moreDamage++;
        }
        break;
      case 'diagonalBullets':
        if (p.upgrades.diagonalBullets < upgradeMax.diagonalBullets) {
          p.upgrades.diagonalBullets++;
          if (p.upgrades.diagonalBullets === 1) {
            p.diagonalBullets = true;
          } else if (p.upgrades.diagonalBullets === 2) {
            p.diagonalBounce = true;
          }
        }
        break;
      case 'shield':
        if (p.upgrades.shield < upgradeMax.shield) {
          p.shieldMax += 1;
          p.shield = p.shieldMax;
          p.upgrades.shield++;
        }
        break;
      case 'moreBullets':
        if (p.upgrades.moreBullets < upgradeMax.moreBullets) {
          p.upgrades.moreBullets++;
        }
        break;
      case 'bulletSpeed':
        if (p.upgrades.bulletSpeed < upgradeMax.bulletSpeed) {
          p.bulletSpeed += 1;
          p.upgrades.bulletSpeed++;
        }
        break;
    }
    p.upgradePoints -= 1;
    socket.emit('playerInfo', p);
  });

  // (G) On disconnect.
  socket.on('disconnect', () => {
    if (players[socket.id]) {
      console.log(`Player ${socket.id} disconnected.`);
      delete players[socket.id];
      io.emit('gameState', {
        players, bullets, scoreBlue, scoreRed,
        gameTimer: gameStarted ? Math.max(0, Math.floor((gameDuration - (Date.now()-gameStartTime)) / 1000)) : 0,
        gameOver: gameStarted && (Date.now()-gameStartTime >= gameDuration)
      });
    }
  });
});

// ----------------------------------
// 5) Game Loop (60 FPS)
// ----------------------------------
setInterval(() => {
  const now = Date.now();

  // End game if time is up.
  if (gameStarted && now - gameStartTime >= gameDuration) {
    gameStarted = false;
  }

  for (const id in players) {
    const p = players[id];

    // --- Movement ---
    const rad = p.angle * Math.PI / 180;
    p.x += Math.cos(rad) * p.speed;
    p.y += Math.sin(rad) * p.speed;

    if (p.team === 'left') {
      if (p.x < p.radius) p.x = p.radius;
      if (p.x > leftMaxX() - p.radius) p.x = leftMaxX() - p.radius;
    } else {
      if (p.x < rightMinX() + p.radius) p.x = rightMinX() + p.radius;
      if (p.x > canvasWidth - p.radius) p.x = canvasWidth - p.radius;
    }
    if (p.y < p.radius) p.y = p.radius;
    if (p.y > canvasHeight - p.radius) p.y = canvasHeight - p.radius;

    // --- EXP gain & Level Up ---
    p.exp += 0.5 / 60;
    if (p.exp >= 10) {
      p.exp -= 10;
      p.level++;
      p.upgradePoints += 1;
      if (p.shieldMax > 0) p.shield = p.shieldMax;
    }

    // --- Shield auto-repair could be added here if desired ---

    // --- Auto-fire bullets if game is running ---
    if (gameStarted && now - p.lastShotTime >= p.bulletCooldown) {
      fireBullets(p);
      p.lastShotTime = now;
    }
  }

  // --- Update Bullets ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.speedX;
    b.y += b.speedY;
    if (b.bounce) {
      if (b.y - b.radius < 0 || b.y + b.radius > canvasHeight) {
        b.speedY = -b.speedY;
      }
    }
    if (b.x < -50 || b.x > canvasWidth + 50 || b.y < -50 || b.y > canvasHeight + 50) {
      bullets.splice(i, 1);
      continue;
    }
    for (const pid in players) {
      const p = players[pid];
      if (p.team !== b.team) {
        const dx = b.x - p.x, dy = b.y - p.y;
        if (Math.sqrt(dx*dx + dy*dy) < b.radius + p.radius) {
          if (p.shield > 0) {
            p.shield--;
          } else {
            p.lives -= b.damage;
          }
          const shooter = players[b.shooterId];
          if (shooter) shooter.exp += 2;
          if (p.lives <= 0) {
            if (shooter) shooter.exp += 5;
            if (shooter) {
              if (shooter.team === 'left') scoreBlue++;
              else scoreRed++;
            }
            spawnPlayer(p);
          }
          bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  const timeLeft = gameStarted ? Math.max(0, Math.floor((gameDuration - (now - gameStartTime)) / 1000)) : 0;
  io.emit('gameState', {
    players, bullets, scoreBlue, scoreRed,
    gameTimer: timeLeft,
    gameOver: !gameStarted && gameStartTime !== null && now - gameStartTime >= gameDuration
  });
}, 1000 / 60);

// ----------------------------------
// 6) Express Routes & HTML Pages
// ----------------------------------

// A) PC Game Screen
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Team Game - PC Screen</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#000; color:#fff; font-family:sans-serif; position:relative; }
    #gameCanvas { display:block; background:#000; }
    #qrModal {
      position:fixed; top:0; left:0; right:0; bottom:0;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.8); z-index:9999;
    }
    #qrContainer { background:#222; padding:20px; border-radius:8px; text-align:center; }
    #closeModal, #setGameTimeButton {
      color:#fff; background:#f00; border:none; font-size:18px;
      margin-top:10px; padding:8px 12px; border-radius:4px; cursor:pointer;
    }
    #gameTimeInput {
      font-size:16px; padding:5px; margin-top:10px;
      width: 80px; text-align:center;
    }
    #overlay {
      position:absolute; top:0; left:0; width:100%; text-align:center;
      padding:10px; font-size:24px; background:rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <div id="qrModal">
    <div id="qrContainer">
      <h2>Scan to Join</h2>
      <canvas id="qrCode"></canvas>
      <br>
      <label for="gameTimeInput">Game Time (minutes):</label>
      <input type="number" id="gameTimeInput" value="10" min="1">
      <br>
      <button id="setGameTimeButton">Set Game Time</button>
      <br>
      <button id="closeModal">Close & Start Game</button>
    </div>
  </div>
  <div id="overlay">
    <span id="timer">Time: 0s</span> | 
    <span id="scoreboard">Blue: 0 - Red: 0</span>
  </div>
  <canvas id="gameCanvas"></canvas>
  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
  <script>
    const socket = io();
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    function resizeCanvas(){
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      socket.emit('canvasDimensions', { width: canvas.width, height: canvas.height });
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    const joinURL = '${joinURL}';
    QRCode.toCanvas(document.getElementById('qrCode'), joinURL, (err) => {
      if (err) console.error(err);
      console.log('QR code for:', joinURL);
    });
    document.getElementById('setGameTimeButton').addEventListener('click', () => {
      const minutes = document.getElementById('gameTimeInput').value;
      socket.emit('setGameTime', minutes);
    });
    document.getElementById('closeModal').addEventListener('click', () => {
      document.getElementById('qrModal').style.display = 'none';
      socket.emit('startGame');
    });
    let players = {}, bullets = [], scoreBlue = 0, scoreRed = 0, gameTimer = 0;
    socket.on('gameState', (data) => {
      players = data.players;
      bullets = data.bullets;
      scoreBlue = data.scoreBlue;
      scoreRed = data.scoreRed;
      gameTimer = data.gameTimer;
      drawGame();
      document.getElementById('timer').innerText = 'Time: ' + gameTimer + 's';
      document.getElementById('scoreboard').innerText = 'Blue: ' + scoreBlue + ' - Red: ' + scoreRed;
      if(data.gameOver){
        document.getElementById('overlay').innerText = 'Game Over';
      }
    });
    function drawGame(){
      ctx.clearRect(0,0,canvas.width, canvas.height);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = 'blue';
      ctx.fillRect(0,0,canvas.width/2, canvas.height);
      ctx.fillStyle = 'red';
      ctx.fillRect(canvas.width/2, 0, canvas.width/2, canvas.height);
      ctx.globalAlpha = 1.0;
      bullets.forEach(b => {
        ctx.beginPath();
        const bulletRadius = 5 + (b.damage - 1) * 2;
        ctx.arc(b.x, b.y, bulletRadius, 0, Math.PI*2);
        ctx.fillStyle = b.color;
        ctx.fill();
      });
      for (let id in players) {
        const p = players[id];
        if (p.shield > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI*2);
          ctx.strokeStyle = 'cyan';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        ctx.fillStyle = p.fillColor;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = p.borderColor;
        ctx.stroke();
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(\`Lv:\${p.level} L:\${p.lives} S:\${p.shield}\`, p.x, p.y - p.radius - 10);
      }
    }
  </script>
</body>
</html>
  `);
});

// B) Mobile Controller Screen
app.get('/controller', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Team Game - Controller</title>
  <style>
    html, body {
      margin:0; padding:0; font-family: Arial, sans-serif;
      background: #333; color: #fff;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100vh;
    }
    #header {
      width: 90%; max-width: 400px;
      background: rgba(0,0,0,0.8);
      padding: 10px 15px; border-radius: 8px;
      text-align: center; margin-bottom: 10px; font-size: 16px;
    }
    #joystickContainer {
      position: relative; width: 200px; height: 200px;
      border: 4px solid #555; border-radius: 50%;
      background: #444; display: flex;
      align-items: center; justify-content: center;
      margin-bottom: 10px; touch-action: none;
      transition: border-color 0.3s, background 0.3s;
    }
    #knob {
      position: absolute; width: 50px; height: 50px;
      background: #ff0; border-radius: 50%;
      transform: translate(-25px, -25px); transition: transform 0.1s;
    }
    #upgradeContainer {
      width: 90%; max-width: 400px;
      background: rgba(0,0,0,0.8); padding: 10px;
      border-radius: 8px; text-align: center; margin-top: 8px;
    }
    #upgradeSelect {
      width: 70%; padding: 8px; font-size: 14px;
      border-radius: 4px; border: none;
    }
    #upgradeButton {
      width: 25%; padding: 8px; font-size: 14px;
      margin-left: 5px; border-radius: 4px; border: none;
      background: #008CBA; color: #fff; cursor: pointer;
      transition: background 0.2s;
    }
    #upgradeButton:hover {
      background: #005f73;
    }
  </style>
</head>
<body>
  <div id="header">
    <div id="playerStats">Loading...</div>
  </div>
  <div id="joystickContainer">
    <div id="knob"></div>
  </div>
  <div id="upgradeContainer" style="display:none;">
    <select id="upgradeSelect"></select>
    <button id="upgradeButton">Select Upgrade</button>
  </div>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    socket.emit('joinAsController');
    let myPlayer = null;
    const upgradeOptions = {
      moreDamage: { label: "Damage", max: 2 },
      diagonalBullets: { label: "Diagonal", max: 2 },
      shield: { label: "Shield", max: 3 },
      moreBullets: { label: "More Bullets", max: 4 },
      bulletSpeed: { label: "Bullet Speed", max: 3 }
    };
    socket.on('playerInfo', (p) => {
      myPlayer = p;
      updateStats();
      updateJoystickColor();
      updateUpgradeDropdown();
    });
    socket.on('gameState', (data) => {
      if (data.players[socket.id]) {
        myPlayer = data.players[socket.id];
        updateStats();
        updateUpgradeDropdown();
      }
    });
    function updateStats() {
      const statsDiv = document.getElementById('playerStats');
      if (!myPlayer) return;
      const bps = (1000 / myPlayer.bulletCooldown).toFixed(1);
      statsDiv.innerHTML =
        \`Lv: \${myPlayer.level} | EXP: \${myPlayer.exp.toFixed(1)} | UP: \${myPlayer.upgradePoints}<br>\` +
        \`L: \${myPlayer.lives} | DMG: \${myPlayer.bulletDamage} | SH: \${myPlayer.shield}<br>\` +
        \`SPD: \${myPlayer.bulletSpeed} | BPS: \${bps}\`;
      document.getElementById('upgradeContainer').style.display = (myPlayer.upgradePoints > 0) ? 'block' : 'none';
    }
    function updateJoystickColor() {
      const container = document.getElementById('joystickContainer');
      if (myPlayer) {
        if (myPlayer.team === 'left') {
          container.style.borderColor = '#007BFF';
          container.style.background = '#0056b3';
        } else {
          container.style.borderColor = '#FF4136';
          container.style.background = '#d62d20';
        }
      }
    }
    function updateUpgradeDropdown() {
      const select = document.getElementById('upgradeSelect');
      select.innerHTML = "";
      if (!myPlayer) return;
      for (let key in upgradeOptions) {
        const option = upgradeOptions[key];
        if (myPlayer.upgrades[key] < option.max) {
          const opt = document.createElement('option');
          opt.value = key;
          opt.text = option.label + " (" + (myPlayer.upgrades[key] || 0) + "/" + option.max + ")";
          select.appendChild(opt);
        }
      }
      if (select.options.length === 0) {
        document.getElementById('upgradeContainer').style.display = 'none';
      }
    }
    document.getElementById('upgradeButton').addEventListener('click', () => {
      const select = document.getElementById('upgradeSelect');
      const option = select.value;
      if (option) {
        socket.emit('upgrade', option);
      }
    });
    // Joystick handling.
    const container = document.getElementById('joystickContainer');
    const knob = document.getElementById('knob');
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;
    const maxRadius = 70;
    let dragging = false;
    function pointerDown(e) {
      dragging = true;
      moveKnob(e);
    }
    function pointerMove(e) {
      if (dragging) moveKnob(e);
    }
    function pointerUp() { dragging = false; }
    function moveKnob(e) {
      const rect = container.getBoundingClientRect();
      let cx, cy;
      if (e.touches) {
        cx = e.touches[0].clientX - rect.left;
        cy = e.touches[0].clientY - rect.top;
      } else {
        cx = e.clientX - rect.left;
        cy = e.clientY - rect.top;
      }
      let dx = cx - centerX;
      let dy = cy - centerY;
      let dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > maxRadius) {
        dx = (dx/dist) * maxRadius;
        dy = (dy/dist) * maxRadius;
      }
      knob.style.transform = \`translate(\${dx + centerX - 25}px, \${dy + centerY - 25}px)\`;
      const angleDeg = Math.atan2(dy, dx) * (180/Math.PI);
      socket.emit('updateAngle', angleDeg);
    }
    container.addEventListener('mousedown', pointerDown);
    container.addEventListener('mousemove', pointerMove);
    container.addEventListener('mouseup', pointerUp);
    container.addEventListener('mouseleave', pointerUp);
    container.addEventListener('touchstart', pointerDown, {passive:false});
    container.addEventListener('touchmove', pointerMove, {passive:false});
    container.addEventListener('touchend', pointerUp);
    container.addEventListener('touchcancel', pointerUp);
  </script>
</body>
</html>
  `);
});

// ----------------------------------
// 7) Start Server
// ----------------------------------
server.listen(PORT, () => {
  console.log(`Server running at http://${localIp}:${PORT}`);
  console.log(`QR join link: ${joinURL}`);
});
