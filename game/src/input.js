// SHADOW PROTOCOL — keyboard and mouse input, kept in one place so the
// game loop reads a single snapshot each frame. WASD or arrows move,
// Shift sneaks, click throws a coin, P or Escape pauses, M mutes.
window.SP = window.SP || {};

SP.input = (function () {
  'use strict';

  const keys = {};
  let click = null; // {x, y} in canvas pixels, consumed by the game loop
  let pressed = {}; // keys pressed since last frame (edge-triggered)

  function isDown(code) { return !!keys[code]; }

  function moveVector() {
    let x = 0, y = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x: x, y: y };
  }

  function sneaking() { return !!(keys.ShiftLeft || keys.ShiftRight); }

  function takeClick() {
    const c = click;
    click = null;
    return c;
  }

  // True once for the frame in which the key went down.
  function wasPressed(code) { return !!pressed[code]; }

  function endFrame() { pressed = {}; }

  function attach(canvas) {
    window.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
      if (!keys[e.code]) pressed[e.code] = true;
      keys[e.code] = true;
      SP.audio.unlock();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    window.addEventListener('blur', function () {
      for (const k in keys) keys[k] = false;
    });
    canvas.addEventListener('mousedown', function (e) {
      const rect = canvas.getBoundingClientRect();
      click = {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
      SP.audio.unlock();
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  return { attach: attach, isDown: isDown, moveVector: moveVector,
    sneaking: sneaking, takeClick: takeClick, wasPressed: wasPressed,
    endFrame: endFrame };
})();
