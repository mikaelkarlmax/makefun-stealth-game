# SHADOW PROTOCOL

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/c/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/mikaelkarlmax/makefun-stealth-game/rank.svg)](https://make.fun/c/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/mikaelkarlmax/makefun-stealth-game/reward.svg)](https://make.fun/c/best-stealth-game-20261121-1759)

A top-down stealth game, entered in [Make the best stealth game](https://make.fun/c/best-stealth-game-20261121-1759) on make.fun. Three floors, fifteen guards, one way out of each floor — unseen.

## The game

You are the infiltrator. Every floor is a dark facility seen from above: guards walk patrol routes you can learn (their routes are drawn faintly on the floor), sweeping yellow vision cones that narrow and redden as they get suspicious. Grab the **keycard**, then reach the **EXIT** without being seen.

- **Detection is a meter, not a switch.** Standing in a cone fills it — faster up close, faster while you run, slower while you sneak. Slip out of sight and it drains. Cross 60% and a guard comes to look ("NEAR MISS"); fill it and the **alarm** sounds, every guard converges, and you can still break away if you vanish long enough for the alarm to cool.
- **Cover you can read:** walls and crates block sight, bushes hide you while you sneak or stand still, and the lighting shows what is safe.
- **A coin for trouble:** click anywhere to throw a coin — its clink pulls nearby guards to that spot. Three coins per floor.
- **Footsteps tell you where a guard is:** guard steps are panned and quieted by distance (WebAudio, synthesized — no audio files). Your own steps are loud while you walk, silent while you sneak.
- **HUD + minimap:** detection meter, alarm count, objective, timer, coins — and a live minimap showing every guard, cone, keycard and exit.
- **Scoring:** each floor rates you S/A/B/C on time and times spotted; a full ghost run (never spotted) earns S.

## How to play

- **WASD / arrow keys** — move
- **Shift** — sneak (slow, quiet, hidden in bushes)
- **Click** — throw a coin to distract a guard
- **P / Esc** — pause · **M** — mute

## Play it

Serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and play in a desktop browser. No build step, no network requests, no external assets — all art is drawn procedurally on canvas and all sound is synthesized with WebAudio.

## Structure

- `game/src/main.js` — boot, game loop, screens, alarm and scoring
- `game/src/level.js` — the three floors: walls, cover, keycard, exit, patrols
- `game/src/guards.js` — patrol AI, vision cones, suspicion, alarm, investigate
- `game/src/player.js` — movement, sneaking, coin distraction, pickups
- `game/src/render.js` — the level, raycast-clipped cones, lighting
- `game/src/hud.js` — HUD, minimap, title/pause/debrief screens
- `game/src/audio.js` — synthesized footsteps, alarm, stings (WebAudio)
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — the four screenshot scenes (`?shot=cover|patrol|alert|exit`)
- `game/src/util.js` — geometry, grid lookups, line of sight
