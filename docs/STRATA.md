# STRATA: development plan and status

STRATA is a separate game inside FALSE WALLS. It lives under `/games/strata` and does not touch the Wall, Adventure, inbox or Discover.

## Source of truth for the rules
Board's published Strata help pages (Strata FAQs and Instructions on board.gorgias.help). Everything confirmed there is in `src/games/strata/config/rules.ts`. Anything not published is marked "unconfirmed" in that file and kept configurable:
- shapes of the six blocks and how each turn's three blocks are dealt
- height-tile bonus size (the source says it is paid on capture)
- size of the Territory Tracker that triggers the final round
- the diamond's rule (the reference shows one diamond in each starting area; no separate rule is published, so it scores nothing extra)
- the source game is head-to-head (teams for bigger groups); 3 to 6 individual players is this project's extension

## Architecture
```
src/games/strata/            pure TypeScript, no React, runs in Node and offline
  config/rules.ts            every number the rules use
  config/layouts.ts          board layouts as data (Classic 11 x 11 from the reference video)
  config/palette.ts          player colours and board colours
  engine/types.ts            Board, Cell, layout types
  engine/board.ts            createBoard, tally, previewTerritory (Phase 1 preview only)
  engine/describe.ts         plain-language tile descriptions
src/components/games/strata/ React + react-three-fiber (client only)
  BoardScene.tsx             the 3D board: instanced tiles, dots, diamonds, patterns, camera rig
  BoardViewer.tsx            controls, tile inspector, WebGL check
src/app/games/...            /games, /games/strata, /board, /how-to-play
scripts/test-strata.mjs      engine checks: node --experimental-strip-types --no-warnings scripts/test-strata.mjs
```
Later phases add `engine/pieces.ts` (polycube generator), `engine/rules.ts` (placement, gravity, capture, scoring), `engine/ai/*`, and Supabase tables and RPCs for rooms, moves and matchmaking, validated on the server with the same engine code.

## Board read from the reference video
11 x 11, 24 black tiles in four mirrored clusters, 4 starting corners (blue top-left, yellow top-right, orange bottom-left, turquoise bottom-right) of 3 tiles each with a diamond, 34 dot tiles. Dot counts are the one thing the video doesn't show clearly enough to count: the white tile inside each black cluster is drawn with 3 dots and the others with 2. Change `layouts.ts` if the real board differs.

## Phases
1. Digital board: DONE. Board, colours, obstacles, dot tiles, diamonds, starting areas, claimed and captured looks, camera (drag, pinch, zoom, angled, top, reset), tile inspector, How to play.
2. 3D blocks: polycube generator, shapes, drag, rotate, flip, snapping, placement preview.
3. Rules engine: placement, gravity, height tiles, claim, capture, scoring, turns.
4. Local game: hot-seat plus test opponents.
5. AI: four levels, offline.
6. Multiplayer: rooms, codes, matchmaking, server validation, reconnect.
7. Lobby, results, rematch.
8. Polish: animation, sound, mobile performance, replay.
9. Daily challenge, spectators.
