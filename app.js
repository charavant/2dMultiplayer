// app.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const os = require('os');
const bonjour = require('bonjour')();  // Advertise service via mDNS

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

// Advertise the game service with a friendly name.
bonjour.publish({ name: 'MyTeamGame', type: 'http', port: PORT });
console.log(`Broadcasting as "MyTeamGame" on port ${PORT}`);

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
function fireBullets(player) {
  const count = 1 + player.upgrades.moreBullets;
  let spread = 10;
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
  if (player.diagonalBullets) {
    createBulletWithAngle(player, (player.team === 'left') ? 30 : 150);
    createBulletWithAngle(player, (player.team === 'left') ? -30 : 210);
    if (player.diagonalBounce) {
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

  socket.on('canvasDimensions', (dims) => {
    canvasWidth = dims.width;
    canvasHeight = dims.height;
    io.emit('gameState', {
      players, bullets, scoreBlue, scoreRed,
      gameTimer: gameStarted ? Math.max(0, Math.floor((gameDuration - (Date.now()-gameStartTime))/1000)) : 0,
      gameOver: gameStarted && (Date.now()-gameStartTime >= gameDuration)
    });
  });

  socket.on('setGameTime', (minutes) => {
    const m = parseFloat(minutes);
    if (!isNaN(m) && m > 0) {
      gameDuration = m * 60 * 1000;
      console.log(`Game duration set to ${m} minutes.`);
    }
  });

  socket.on('startGame', () => {
    if (!gameStarted) {
      gameStarted = true;
      gameStartTime = Date.now();
      console.log('Game started!');
    }
  });

  // Mobile (or PC) controller joins via /controller route.
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
      bulletCooldown: 1000,
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
      gameTimer: gameStarted ? Math.max(0, Math.floor((gameDuration - (Date.now()-gameStartTime))/1000)) : 0,
      gameOver: false
    });
  });

  socket.on('updateAngle', (angleDeg) => {
    if (players[socket.id]) {
      players[socket.id].angle = angleDeg;
    }
  });

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
          if (p.upgrades.diagonalBullets === 1) p.diagonalBullets = true;
          else if (p.upgrades.diagonalBullets === 2) p.diagonalBounce = true;
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

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      console.log(`Player ${socket.id} disconnected.`);
      delete players[socket.id];
      io.emit('gameState', {
        players, bullets, scoreBlue, scoreRed,
        gameTimer: gameStarted ? Math.max(0, Math.floor((gameDuration - (Date.now()-gameStartTime))/1000)) : 0,
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
  if (gameStarted && now - gameStartTime >= gameDuration) {
    gameStarted = false;
  }
  for (const id in players) {
    const p = players[id];
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
    p.exp += 0.5 / 60;
    if (p.exp >= 10) {
      p.exp -= 10;
      p.level++;
      p.upgradePoints += 1;
      if (p.shieldMax > 0) p.shield = p.shieldMax;
    }
    if (gameStarted && now - p.lastShotTime >= p.bulletCooldown) {
      fireBullets(p);
      p.lastShotTime = now;
    }
  }
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
  const timeLeft = gameStarted ? Math.max(0, Math.floor((gameDuration - (now - gameStartTime))/1000)) : 0;
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
      width:80px; text-align:center;
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

// B) Mobile Controller Screen using Bootstrap with big upgrade buttons
app.get('/controller', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Team Game - Mobile Controller</title>
  <!-- Required meta tags for responsive design -->
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {
      background-color: #333;
      color: #fff;
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    /* Full-screen container */
    .controller-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 10px;
    }
    /* Stats grid on top */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .stats-card {
      background-color: rgba(0,0,0,0.8);
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      font-size: 14px;
    }
    /* Center the joystick in a fixed container */
    .joystick-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-grow: 1;
    }
    #joystickContainer {
      position: relative;
      width: 250px;
      height: 250px;
      border: 4px solid #555;
      border-radius: 50%;
      background-color: #444;
      touch-action: none;
      transition: border-color 0.3s, background-color 0.3s;
    }
    #knob {
      position: absolute;
      width: 60px;
      height: 60px;
      background-color: #ff0;
      border-radius: 50%;
      transform: translate(-30px, -30px);
      transition: transform 0.1s;
    }
    /* Upgrade buttons area */
    .upgrade-panel {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-top: 15px;
    }
    .upgrade-btn {
      flex: 1 1 45%;
      padding: 15px;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="controller-container container">
    <!-- Top: Stats grid -->
    <div class="stats-grid">
      <div class="stats-card" id="stat-level">Level: Loading...</div>
      <div class="stats-card" id="stat-exp">EXP: Loading...</div>
      <div class="stats-card" id="stat-up">Upgrade Points: Loading...</div>
      <div class="stats-card" id="stat-core">Lives: Loading... | DMG: Loading...</div>
      <div class="stats-card" id="stat-speed">Bullet Speed: Loading...</div>
      <div class="stats-card" id="stat-bps">Bullets/sec: Loading...</div>
    </div>
    <!-- Middle: Joystick -->
    <div class="joystick-wrapper">
      <div id="joystickContainer">
        <div id="knob"></div>
      </div>
    </div>
    <!-- Bottom: Upgrade buttons -->
    <div class="upgrade-panel" id="upgradePanel" style="display:none;">
      <button class="btn btn-primary upgrade-btn" data-upgrade="moreDamage">Damage</button>
      <button class="btn btn-primary upgrade-btn" data-upgrade="diagonalBullets">Diagonal</button>
      <button class="btn btn-primary upgrade-btn" data-upgrade="shield">Shield</button>
      <button class="btn btn-primary upgrade-btn" data-upgrade="moreBullets">More Bullets</button>
      <button class="btn btn-primary upgrade-btn" data-upgrade="bulletSpeed">Bullet Speed</button>
    </div>
  </div>
  
  <!-- Bootstrap JS Bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    // Immediately join as a controller.
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
      updateUpgradeButtons();
    });
    socket.on('gameState', (data) => {
      if (data.players[socket.id]) {
        myPlayer = data.players[socket.id];
        updateStats();
        updateUpgradeButtons();
      }
    });
    function updateStats() {
      if (!myPlayer) return;
      // EXP should only accumulate when the game starts.
      // (Assume the server only increments exp after game start.)
      document.getElementById('stat-level').innerText = "Level: " + myPlayer.level;
      document.getElementById('stat-exp').innerText = "EXP: " + myPlayer.exp.toFixed(1);
      document.getElementById('stat-up').innerText = "Upgrade Points: " + myPlayer.upgradePoints;
      document.getElementById('stat-core').innerText = "Lives: " + myPlayer.lives + " | DMG: " + myPlayer.bulletDamage;
      document.getElementById('stat-speed').innerText = "Bullet Speed: " + myPlayer.bulletSpeed;
      const bps = (1000 / myPlayer.bulletCooldown).toFixed(1);
      document.getElementById('stat-bps').innerText = "Bullets/sec: " + bps;
      document.getElementById('upgradePanel').style.display = (myPlayer.upgradePoints > 0) ? 'flex' : 'none';
    }
    function updateJoystickColor() {
      const container = document.getElementById('joystickContainer');
      if (myPlayer) {
        if (myPlayer.team === 'left') {
          container.style.borderColor = '#007BFF';
          container.style.backgroundColor = '#0056b3';
        } else {
          container.style.borderColor = '#FF4136';
          container.style.backgroundColor = '#d62d20';
        }
      }
    }
    function updateUpgradeButtons() {
      const buttons = document.querySelectorAll('.upgrade-btn');
      buttons.forEach(btn => {
        const key = btn.getAttribute('data-upgrade');
        if (myPlayer.upgrades[key] >= upgradeOptions[key].max) {
          btn.style.display = 'none';
        } else {
          btn.style.display = 'inline-block';
          btn.innerText = upgradeOptions[key].label + " (" + (myPlayer.upgrades[key] || 0) + "/" + upgradeOptions[key].max + ")";
        }
      });
    }
    document.querySelectorAll('.upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const option = btn.getAttribute('data-upgrade');
        socket.emit('upgrade', option);
      });
    });
    // Joystick handling.
    const container = document.getElementById('joystickContainer');
    const knob = document.getElementById('knob');
    const centerX = container.offsetWidth / 2;
    const centerY = container.offsetHeight / 2;
    const maxRadius = 70;
    let dragging = false;
    function pointerDown(e) { dragging = true; moveKnob(e); }
    function pointerMove(e) { if (dragging) moveKnob(e); }
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
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }
      knob.style.transform = 'translate(' + (dx + centerX - 30) + 'px, ' + (dy + centerY - 30) + 'px)';
      const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
      socket.emit('updateAngle', angleDeg);
    }
    container.addEventListener('mousedown', pointerDown);
    container.addEventListener('mousemove', pointerMove);
    container.addEventListener('mouseup', pointerUp);
    container.addEventListener('mouseleave', pointerUp);
    container.addEventListener('touchstart', pointerDown, { passive: false });
    container.addEventListener('touchmove', pointerMove, { passive: false });
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
