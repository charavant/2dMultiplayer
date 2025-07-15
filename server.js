// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const { getLocalIp, publishService, stopService } = require('./src/services/networkService');
const { initSocket } = require('./src/services/socketHandler');
const { startGameLoop, stopGameLoop } = require('./src/services/gameLogic');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Set view engine to EJS (our view files have been renamed to .ejs)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Compute joinURL (to be used in the game screen)
const PORT = process.env.PORT || 3000;
const localIp = getLocalIp();
const hostName = 'space-battle-pong.local';
const baseURL = `http://${localIp}:${PORT}`;
app.locals.baseURL = baseURL;
app.locals.joinURL = `${baseURL}/space-battle/controller`;

// Home page
app.get('/', (req, res) => {
  res.render('home');
});

// Register routes
require('./src/controllers/gameController')(app);
require('./src/controllers/mobileController')(app);
require('./src/controllers/pcController')(app);

// Initialize Socket.IO and game loop
initSocket(io);
startGameLoop(io);

// Endpoint to gracefully shutdown the game
app.post('/exit', (req, res) => {
  res.send('Shutting down');
  // Give the response time to be sent before closing everything
  setTimeout(shutdown, 100);
});

// Start Bonjour service and HTTP server
publishService(localIp, PORT, hostName);

server.listen(PORT, () => {
  console.log(`Server running at http://${localIp}:${PORT}`);
  console.log(`Broadcast address: http://${hostName}:${PORT}`);
  console.log(`PC controller URL: http://${localIp}:${PORT}/space-battle/pc`);
});

// Graceful shutdown function
function shutdown() {
  console.log('Shutting down gracefully...');
  stopService(() => {
    stopGameLoop();
    io.close(() => {
      console.log('Socket.IO connections closed.');
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
