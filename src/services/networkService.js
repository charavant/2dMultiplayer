// src/services/networkService.js
const os = require('os');
let bonjour;

let publishedService;

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

function publishService(localIp, port) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    if (!bonjour) {
      bonjour = require('bonjour')();
    }
    // Advertise the service with a friendly name
    publishedService = bonjour.publish({ name: 'Space Battle Pong', type: 'http', port });
    publishedService.on('error', (err) => {
      console.error('Bonjour service error:', err.message);
    });
    console.log(`Broadcasting as "Space Battle Pong" on port ${port}`);
  } catch (err) {
    console.warn('Bonjour service not started:', err.message);
  }
}

function stopService(callback) {
  if (publishedService) {
    publishedService.stop(() => {
      console.log('Stopped Bonjour service.');
      if (callback) callback();
    });
  } else {
    if (callback) callback();
  }
}

module.exports = { getLocalIp, publishService, stopService };
