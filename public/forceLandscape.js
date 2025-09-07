// Minimal, dependency-free landscape enforcement for mobile
(function(){
  function createOverlay(){
    var overlay = document.createElement('div');
    overlay.id = 'orientationOverlayGlobal';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.92)';
    overlay.style.color = '#e0e9ff';
    overlay.style.fontFamily = "Orbitron, sans-serif";
    overlay.style.zIndex = '2147483647';
    overlay.style.textAlign = 'center';
    overlay.innerHTML = '<div style="max-width:80%;font-size:1.25rem;line-height:1.6"><div style="font-size:4rem">\uD83D\uDD04</div><div>Please rotate your device to <b>landscape</b></div></div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function requestFullscreen(){
    try {
      var el = document.documentElement;
      var p = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (p) {
        var ret = p.call(el);
        if (ret && typeof ret.catch === 'function') ret.catch(function(){});
      }
    } catch {}
  }

  function isFullscreen(){
    try {
      return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    } catch { return false; }
  }

  function autoFullscreenAllowed(){
    try { return !(window.__suppressAutoFSUntil) || Date.now() >= window.__suppressAutoFSUntil; } catch { return true; }
  }

  function isPortrait(){
    try { return window.matchMedia('(orientation: portrait)').matches; } catch { return (window.innerHeight > window.innerWidth); }
  }

  function ensureLock(){
    try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(function(){}); } catch {}
  }

  function update(){
    if(!overlay){ return; }
    // Attempt to keep orientation lock; request fullscreen only when allowed
    ensureLock();
    if(autoFullscreenAllowed() && !isFullscreen()){
      requestFullscreen();
    }
    if(isPortrait()){
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
    }
  }

  var overlay = null;
  function init(){
    if(overlay) return;
    overlay = document.getElementById('orientationOverlayGlobal') || createOverlay();
    update();
    // Attempt fullscreen immediately on load (only if allowed)
    if(autoFullscreenAllowed()) requestFullscreen();
    // Also attempt shortly after to catch layout stabilization
    setTimeout(function(){ if(autoFullscreenAllowed()) requestFullscreen(); }, 250);
    setTimeout(ensureLock, 200);
    // Keep trying to enforce lock periodically
    var lockTimer = setInterval(ensureLock, 1500);
    window.addEventListener('beforeunload', function(){ try { clearInterval(lockTimer); } catch {} });
    document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible'){ update(); } });
    // Fallback: on first interaction, try again
    var once = function(){
      if(autoFullscreenAllowed() && !isFullscreen()) requestFullscreen();
      ensureLock();
      window.removeEventListener('pointerdown', once);
      window.removeEventListener('keydown', once);
      window.removeEventListener('touchstart', once, { passive: true });
    };
    window.addEventListener('pointerdown', once);
    window.addEventListener('keydown', once);
    window.addEventListener('touchstart', once, { passive: true });
  }

  window.addEventListener('orientationchange', update);
  window.addEventListener('resize', update);
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('webkitfullscreenchange', update);
  window.addEventListener('load', function(){ init(); });
})();


