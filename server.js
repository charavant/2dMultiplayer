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
const joinURL = `http://${hostName}:${PORT}/controller`;
app.locals.joinURL = joinURL;

// Register routes
require('./src/controllers/gameController')(app);
require('./src/controllers/mobileController')(app);

// Initialize Socket.IO and game loop
initSocket(io);
startGameLoop(io);

// Start Bonjour service and HTTP server
publishService(localIp, PORT);

server.listen(PORT, () => {
  console.log(`Server running at http://${hostName}:${PORT}`);
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
