// SHADOW PROTOCOL — shared helpers: geometry, grid lookups and line of sight.
// Every file of the game hangs its API off the single global `SP` object.
window.SP = window.SP || {};

SP.util = (function () {
  'use strict';

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function dist(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function turnToward(angle, target, maxStep) {
    const d = angleDiff(angle, target);
    if (Math.abs(d) <= maxStep) return target;
    return angle + Math.sign(d) * maxStep;
  }

  // Tile helpers. A level grid is rows of strings; '#' wall, 'C' crate (both solid
  // and vision-blocking), 'B' bush (hide spot, walkable), everything else floor.
  function tileAt(level, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= level.cols || ty >= level.rows) return '#';
    return level.grid[ty][tx];
  }

  function isSolid(level, tx, ty) {
    const t = tileAt(level, tx, ty);
    return t === '#' || t === 'C';
  }

  function isBush(level, tx, ty) { return tileAt(level, tx, ty) === 'B'; }

  // True when the segment between two world points crosses no solid tile.
  // Sampled densely enough that a 40px tile can never be jumped over.
  function lineOfSight(level, x1, y1, x2, y2) {
    const d = dist(x1, y1, x2, y2);
    const steps = Math.max(1, Math.ceil(d / 6));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      if (isSolid(level, Math.floor(x / level.tile), Math.floor(y / level.tile))) return false;
    }
    return true;
  }

  // Move a circle against solid tiles, axis by axis, so it slides along walls.
  function moveCircle(level, body, dx, dy) {
    const r = body.r, t = level.tile;
    const nx = body.x + dx;
    if (!circleHitsSolid(level, nx, body.y, r)) body.x = nx;
    const ny = body.y + dy;
    if (!circleHitsSolid(level, body.x, ny, r)) body.y = ny;
  }

  function circleHitsSolid(level, x, y, r) {
    const t = level.tile;
    const x0 = Math.floor((x - r) / t), x1 = Math.floor((x + r) / t);
    const y0 = Math.floor((y - r) / t), y1 = Math.floor((y + r) / t);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!isSolid(level, tx, ty)) continue;
        const cx = clamp(x, tx * t, tx * t + t);
        const cy = clamp(y, ty * t, ty * t + t);
        const ddx = x - cx, ddy = y - cy;
        if (ddx * ddx + ddy * ddy < r * r) return true;
      }
    }
    return false;
  }

  function tileCenter(level, tx, ty) {
    return { x: tx * level.tile + level.tile / 2, y: ty * level.tile + level.tile / 2 };
  }

  function fmtTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  return { clamp, dist, angleTo, angleDiff, turnToward, tileAt, isSolid, isBush,
    lineOfSight, moveCircle, circleHitsSolid, tileCenter, fmtTime };
})();
