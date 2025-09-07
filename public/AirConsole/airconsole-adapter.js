// airconsole-adapter.js
export function makeAirAdapter(airconsole) {
  const listeners = {};
  // Screen: broadcast to all controllers
  function emit(type, payload) {
    airconsole.broadcast({ type, payload });
  }
  // Screen: reply to one device
  function emitTo(device_id, type, payload) {
    airconsole.message(device_id, { type, payload });
  }
  // Both sides: on(...)
  function on(type, handler) {
    (listeners[type] ||= []).push(handler);
  }
  // Wire AirConsole messages -> our listeners
  airconsole.onMessage = (from, data) => {
    if (!data || !data.type) return;
    (listeners[data.type] || []).forEach(h => h({ from, ...data.payload }));
  };

  return { emit, emitTo, on, airconsole };
}
