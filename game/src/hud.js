// SHADOW PROTOCOL — the HUD (suspicion meter, objectives, timer, coins),
// the minimap (guards, cones, player, exit, keycard) and every screen the
// game shows over the playfield: title, pause, level complete, caught and
// the final debrief with its S/A/B/C rating. All of it is drawn on the
// canvas, so the screenshots carry the numbers.
window.SP = window.SP || {};

SP.hud = (function () {
  'use strict';

  const U = SP.util;
  const FONT = '"Courier New", monospace';
  const TITLE_FONT = 'Georgia, serif';

  function text(ctx, s, x, y, size, color, align, font) {
    ctx.font = (font || 'bold ') + size + 'px ' + FONT;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }

  function suspicionColor(v) {
    if (v >= 100) return '#ff2e2e';
    if (v >= 60) return '#f57828';
    if (v >= 30) return '#f5be3c';
    return '#35e0c8';
  }

  function drawTopBar(ctx, game) {
    const W = 1280;
    ctx.fillStyle = '#0a0e18';
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = '#1c2433';
    ctx.fillRect(0, 56, W, 2);

    // Left: title + level.
    text(ctx, 'SHADOW PROTOCOL', 16, 24, 17, '#e8ecf4');
    text(ctx, game.level.name, 16, 46, 13, '#8a94a8');

    // Centre: the suspicion meter — the number that decides everything.
    const suspicion = SP.guards.globalSuspicion(game.guards);
    const bx = 470, bw = 340;
    text(ctx, 'DETECTION', bx - 8, 24, 13, '#8a94a8', 'right');
    ctx.fillStyle = '#141a28';
    ctx.fillRect(bx, 10, bw, 16);
    ctx.fillStyle = suspicionColor(suspicion);
    ctx.fillRect(bx, 10, bw * (suspicion / 100), 16);
    ctx.strokeStyle = '#3a4560';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, 10, bw, 16);
    text(ctx, Math.floor(suspicion) + '%', bx + bw + 10, 24, 15, suspicionColor(suspicion));
    const alerts = SP.guards.alertCount(game.guards);
    text(ctx, alerts > 0 ? 'ALARM x' + alerts : 'UNSEEN', bx, 46, 13, alerts > 0 ? '#ff2e2e' : '#35e0c8');

    // Right: objective, timer, coins, mute.
    const key = game.player.hasKeycard ? 'KEYCARD ✓' : 'KEYCARD ○';
    text(ctx, key, 1250, 24, 14, game.player.hasKeycard ? '#2fd47c' : '#ffd94a', 'right');
    text(ctx, 'TIME ' + U.fmtTime(game.time), 1250, 46, 13, '#8a94a8', 'right');
    text(ctx, '◉ ' + game.player.coins, 1000, 46, 13, '#ffd94a', 'right');
    if (SP.audio.isMuted()) text(ctx, 'MUTED (M)', 1000, 24, 13, '#8a94a8', 'right');
  }

  function drawMinimap(ctx, game) {
    const level = game.level;
    const mw = 200, mh = 120;
    const mx = 1280 - 16 - mw, my = 64 + 10;
    const sx = mw / level.width, sy = mh / level.height;
    ctx.fillStyle = 'rgba(6, 9, 16, 0.85)';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#3a4560';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mw, mh);
    text(ctx, 'MINIMAP', mx + 6, my + 14, 10, '#8a94a8');
    for (let ty = 0; ty < level.rows; ty++) {
      for (let tx = 0; tx < level.cols; tx++) {
        if (level.grid[ty][tx] !== '#') continue;
        ctx.fillStyle = '#4a5878';
        ctx.fillRect(mx + tx * level.tile * sx, my + ty * level.tile * sy,
          level.tile * sx, level.tile * sy);
      }
    }
    const k = level.keycard;
    if (k && !k.taken) {
      ctx.fillStyle = '#ffd94a';
      ctx.fillRect(mx + k.x * sx - 2, my + k.y * sy - 2, 4, 4);
    }
    const e = level.exit;
    ctx.fillStyle = game.player.hasKeycard ? '#2fd47c' : '#3a4a3a';
    ctx.fillRect(mx + e.x * sx - 3, my + e.y * sy - 3, 6, 6);
    game.guards.forEach(function (g) {
      ctx.fillStyle = 'rgba(229, 72, 77, 0.35)';
      ctx.beginPath();
      ctx.moveTo(mx + g.x * sx, my + g.y * sy);
      ctx.arc(mx + g.x * sx, my + g.y * sy, 14,
        g.angle - SP.guards.VIEW_HALF_ANGLE, g.angle + SP.guards.VIEW_HALF_ANGLE);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(mx + g.x * sx, my + g.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#35e0c8';
    ctx.beginPath();
    ctx.arc(mx + game.player.x * sx, my + game.player.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // A big centre message that fades: "KEYCARD SECURED", "ALARM!", ...
  function drawMessage(ctx, game) {
    if (!game.message || game.messageTimer <= 0) return;
    const alpha = Math.min(1, game.messageTimer);
    ctx.save();
    ctx.globalAlpha = alpha;
    text(ctx, game.message, 640, 120, 30, game.messageColor || '#e8ecf4', 'center');
    ctx.restore();
  }

  function drawPanel(ctx, title, lines, prompt, titleColor) {
    ctx.fillStyle = 'rgba(4, 6, 12, 0.72)';
    ctx.fillRect(0, 0, 1280, 800);
    const w = 640, h = 150 + lines.length * 34;
    const x = (1280 - w) / 2, y = (800 - h) / 2;
    ctx.fillStyle = '#101828';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#3a4560';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.font = 'bold 42px ' + TITLE_FONT;
    ctx.fillStyle = titleColor || '#e8ecf4';
    ctx.textAlign = 'center';
    ctx.fillText(title, 640, y + 66);
    lines.forEach(function (line, i) {
      text(ctx, line.text, 640, y + 118 + i * 34, 17, line.color || '#b8c0d0', 'center');
    });
    text(ctx, prompt, 640, y + h - 26, 17, '#ffd94a', 'center');
  }

  function drawTitle(ctx, game) {
    drawPanel(ctx, 'SHADOW PROTOCOL', [
      { text: 'A top-down stealth game. Three floors, one way out each.' },
      { text: 'Stay out of the yellow cones. Bushes hide you — if you sneak or stand still.' },
      { text: 'WASD / arrows move · SHIFT sneak · CLICK throws a coin to distract' },
      { text: 'Grab the KEYCARD, then reach the EXIT unseen. P pauses · M mutes.' },
      { text: '3 LEVELS · 15 GUARDS · PATROLS YOU CAN LEARN', color: '#35e0c8' },
    ], 'Press SPACE or CLICK to start');
  }

  function drawPaused(ctx) {
    drawPanel(ctx, 'PAUSED', [
      { text: 'The guards are waiting. So is the exit.' },
    ], 'Press P to resume');
  }

  function drawCaught(ctx, game) {
    drawPanel(ctx, 'CAUGHT', [
      { text: 'A guard got a good look at you. The floor resets.' },
      { text: game.level.name + ' — spotted ' + game.spotted + ' time' + (game.spotted === 1 ? '' : 's') + ' this run', color: '#f57828' },
    ], 'Press SPACE to retry this level', '#ff5a5a');
  }

  function drawLevelComplete(ctx, game) {
    const s = game.lastLevelStats;
    drawPanel(ctx, 'FLOOR CLEAR', [
      { text: game.level.name + ' — unseen enough.', color: '#2fd47c' },
      { text: 'TIME  ' + U.fmtTime(s.time) + '   ·   SPOTTED  ' + s.spotted + '   ·   RATING  ' + s.rating, color: '#ffd94a' },
      { text: 'Total time ' + U.fmtTime(game.totalTime) + ' · Total spotted ' + game.totalSpotted },
    ], 'Press SPACE for the next floor');
  }

  function drawGameComplete(ctx, game) {
    const rating = game.finalRating;
    drawPanel(ctx, 'GHOST RUN COMPLETE', [
      { text: 'All three floors cleared. The building never knew you were there.', color: '#2fd47c' },
      { text: 'TOTAL TIME  ' + U.fmtTime(game.totalTime) + '   ·   TIMES SPOTTED  ' + game.totalSpotted, color: '#ffd94a' },
      { text: 'FINAL RATING  ' + rating + '  —  ' + ratingText(rating), color: '#35e0c8' },
      { text: '3 LEVELS · 15 GUARDS · ' + game.totalSpotted + ' ALARMS', color: '#b8c0d0' },
    ], 'Press SPACE to run it again');
  }

  function ratingText(r) {
    if (r === 'S') return 'a true ghost';
    if (r === 'A') return 'barely a shadow';
    if (r === 'B') return 'seen, but slippery';
    return 'loud, but alive';
  }

  // Rating from one level's numbers: never spotted and quick is S.
  function rateLevel(time, spotted, par) {
    if (spotted === 0 && time <= par) return 'S';
    if (spotted <= 1 && time <= par * 1.4) return 'A';
    if (spotted <= 2) return 'B';
    return 'C';
  }

  function rateRun(totalTime, totalSpotted) {
    if (totalSpotted === 0 && totalTime <= 330) return 'S';
    if (totalSpotted <= 2 && totalTime <= 420) return 'A';
    if (totalSpotted <= 5) return 'B';
    return 'C';
  }

  return { drawTopBar: drawTopBar, drawMinimap: drawMinimap,
    drawMessage: drawMessage, drawTitle: drawTitle, drawPaused: drawPaused,
    drawCaught: drawCaught, drawLevelComplete: drawLevelComplete,
    drawGameComplete: drawGameComplete, rateLevel: rateLevel, rateRun: rateRun };
})();
