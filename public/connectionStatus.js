function attachConnectionStatus(socket) {
  const status = document.createElement('div');
  status.className = 'connection-status';
  status.setAttribute('role', 'status');
  document.body.appendChild(status);
  function show(text, connected) {
    status.textContent = text;
    status.dataset.connected = String(connected);
  }
  show('Connecting…', false);
  socket.on('connect', () => show('Connected', true));
  socket.on('disconnect', () => show('Connection lost · reconnecting…', false));
  socket.on('connect_error', () => show('Server unavailable · retrying…', false));
}
