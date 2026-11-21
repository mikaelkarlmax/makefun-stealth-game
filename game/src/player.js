// SHADOW PROTOCOL — the player: movement, sneaking, the coin distraction,
// hiding in bushes, grabbing the keycard and reaching the exit.
// The player is a circle in level space; the renderer draws the hooded figure.
window.SP = window.SP || {};

SP.player = (function () {
  'use strict';

  const U = SP.util;
  const WALK_SPEED = 150;
  const SNEAK_SPEED = 78;
  const RADIUS = 13;
  const COIN_COOLDOWN = 4;
  const COIN_NOISE_RADIUS = 230;
  const MAX_COINS = 3;

  function create(level) {
    return {
      x: level.playerStart.x,
      y: level.playerStart.y,
      r: RADIUS,
      angle: 0, // facing, radians; follows movement
      moving: false,
      sneaking: false,
      hidden: false, // inside a bush and still or sneaking
      hasKeycard: false,
      coins: MAX_COINS,
      coinCooldown: 0,
      stepTimer: 0,
      noise: 0, // current noise radius, for the HUD ring
    };
  }

  // One frame of player logic. Returns event flags for the game loop:
  // { keycard: bool, exit: bool, coin: {x,y} | null }.
  function update(p, dt, level, input, audio) {
    const events = { keycard: false, exit: false, coin: null };
    const mv = input.moveVector();
    p.sneaking = input.sneaking();
    p.moving = mv.x !== 0 || mv.y !== 0;
    const speed = p.sneaking ? SNEAK_SPEED : WALK_SPEED;
    if (p.moving) {
      p.angle = Math.atan2(mv.y, mv.x);
      U.moveCircle(level, p, mv.x * speed * dt, mv.y * speed * dt);
      // Footsteps: quiet and slow while sneaking, loud while walking.
      p.stepTimer -= dt;
      if (p.stepTimer <= 0) {
        p.stepTimer = p.sneaking ? 0.55 : 0.34;
        audio.playerStep(p.sneaking);
      }
      p.noise = p.sneaking ? 0 : 70;
    } else {
      p.noise = 0;
    }

    // Hiding: a bush swallows you only while you sneak or stand still.
    const tx = Math.floor(p.x / level.tile), ty = Math.floor(p.y / level.tile);
    p.hidden = U.isBush(level, tx, ty) && (p.sneaking || !p.moving);

    // Coin distraction: click anywhere, the coin flies there, lands with a
    // clink, and every guard in earshot comes to look.
    p.coinCooldown = Math.max(0, p.coinCooldown - dt);
    const click = input.takeClick();
    if (click && p.coins > 0 && p.coinCooldown <= 0) {
      const lx = click.x - level.ox, ly = click.y - level.oy;
      if (lx >= 0 && lx <= level.width && ly >= 0 && ly <= level.height) {
        p.coins -= 1;
        p.coinCooldown = COIN_COOLDOWN;
        audio.coinToss();
        events.coin = { x: lx, y: ly, r: COIN_NOISE_RADIUS, timer: 0.35, landed: false };
      }
    }

    // Keycard pickup.
    const k = level.keycard;
    if (k && !k.taken && U.dist(p.x, p.y, k.x, k.y) < 30) {
      k.taken = true;
      p.hasKeycard = true;
      audio.pickup();
      events.keycard = true;
    }

    // Exit: only opens with the keycard in hand.
    const e = level.exit;
    if (e && p.hasKeycard && U.dist(p.x, p.y, e.x, e.y) < 30) {
      events.exit = true;
    }
    return events;
  }

  return { create: create, update: update, MAX_COINS: MAX_COINS,
    COIN_COOLDOWN: COIN_COOLDOWN };
})();
