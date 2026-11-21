// SHADOW PROTOCOL — the screenshot scenes behind ?shot=cover|patrol|alert|exit.
// Each scene loads a real level, puts the player and the guards in a real
// game state (no mock objects, no drawn-on extras), and freezes the loop so
// the frame is exactly what the game looks like mid-play.
window.SP = window.SP || {};

SP.shots = (function () {
  'use strict';

  const U = SP.util;

  function placeGuardAt(game, index, tx, ty, angle) {
    const g = game.guards[index];
    if (!g) return;
    const c = U.tileCenter(game.level, tx, ty);
    g.x = c.x;
    g.y = c.y;
    g.angle = angle;
    g.state = 'patrol';
    g.suspicion = 0;
    g.waitTimer = 0;
  }

  function placePlayer(game, tx, ty, sneaking) {
    const c = U.tileCenter(game.level, tx, ty);
    game.player.x = c.x;
    game.player.y = c.y;
    game.player.sneaking = !!sneaking;
    game.player.moving = false;
    const btx = Math.floor(c.x / game.level.tile), bty = Math.floor(c.y / game.level.tile);
    game.player.hidden = U.isBush(game.level, btx, bty) && !!sneaking;
    game.player.angle = 0;
  }

  // The cover: floor 2 mid-play, cones sweeping, the player slipping past
  // a patrol with the keycard already in hand and the exit lit.
  function stageCover(game, loadLevel) {
    loadLevel(1);
    game.screen = 'playing';
    game.time = 68;
    game.player.hasKeycard = true;
    game.level.keycard.taken = true;
    placePlayer(game, 14, 7, true);
    game.player.angle = 0.3;
    placeGuardAt(game, 0, 9, 1, Math.PI / 2);
    placeGuardAt(game, 1, 22, 1, Math.PI / 2);
    placeGuardAt(game, 2, 14, 3, Math.PI);
    placeGuardAt(game, 3, 21, 10, -Math.PI / 2);
    placeGuardAt(game, 4, 1, 14, 0);
    game.guards[2].suspicion = 42;
    game.message = '';
  }

  // Patrol: floor 1, the player flat in a bush while a guard's cone sweeps
  // past — the hide spot doing its job.
  function stagePatrol(game, loadLevel) {
    loadLevel(0);
    game.screen = 'playing';
    game.time = 24;
    placePlayer(game, 5, 1, true); // the bush at the top of floor 1
    game.player.angle = Math.PI;
    placeGuardAt(game, 0, 7, 1, 0);
    placeGuardAt(game, 1, 23, 3, Math.PI / 2);
    placeGuardAt(game, 2, 24, 14, -Math.PI / 2);
    game.message = 'HIDDEN — HOLD STILL';
    game.messageColor = '#35e0c8';
    game.messageTimer = 999;
  }

  // Alert: floor 2, the meter nearly full, the alarm live, a guard closing
  // in with a red cone and a "!" over his head.
  function stageAlert(game, loadLevel) {
    loadLevel(1);
    game.screen = 'playing';
    game.time = 91;
    game.spotted = 1;
    game.totalSpotted = 1;
    game.alarm = true;
    placePlayer(game, 15, 5, false);
    game.player.angle = Math.PI / 2;
    placeGuardAt(game, 0, 13, 3, Math.PI / 2);
    placeGuardAt(game, 1, 20, 1, Math.PI);
    placeGuardAt(game, 2, 15, 3, Math.PI / 2);
    placeGuardAt(game, 3, 20, 10, -Math.PI / 2);
    placeGuardAt(game, 4, 1, 15, 0);
    game.guards[0].state = 'alert';
    game.guards[0].suspicion = 100;
    game.guards[0].lastSeen = { x: game.player.x, y: game.player.y };
    game.guards[2].state = 'alert';
    game.guards[2].suspicion = 88;
    game.guards[2].lastSeen = { x: game.player.x, y: game.player.y };
    game.message = 'ALARM! BREAK LINE OF SIGHT!';
    game.messageColor = '#ff2e2e';
    game.messageTimer = 999;
  }

  // Exit: the floor-clear panel over floor 1, with the run's numbers on it.
  function stageExit(game, loadLevel) {
    loadLevel(0);
    game.screen = 'levelComplete';
    game.time = 58;
    game.totalTime = 58;
    game.spotted = 0;
    game.totalSpotted = 0;
    game.player.hasKeycard = true;
    game.level.keycard.taken = true;
    placePlayer(game, 27, 9, false);
    game.player.angle = 0;
    placeGuardAt(game, 0, 6, 1, Math.PI / 2);
    placeGuardAt(game, 1, 24, 3, Math.PI);
    placeGuardAt(game, 2, 24, 14, 0);
    game.lastLevelStats = { time: 58, spotted: 0, rating: 'S' };
    game.message = '';
  }

  function stage(name, game, loadLevel) {
    if (name === 'cover') stageCover(game, loadLevel);
    else if (name === 'patrol') stagePatrol(game, loadLevel);
    else if (name === 'alert') stageAlert(game, loadLevel);
    else if (name === 'exit') stageExit(game, loadLevel);
    else stageCover(game, loadLevel);
  }

  return { stage: stage };
})();
