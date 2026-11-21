// SHADOW PROTOCOL — boot and the one loop: input each frame, the world
// advances in fixed 1/60 s steps, the renderer paints what is there.
// Screens: title, playing, paused, caught, level complete, game complete.
// ?shot=cover|patrol|alert|exit stages a frozen scene for a screenshot
// instead of running the loop, and sets window.__shotReady when painted.
window.SP = window.SP || {};

SP.main = (function () {
  'use strict';

  const U = SP.util;
  const STEP = 1 / 60;
  const MAX_FRAME = 0.25;
  const LEVEL_PARS = [75, 110, 150]; // seconds: the S-rating bar per floor
  const ALARM_COOLDOWN = 3; // seconds out of sight before the alarm cools

  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');

  const game = {
    screen: 'title', // title | playing | paused | caught | levelComplete | gameComplete
    levelIndex: 0,
    level: null,
    player: null,
    guards: [],
    coin: null, // the thrown coin, while it flies and rings
    time: 0,
    totalTime: 0,
    totalSpotted: 0,
    spotted: 0, // alarms tripped on this level
    alarm: false,
    alarmTimer: 0,
    outOfSightTimer: 0,
    message: '',
    messageTimer: 0,
    messageColor: '#e8ecf4',
    lastLevelStats: null,
    finalRating: 'C',
    frozen: false, // staged screenshot: paint, never update
  };
  // The test harness and the screenshot stager read the game through this.
  window.SP.game = game;

  function announce(msg) { if (status) status.textContent = msg; }

  function showMessage(msg, color, seconds) {
    game.message = msg;
    game.messageColor = color || '#e8ecf4';
    game.messageTimer = seconds || 2;
  }

  function loadLevel(index) {
    game.levelIndex = index;
    game.level = SP.levels.parseLevel(index);
    game.player = SP.player.create(game.level);
    game.guards = SP.guards.createAll(game.level);
    game.coin = null;
    game.time = 0;
    game.spotted = 0;
    game.alarm = false;
    game.alarmTimer = 0;
    game.outOfSightTimer = 0;
    game.message = '';
    game.messageTimer = 0;
  }

  function startRun() {
    game.totalTime = 0;
    game.totalSpotted = 0;
    loadLevel(0);
    game.screen = 'playing';
    announce('Playing. Stay out of the cones.');
  }

  function retryLevel() {
    loadLevel(game.levelIndex);
    game.screen = 'playing';
    announce('Retrying ' + game.level.name + '.');
  }

  function nextLevel() {
    if (game.levelIndex + 1 >= SP.levels.count) {
      game.finalRating = SP.hud.rateRun(game.totalTime, game.totalSpotted);
      game.screen = 'gameComplete';
      SP.audio.levelDone();
      announce('Ghost run complete. Rating ' + game.finalRating + '.');
      return;
    }
    loadLevel(game.levelIndex + 1);
    game.screen = 'playing';
    announce('Playing ' + game.level.name + '.');
  }

  function tripAlarm() {
    game.alarm = true;
    game.alarmTimer = 0;
    game.outOfSightTimer = 0;
    game.spotted += 1;
    game.totalSpotted += 1;
    SP.audio.startAlarm();
    showMessage('ALARM! BREAK LINE OF SIGHT!', '#ff2e2e', 2.5);
    announce('Alarm! Break line of sight and hide.');
  }

  function coolAlarm() {
    game.alarm = false;
    SP.audio.stopAlarm();
    SP.guards.calmAll(game.guards);
    showMessage('ALARM COOLED — THEY LOST YOU', '#35e0c8', 2);
    announce('Alarm cooled. They lost you.');
  }

  function step(dt) {
    if (game.screen !== 'playing' || game.frozen) return;
    game.time += dt;
    game.totalTime += dt;
    if (game.messageTimer > 0) game.messageTimer -= dt;

    const events = { keycard: false, exit: false, coin: null };
    const pEvents = SP.player.update(game.player, dt, game.level, SP.input, SP.audio);
    if (pEvents.coin) game.coin = { x: pEvents.coin.x, y: pEvents.coin.y, timer: pEvents.coin.timer, landed: false, ring: 0 };

    // The thrown coin: it lands, rings, and pulls nearby guards over.
    if (game.coin) {
      game.coin.timer -= dt;
      if (game.coin.timer <= 0 && !game.coin.landed) {
        game.coin.landed = true;
        game.coin.ring = 6;
        SP.audio.coinLand();
        game.guards.forEach(function (g) { SP.guards.hearNoise(g, game.coin.x, game.coin.y, 230); });
      }
      if (game.coin.landed) {
        game.coin.ring += 90 * dt;
        if (game.coin.ring > 230) game.coin = null;
      }
    }

    // Walking loud carries: guards in earshot turn curious.
    if (game.player.moving && !game.player.sneaking) {
      game.guards.forEach(function (g) {
        if (g.state === 'patrol' && U.dist(g.x, g.y, game.player.x, game.player.y) < 70) {
          SP.guards.hearNoise(g, game.player.x, game.player.y, 70);
        }
      });
    }

    const guardEvents = [];
    game.guards.forEach(function (g) {
      SP.guards.update(g, dt, game.level, game.player, SP.audio, guardEvents);
    });
    guardEvents.forEach(function (ev) {
      if (ev.type === 'nearMiss') showMessage('NEAR MISS — HE SAW SOMETHING!', '#ffd94a', 1.6);
      if (ev.type === 'alarm' && !game.alarm) tripAlarm();
    });

    // The alarm cools only after you stay unseen for a while.
    if (game.alarm) {
      const anySees = game.guards.some(function (g) { return g.seesPlayer; });
      if (anySees) game.outOfSightTimer = 0;
      else game.outOfSightTimer += dt;
      if (game.outOfSightTimer >= ALARM_COOLDOWN) coolAlarm();
    }

    // Caught: a guard in full alarm touches you. The floor resets.
    if (game.alarm) {
      const caught = game.guards.some(function (g) {
        return g.state === 'alert' && U.dist(g.x, g.y, game.player.x, game.player.y) < 26;
      });
      if (caught) {
        SP.audio.stopAlarm();
        SP.audio.caught();
        game.screen = 'caught';
        announce('Caught. Press Space to retry the level.');
        return;
      }
    }

    if (pEvents.keycard) {
      showMessage('KEYCARD SECURED — GET TO THE EXIT', '#2fd47c', 2.5);
      announce('Keycard secured. Reach the exit.');
    }
    if (pEvents.exit) {
      game.lastLevelStats = {
        time: game.time,
        spotted: game.spotted,
        rating: SP.hud.rateLevel(game.time, game.spotted, LEVEL_PARS[game.levelIndex]),
      };
      SP.audio.stopAlarm();
      SP.audio.levelDone();
      game.screen = 'levelComplete';
      announce('Floor clear. Rating ' + game.lastLevelStats.rating + '.');
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(game.level.ox, game.level.oy);
    SP.render.draw(ctx, game);
    ctx.restore();
    SP.hud.drawTopBar(ctx, game);
    SP.hud.drawMinimap(ctx, game);
    SP.hud.drawMessage(ctx, game);
    if (game.screen === 'title') SP.hud.drawTitle(ctx, game);
    else if (game.screen === 'paused') SP.hud.drawPaused(ctx);
    else if (game.screen === 'caught') SP.hud.drawCaught(ctx, game);
    else if (game.screen === 'levelComplete') SP.hud.drawLevelComplete(ctx, game);
    else if (game.screen === 'gameComplete') SP.hud.drawGameComplete(ctx, game);
  }

  function handleKeys() {
    if (SP.input.wasPressed('KeyM')) SP.audio.setMuted(!SP.audio.isMuted());
    if (game.screen === 'title') {
      if (SP.input.wasPressed('Space') || SP.input.wasPressed('Enter') || SP.input.takeClick()) startRun();
    } else if (game.screen === 'playing') {
      if (SP.input.wasPressed('KeyP') || SP.input.wasPressed('Escape')) {
        game.screen = 'paused';
        announce('Paused.');
      }
    } else if (game.screen === 'paused') {
      if (SP.input.wasPressed('KeyP') || SP.input.wasPressed('Escape') || SP.input.wasPressed('Space')) {
        game.screen = 'playing';
        announce('Playing.');
      }
    } else if (game.screen === 'caught') {
      if (SP.input.wasPressed('Space') || SP.input.wasPressed('Enter')) retryLevel();
    } else if (game.screen === 'levelComplete') {
      if (SP.input.wasPressed('Space') || SP.input.wasPressed('Enter')) nextLevel();
    } else if (game.screen === 'gameComplete') {
      if (SP.input.wasPressed('Space') || SP.input.wasPressed('Enter')) startRun();
    }
  }

  function runShot(name) {
    SP.shots.stage(name, game, loadLevel);
    game.frozen = true;
    let painted = 0;
    (function paint() {
      draw();
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else window.__shotReady = true;
    })();
  }

  function runGame() {
    SP.input.attach(canvas);
    loadLevel(0);
    let accumulator = 0;
    let last = performance.now();
    announce('Shadow Protocol. Press Space or click to start.');

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && game.screen === 'playing') {
        game.screen = 'paused';
        announce('Paused.');
      }
    });

    function frame(now) {
      requestAnimationFrame(frame);
      accumulator += Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      handleKeys();
      if (game.screen === 'playing') {
        while (accumulator >= STEP) {
          step(STEP);
          accumulator -= STEP;
          if (game.screen !== 'playing') { accumulator = 0; break; }
        }
      } else {
        accumulator = 0;
      }
      if (game.messageTimer > 0 && game.screen !== 'playing') game.messageTimer -= 1 / 60;
      draw();
      SP.input.endFrame();
    }
    requestAnimationFrame(frame);
  }

  if (shotName) runShot(shotName);
  else runGame();

  return { game: game };
})();
