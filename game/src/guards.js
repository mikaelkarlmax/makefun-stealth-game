// SHADOW PROTOCOL — the guards: patrol routes you can learn, vision cones
// that react, and a five-state AI: patrol, suspicious, alert, investigate,
// return. Detection is a meter, not a switch: you get a chance to recover.
window.SP = window.SP || {};

SP.guards = (function () {
  'use strict';

  const U = SP.util;
  const VIEW_RANGE = 255;
  const VIEW_HALF_ANGLE = 0.61; // ~35 degrees each side
  const NEAR_MISS_AT = 60;
  const ALARM_AT = 100;
  const DECAY_PER_SEC = 26;
  const LOSE_SIGHT_SECONDS = 2.5;
  const SCAN_SECONDS = 2.2;

  function create(def, level) {
    const start = U.tileCenter(level, def.path[0][0], def.path[0][1]);
    const next = U.tileCenter(level, def.path[1 % def.path.length][0], def.path[1 % def.path.length][1]);
    return {
      x: start.x, y: start.y, r: 14,
      angle: U.angleTo(start.x, start.y, next.x, next.y),
      baseSpeed: def.speed,
      path: def.path.map(function (w) { return U.tileCenter(level, w[0], w[1]); }),
      wpIndex: 1,
      waitTimer: 0,
      state: 'patrol', // patrol | suspicious | alert | investigate | return
      suspicion: 0,
      warned: false, // near-miss "!" already raised on this climb
      lastSeen: null,
      loseTimer: 0,
      investigateTarget: null,
      scanTimer: 0,
      scanDir: 1,
      stepTimer: 0,
      seesPlayer: false,
    };
  }

  function createAll(level) {
    return level.guardDefs.map(function (def) { return create(def, level); });
  }

  // Can this guard see the player right now? Range, cone, line of sight,
  // and a bush hides you while you sneak or stand still.
  function canSee(g, player, level) {
    if (player.hidden) return false;
    const d = U.dist(g.x, g.y, player.x, player.y);
    if (d > VIEW_RANGE) return false;
    const toPlayer = U.angleTo(g.x, g.y, player.x, player.y);
    if (Math.abs(U.angleDiff(g.angle, toPlayer)) > VIEW_HALF_ANGLE) return false;
    return U.lineOfSight(level, g.x, g.y, player.x, player.y);
  }

  function suspicionRate(g, player) {
    const d = U.dist(g.x, g.y, player.x, player.y);
    let rate = d < 90 ? 55 : d < 170 ? 32 : 18;
    if (player.moving && !player.sneaking) rate *= 1.4;
    else if (player.sneaking) rate *= 0.6;
    else if (!player.moving) rate *= 0.8;
    return rate;
  }

  function moveToward(g, level, tx, ty, speed, dt) {
    const d = U.dist(g.x, g.y, tx, ty);
    if (d < 4) return true;
    const want = U.angleTo(g.x, g.y, tx, ty);
    g.angle = U.turnToward(g.angle, want, 5.5 * dt);
    const step = Math.min(d, speed * dt);
    U.moveCircle(level, g, Math.cos(g.angle) * step, Math.sin(g.angle) * step);
    return U.dist(g.x, g.y, tx, ty) < 6;
  }

  function footstep(g, player, dt, audio) {
    g.stepTimer -= dt;
    if (g.stepTimer > 0) return;
    const speed = g.state === 'alert' ? g.baseSpeed * 1.75 : g.baseSpeed;
    g.stepTimer = 30 / speed;
    const d = U.dist(g.x, g.y, player.x, player.y);
    const pan = U.clamp((g.x - player.x) / 300, -1, 1);
    audio.guardStep(d, pan);
  }

  // A noise somewhere in the world: guards close enough come to look.
  function hearNoise(g, x, y, radius) {
    if (g.state === 'alert') return;
    if (U.dist(g.x, g.y, x, y) > radius) return;
    g.state = 'investigate';
    g.investigateTarget = { x: x, y: y };
    g.suspicion = Math.max(g.suspicion, 30);
    g.scanTimer = 0;
  }

  // One frame of guard logic. `events` collects { type, guard } entries for
  // the game loop: 'nearMiss' when suspicion first passes 60, 'alarm' at 100.
  function update(g, dt, level, player, audio, events) {
    const seen = canSee(g, player, level);
    g.seesPlayer = seen;

    if (seen) {
      g.suspicion = Math.min(ALARM_AT, g.suspicion + suspicionRate(g, player) * dt);
      g.lastSeen = { x: player.x, y: player.y };
      g.loseTimer = 0;
      if (g.suspicion >= NEAR_MISS_AT && !g.warned) {
        g.warned = true;
        audio.sting();
        events.push({ type: 'nearMiss', guard: g });
        if (g.state === 'patrol' || g.state === 'return') g.state = 'suspicious';
      }
      if (g.suspicion >= ALARM_AT && g.state !== 'alert') {
        g.state = 'alert';
        audio.alarmBlip();
        events.push({ type: 'alarm', guard: g });
      }
    } else {
      g.suspicion = Math.max(0, g.suspicion - DECAY_PER_SEC * dt);
      if (g.suspicion < NEAR_MISS_AT) g.warned = false;
      if (g.state === 'suspicious' && g.suspicion < 25) {
        g.state = 'return';
      }
    }

    switch (g.state) {
      case 'patrol': {
        if (g.waitTimer > 0) {
          g.waitTimer -= dt;
          // Scan the room while waiting at a waypoint: slow sweep.
          g.angle += g.scanDir * 0.9 * dt;
          if (g.waitTimer <= 0) g.scanDir *= -1;
          break;
        }
        const target = g.path[g.wpIndex % g.path.length];
        if (moveToward(g, level, target.x, target.y, g.baseSpeed, dt)) {
          g.wpIndex = (g.wpIndex + 1) % g.path.length;
          g.waitTimer = 1.1;
        }
        footstep(g, player, dt, audio);
        break;
      }
      case 'suspicious': {
        // Freeze and stare at the last thing that caught your eye.
        if (g.lastSeen) {
          g.angle = U.turnToward(g.angle, U.angleTo(g.x, g.y, g.lastSeen.x, g.lastSeen.y), 6 * dt);
        }
        break;
      }
      case 'alert': {
        const target = g.lastSeen || { x: player.x, y: player.y };
        if (seen) {
          moveToward(g, level, player.x, player.y, g.baseSpeed * 1.75, dt);
        } else {
          g.loseTimer += dt;
          if (moveToward(g, level, target.x, target.y, g.baseSpeed * 1.75, dt) || g.loseTimer > LOSE_SIGHT_SECONDS) {
            g.state = 'investigate';
            g.investigateTarget = target;
            g.scanTimer = SCAN_SECONDS;
          }
        }
        footstep(g, player, dt, audio);
        break;
      }
      case 'investigate': {
        const target = g.investigateTarget || g.lastSeen || { x: g.x, y: g.y };
        if (moveToward(g, level, target.x, target.y, g.baseSpeed * 1.3, dt)) {
          g.scanTimer -= dt;
          g.angle += 1.6 * dt; // look around the spot
          if (g.scanTimer <= 0) g.state = 'return';
        }
        footstep(g, player, dt, audio);
        break;
      }
      case 'return': {
        // Walk back to the nearest waypoint, then resume the patrol.
        let best = 0, bestD = Infinity;
        for (let i = 0; i < g.path.length; i++) {
          const d = U.dist(g.x, g.y, g.path[i].x, g.path[i].y);
          if (d < bestD) { bestD = d; best = i; }
        }
        if (moveToward(g, level, g.path[best].x, g.path[best].y, g.baseSpeed * 1.2, dt)) {
          g.wpIndex = (best + 1) % g.path.length;
          g.state = 'patrol';
          g.waitTimer = 0.4;
        }
        footstep(g, player, dt, audio);
        break;
      }
    }
  }

  // Calm every guard after an alarm cools down: they investigate the last
  // place they saw you, then go back to their routes.
  function calmAll(guards) {
    guards.forEach(function (g) {
      if (g.state === 'alert') {
        g.state = 'investigate';
        g.investigateTarget = g.lastSeen ? { x: g.lastSeen.x, y: g.lastSeen.y } : { x: g.x, y: g.y };
        g.scanTimer = SCAN_SECONDS;
      }
      g.suspicion = Math.min(g.suspicion, 40);
    });
  }

  function globalSuspicion(guards) {
    let m = 0;
    guards.forEach(function (g) { if (g.suspicion > m) m = g.suspicion; });
    return m;
  }

  function alertCount(guards) {
    let n = 0;
    guards.forEach(function (g) { if (g.state === 'alert') n++; });
    return n;
  }

  return { createAll: createAll, update: update, hearNoise: hearNoise,
    calmAll: calmAll, globalSuspicion: globalSuspicion,
    alertCount: alertCount, VIEW_RANGE: VIEW_RANGE,
    VIEW_HALF_ANGLE: VIEW_HALF_ANGLE, ALARM_AT: ALARM_AT };
})();
