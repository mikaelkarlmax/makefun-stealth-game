// SHADOW PROTOCOL — level data: three hand-built floors, rising difficulty.
// Legend: '#' wall, 'C' crate (solid, blocks sight), 'B' bush (hide spot),
// 'P' player start, 'K' keycard, 'E' exit. Guards patrol the listed waypoints
// in tile coordinates; every leg of a patrol runs down an open corridor.
window.SP = window.SP || {};

SP.levels = (function () {
  'use strict';

  const TILE = 40;
  const COLS = 30;
  const ROWS = 18;
  // Playfield offset inside the 1280x800 canvas (top strip is the HUD).
  const OX = 40;
  const OY = 64;

  const DEFS = [
    {
      name: 'LEVEL 1 — FIRST LIGHT',
      brief: 'Learn the dark. Grab the keycard, reach the exit unseen.',
      guards: [
        { path: [[3, 1], [11, 1]], speed: 68 },
        { path: [[20, 3], [27, 3]], speed: 68 },
        { path: [[24, 12], [24, 16]], speed: 68 },
      ],
      map: [
        '##############################',
        '#P...BB.......#.....K........#',
        '#.##..BB..##..#..##.....##...#',
        '#....##.......##..#..........#',
        '#.####..#####....#..#####..#.#',
        '#.......#...#....#......#...##',
        '#..##...#...#..###..##..#....#',
        '#..##...#...#......##...#.##.#',
        '#......#....#####....#...#...#',
        '#.####.#..........#..#...#..E#',
        '#....#...####..#..#..#.......#',
        '#.##.#......#..#..#..###.##..#',
        '#..#..###..#.....#.....#.....#',
        '#..#......#..#####..#..#..#..#',
        '#..#####..#......#..#..#..#..#',
        '#.........##..##....#.....#..#',
        '#..BB....#....#..##..##...#..#',
        '##############################',
      ],
    },
    {
      name: 'LEVEL 2 — CROSSFIRE',
      brief: 'Five guards, tighter patrols. Patience is a weapon.',
      guards: [
        { path: [[6, 1], [11, 1]], speed: 76 },
        { path: [[21, 1], [24, 1]], speed: 76 },
        { path: [[12, 3], [16, 3]], speed: 76 },
        { path: [[19, 10], [22, 10]], speed: 76 },
        { path: [[1, 13], [1, 16]], speed: 76 },
      ],
      map: [
        '##############################',
        '#P..#......BB......#....K....#',
        '#...#..##..#..##..#..##..#...#',
        '#.##.#..#..#.....#..#..#..##.#',
        '#....#..#..####..#..##....#..#',
        '##.##.#.....#..#..#..#..##..##',
        '#....#..###..#..#....#..#....#',
        '#.##....#..#..##..###..#..##.#',
        '#..#..##...#.....#..#..#.....#',
        '#..####..#..##..#..#..####...#',
        '#......#....#..#..#....#..#..#',
        '#.####..##..#..###..#..##..#.#',
        '#....#...#..#..#..##..#..#...#',
        '#.##.#..##..#..#..#..#..##..##',
        '#..#....#..##..#..##..#..#...#',
        '#..###..#..#..#..#..#..###...#',
        '#BB.....#....#..#..#....#...E#',
        '##############################',
      ],
    },
    {
      name: 'LEVEL 3 — BLACKOUT',
      brief: 'Seven guards, almost no cover. Ghost it or don\'t come home.',
      guards: [
        { path: [[4, 1], [6, 1]], speed: 84 },
        { path: [[9, 1], [12, 1]], speed: 84 },
        { path: [[20, 1], [24, 1]], speed: 84 },
        { path: [[9, 3], [11, 3]], speed: 84 },
        { path: [[4, 10], [7, 10]], speed: 84 },
        { path: [[1, 16], [5, 16]], speed: 84 },
        { path: [[7, 16], [10, 16]], speed: 84 },
      ],
      map: [
        '##############################',
        '#P.#...#....BB....#.....K....#',
        '#..#.#..##..#..#..##..#..#..##',
        '#..#.#..#...#..##..#..#..#...#',
        '#..#..##..#..#..#..##..#..#..#',
        '#..###..#..##..#..#..#..##..##',
        '#....#..#..#..##..#..#..#....#',
        '#.##.#..#..#..#..#..##..#.##.#',
        '#.#..#..##..#..#..#..#..#..#.#',
        '#.#..###..#..##..#..##..#....#',
        '#..#....#..#..#..#..#..#..##.#',
        '#..##..#..##..#..#..##..#..#.#',
        '#..#..#..#..#..#..#..#..#....#',
        '#..#..##..#..#..#..##..#..#..#',
        '#..###..#..#..##..#..#..##...#',
        '#BB...#..#..#..#..#..#..#..#.#',
        '#.....#....#..#..#..#..#...#E#',
        '##############################',
      ],
    },
  ];

  // Parse one level definition into a playable level: a grid plus the
  // world-space positions of the player start, keycard and exit.
  function parseLevel(index) {
    const def = DEFS[index];
    const grid = def.map.map(function (row) { return row.split(''); });
    const level = {
      index: index,
      name: def.name,
      brief: def.brief,
      grid: grid,
      cols: COLS,
      rows: ROWS,
      tile: TILE,
      ox: OX,
      oy: OY,
      width: COLS * TILE,
      height: ROWS * TILE,
      guardDefs: def.guards,
      playerStart: null,
      keycard: null,
      exit: null,
    };
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const ch = grid[ty][tx];
        const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
        if (ch === 'P') { level.playerStart = { x: cx, y: cy, tx: tx, ty: ty }; grid[ty][tx] = '.'; }
        if (ch === 'K') { level.keycard = { x: cx, y: cy, tx: tx, ty: ty, taken: false }; grid[ty][tx] = '.'; }
        if (ch === 'E') { level.exit = { x: cx, y: cy, tx: tx, ty: ty }; grid[ty][tx] = '.'; }
      }
    }
    return level;
  }

  return { TILE: TILE, COLS: COLS, ROWS: ROWS, OX: OX, OY: OY, count: DEFS.length, parseLevel: parseLevel };
})();
