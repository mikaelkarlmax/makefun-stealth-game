// SHADOW PROTOCOL — drawing only: the level, the guards and their vision
// cones, the player, cover and the exit. Cones are raycast-clipped by walls,
// so light stops where a wall does; patrol routes are drawn faintly, because
// a stealth game is fair only when you can learn the routes.
window.SP = window.SP || {};

SP.render = (function () {
  'use strict';

  const U = SP.util;
  const CONE_RAYS = 26;

  const COLORS = {
    floorA: '#1c2433',
    floorB: '#202a3c',
    wall: '#39445c',
    wallTop: '#5a6a8c',
    crate: '#6b4f2a',
    crateTop: '#8a6a3c',
    bush: '#1e4d2e',
    bushLeaf: '#2f7a44',
    keycard: '#ffd94a',
    exit: '#2fd47c',
    exitDark: '#0d5c34',
    player: '#0e1420',
    playerHood: '#35e0c8',
    guard: '#e5484d',
    guardDark: '#7f1d1d',
    route: 'rgba(120, 160, 255, 0.28)',
  };

  // Distance from (x, y) along `angle` until a solid tile or the range ends.
  function raycast(level, x, y, angle, maxDist) {
    const step = 6;
    for (let d = step; d <= maxDist; d += step) {
      const px = x + Math.cos(angle) * d, py = y + Math.sin(angle) * d;
      if (U.isSolid(level, Math.floor(px / level.tile), Math.floor(py / level.tile))) return d;
    }
    return maxDist;
  }

  function coneColor(g) {
    if (g.state === 'alert') return 'rgba(229, 72, 77, 0.42)';
    if (g.suspicion >= 60) return 'rgba(245, 120, 40, 0.38)';
    if (g.suspicion >= 30) return 'rgba(245, 190, 60, 0.34)';
    return 'rgba(255, 220, 90, 0.30)';
  }

  function drawFloor(ctx, level) {
    for (let ty = 0; ty < level.rows; ty++) {
      for (let tx = 0; tx < level.cols; tx++) {
        const t = level.grid[ty][tx];
        const x = tx * level.tile, y = ty * level.tile;
        ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(x, y, level.tile, level.tile);
        if (t === '#') {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x + 1, y + 1, level.tile - 2, level.tile - 2);
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(x + 1, y + 1, level.tile - 2, 5);
        } else if (t === 'C') {
          ctx.fillStyle = COLORS.crate;
          ctx.fillRect(x + 4, y + 4, level.tile - 8, level.tile - 8);
          ctx.fillStyle = COLORS.crateTop;
          ctx.fillRect(x + 4, y + 4, level.tile - 8, 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.strokeRect(x + 4, y + 4, level.tile - 8, level.tile - 8);
        } else if (t === 'B') {
          ctx.fillStyle = COLORS.bush;
          ctx.fillRect(x, y, level.tile, level.tile);
          ctx.fillStyle = COLORS.bushLeaf;
          ctx.beginPath();
          ctx.arc(x + 12, y + 14, 9, 0, Math.PI * 2);
          ctx.arc(x + 28, y + 12, 8, 0, Math.PI * 2);
          ctx.arc(x + 20, y + 28, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawRoute(ctx, g) {
    ctx.strokeStyle = COLORS.route;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    g.path.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCone(ctx, level, g) {
    const half = SP.guards.VIEW_HALF_ANGLE;
    const range = SP.guards.VIEW_RANGE;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    for (let i = 0; i <= CONE_RAYS; i++) {
      const a = g.angle - half + (2 * half * i) / CONE_RAYS;
      const d = raycast(level, g.x, g.y, a, range);
      ctx.lineTo(g.x + Math.cos(a) * d, g.y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fillStyle = coneColor(g);
    ctx.fill();
  }

  function drawGuard(ctx, g) {
    // Body: a red tabard over dark armour, facing tick for direction.
    ctx.fillStyle = COLORS.guardDark;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd9d9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * (g.r + 6), g.y + Math.sin(g.angle) * (g.r + 6));
    ctx.stroke();
    // State marker: "!" chases you, "?" is getting curious.
    if (g.state === 'alert') {
      ctx.fillStyle = '#ff2e2e';
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - g.r - 8);
    } else if (g.state === 'suspicious' || g.state === 'investigate') {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 24px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - g.r - 8);
    }
  }

  function drawPlayer(ctx, p) {
    // Hooded infiltrator: dark cloak, teal hood, facing wedge.
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.playerHood;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4);
    ctx.lineTo(p.x + Math.cos(p.angle + 2.5) * (p.r + 2), p.y + Math.sin(p.angle + 2.5) * (p.r + 2));
    ctx.lineTo(p.x + Math.cos(p.angle - 2.5) * (p.r + 2), p.y + Math.sin(p.angle - 2.5) * (p.r + 2));
    ctx.closePath();
    ctx.fill();
    // Sneak = crouched ring; hidden in a bush = leafy ring.
    if (p.hidden) {
      ctx.strokeStyle = COLORS.bushLeaf;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.sneaking) {
      ctx.strokeStyle = 'rgba(53, 224, 200, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawKeycard(ctx, level) {
    const k = level.keycard;
    if (!k || k.taken) return;
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
    ctx.save();
    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillStyle = COLORS.keycard;
    ctx.beginPath();
    ctx.arc(k.x, k.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = COLORS.keycard;
    ctx.fillRect(k.x - 9, k.y - 6, 18, 12);
    ctx.fillStyle = '#1a1a00';
    ctx.fillRect(k.x - 5, k.y - 2, 10, 4);
  }

  function drawExit(ctx, level, hasKeycard) {
    const e = level.exit;
    ctx.fillStyle = hasKeycard ? COLORS.exit : '#3a4a3a';
    ctx.fillRect(e.x - 16, e.y - 16, 32, 32);
    ctx.strokeStyle = hasKeycard ? '#a9ffce' : '#5a6a5a';
    ctx.lineWidth = 3;
    ctx.strokeRect(e.x - 16, e.y - 16, 32, 32);
    ctx.fillStyle = hasKeycard ? '#062b16' : '#9aa89a';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', e.x, e.y + 5);
    if (hasKeycard) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
      ctx.strokeStyle = 'rgba(47, 212, 124, ' + (0.4 + 0.4 * pulse) + ')';
      ctx.lineWidth = 3;
      ctx.strokeRect(e.x - 22, e.y - 22, 44, 44);
    }
  }

  function drawCoin(ctx, coin) {
    if (!coin) return;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6d00';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (coin.landed) {
      ctx.strokeStyle = 'rgba(255, 217, 74, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.ring, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawNoiseRing(ctx, p) {
    if (!p.moving || p.noise <= 0) return;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.noise, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Soft darkness with a lit pool around the player: what is safe reads
  // at a glance, what is far stays murky.
  function drawLighting(ctx, level, p) {
    const g = ctx.createRadialGradient(p.x, p.y, 60, p.x, p.y, 420);
    g.addColorStop(0, 'rgba(3, 5, 12, 0)');
    g.addColorStop(1, 'rgba(3, 5, 12, 0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, level.width, level.height);
  }

  // Paint the whole playfield (level space). The caller translates the
  // context by (level.ox, level.oy) first.
  function draw(ctx, game) {
    const level = game.level;
    drawFloor(ctx, level);
    drawKeycard(ctx, level);
    drawExit(ctx, level, game.player.hasKeycard);
    game.guards.forEach(function (g) { drawRoute(ctx, g); });
    game.guards.forEach(function (g) { drawCone(ctx, level, g); });
    game.guards.forEach(function (g) { drawGuard(ctx, g); });
    drawCoin(ctx, game.coin);
    drawNoiseRing(ctx, game.player);
    drawPlayer(ctx, game.player);
    // Bushes overhang the player: you really do disappear into them.
    for (let ty = 0; ty < level.rows; ty++) {
      for (let tx = 0; tx < level.cols; tx++) {
        if (level.grid[ty][tx] !== 'B') continue;
        const x = tx * level.tile, y = ty * level.tile;
        ctx.fillStyle = 'rgba(47, 122, 68, 0.55)';
        ctx.beginPath();
        ctx.arc(x + 12, y + 14, 9, 0, Math.PI * 2);
        ctx.arc(x + 28, y + 12, 8, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 28, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawLighting(ctx, level, game.player);
  }

  return { draw: draw, COLORS: COLORS };
})();
