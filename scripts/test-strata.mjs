// Phase 1 checks for the STRATA board. Run: node --experimental-strip-types --no-warnings scripts/test-strata.mjs
import { createBoard, tally, startColors, allCells } from "../src/games/strata/engine/board.ts";
import { BOARD_11 } from "../src/games/strata/config/layouts.ts";
import assert from "node:assert/strict";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const b = createBoard(BOARD_11);

t("board is 11 x 11", () => { assert.equal(b.width, 11); assert.equal(b.height, 11); assert.equal(allCells(b).length, 121); });
t("24 black tiles in four clusters", () => assert.equal(tally(b).black, 24));
t("12 start tiles and 4 diamonds", () => { assert.equal(tally(b).start, 12); assert.equal(tally(b).diamond, 4); });
t("four starting colours", () => assert.deepEqual(startColors(b).sort(), ["blue", "orange", "turquoise", "yellow"]));
t("each start area has 3 tiles and its diamond inside", () => {
  for (const s of BOARD_11.starts) {
    assert.equal(allCells(b).filter((c) => c.startOf === s.color).length, 3);
    assert.ok(b.cells[s.diamond[1]][s.diamond[0]].diamond);
    assert.equal(b.cells[s.diamond[1]][s.diamond[0]].startOf, s.color);
  }
});
t("start tiles begin claimed by their colour", () => { for (const c of allCells(b).filter((c) => c.startOf)) { assert.equal(c.owner, c.startOf); assert.equal(c.status, "claimed"); } });
t("the layout is mirrored left-right and top-bottom (start corners are rotated, not mirrored, so they are ignored here)", () => {
  const kind = (x, y) => b.cells[y][x].type === "black" ? "b" : b.cells[y][x].type === "height" ? "h" : "n";
  for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
    assert.equal(kind(x, y), kind(10 - x, y), `mirror x at ${x},${y}`);
    assert.equal(kind(x, y), kind(x, 10 - y), `mirror y at ${x},${y}`);
  }
});
t("height tiles carry 2 or 3 dots; the four notch tiles carry 3", () => {
  for (const c of allCells(b).filter((c) => c.type === "height")) assert.ok(c.height === 2 || c.height === 3);
  for (const [x, y] of [[5, 1], [2, 5], [8, 5], [5, 9]]) assert.equal(b.cells[y][x].height, 3);
});
t("no obstacle touches a start tile", () => {
  for (const c of allCells(b).filter((c) => c.type === "black")) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.notEqual(b.cells[c.y + dy]?.[c.x + dx]?.type, "start");
});
t("a bad layout is rejected", () => {
  assert.throws(() => createBoard({ ...BOARD_11, black: [[99, 0]] }));
  assert.throws(() => createBoard({ ...BOARD_11, dots: [[4, 1, 2]] }));
});


// ---- Blocks and placement ----
const P = await import("../src/games/strata/engine/pieces.ts");
const PL = await import("../src/games/strata/engine/placement.ts");
const G = await import("../src/games/strata/engine/game.ts");
const PLAY = await import("../src/games/strata/engine/play.ts");
const RNG = await import("../src/games/strata/engine/rng.ts");
const ANIM = await import("../src/games/strata/engine/animation.ts");
const PAL = await import("../src/games/strata/config/palette.ts");
const { STRATA_RULES } = await import("../src/games/strata/config/rules.ts");

t("there are exactly six distinct block designs, five cubes each", () => {
  assert.equal(Object.keys(P.PIECES).length, 6);
  assert.deepEqual([...P.STARTER_SET].sort(), Object.keys(P.PIECES).sort());
  const shapes = new Set();
  for (const d of Object.values(P.PIECES)) {
    assert.equal(d.cubes.length, 5, d.id);
    const all = P.orientations(d.cubes, true).map(P.keyOf);
    for (const k of all) assert.ok(!shapes.has(k) || all.includes(k), "distinct");
    assert.ok(![...shapes].some((k) => all.includes(k)), `${d.id} is the same shape as another block`);
    all.forEach((k) => shapes.add(k));
  }
});
t("every block is face-connected", () => {
  for (const d of Object.values(P.PIECES)) {
    const set = new Set(d.cubes.map((c) => c.join(",")));
    const seen = new Set([d.cubes[0].join(",")]); const q = [d.cubes[0]];
    while (q.length) { const [x, y, z] = q.pop(); for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) { const k = [x+dx,y+dy,z+dz].join(","); if (set.has(k) && !seen.has(k)) { seen.add(k); q.push([x+dx,y+dy,z+dz]); } } }
    assert.equal(seen.size, d.cubes.length, d.id);
  }
});
t("rotation: four turns return the same block, tilting and rolling keep five cubes, a block has up to 24 orientations", () => {
  for (const d of Object.values(P.PIECES)) {
    let c = d.cubes; for (let i = 0; i < 4; i++) c = P.rotateYaw(c);
    assert.equal(P.keyOf(c), P.keyOf(d.cubes));
    assert.equal(P.tiltPitch(d.cubes).length, 5); assert.equal(P.rollSide(d.cubes).length, 5);
    assert.ok(P.orientations(d.cubes).length <= 24 && P.orientations(d.cubes).length >= 3, d.id);
    assert.ok(P.orientations(d.cubes, true).length >= P.orientations(d.cubes).length);
  }
  assert.equal(P.orientations(P.PIECES.cross.cubes).length, 3);
  assert.equal(P.orientations(P.PIECES.zigzag.cubes).length, 12, "a flat shape: flipping it over is the same as turning it");
  assert.equal(P.orientations(P.PIECES.zigzag.cubes, true).length, 12);
});
t("only the bridge is a bridge", () => {
  assert.equal(P.isBridge(P.PIECES.bridge.cubes), true);
  for (const id of ["cross", "zigzag", "tallT", "tallL", "step"]) assert.equal(P.isBridge(P.PIECES[id].cubes), false, id);
  assert.deepEqual(P.spanColumns(P.PIECES.bridge.cubes), [[1, 0]]);
});
t("independent support: a block that would tip over is rejected, balanced ones are fine", () => {
  const tipping = [[0, 0, 0], [0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 0, 1]];
  assert.equal(P.stands(tipping), false);
  for (const d of Object.values(P.PIECES)) assert.equal(P.stands(d.cubes), true, d.id);
  const b = createBoard(BOARD_11);
  assert.equal(PL.place(b, tipping, 5, 5).reason, "unstable");
  assert.equal(PL.place(b, P.PIECES.cross.cubes, 5, 5).valid, true);
});
const flat = (id, pick = 0) => P.orientations(P.PIECES[id].cubes).sort((a, b) => P.size(a).h - P.size(b).h)[pick];
t("placement geometry: off the board, overlapping a block, standing on black", () => {
  const b = createBoard(BOARD_11);
  assert.equal(PL.place(b, P.PIECES.cross.cubes, 9, 5).reason, "off_board");
  assert.equal(PL.place(b, P.PIECES.cross.cubes, -1, 5).reason, "off_board");
  assert.equal(PL.place(b, flat("cross"), 4, 0).reason, "black_tile", "cross covers black (4,1)");
  assert.equal(PL.place(b, flat("cross"), 4, 4, new Set(["5,5,0"])).reason, "overlap");
  assert.equal(PL.place(b, flat("cross"), 4, 4).valid, true);
});

// ---- Turn rules ----
const people = [{ id: "a", name: "Ana", color: "blue", kind: "human" }, { id: "b", name: "Bo", color: "orange", kind: "human" }];
const fresh = (seed = 7, players = people) => { const r = G.createGame({ layout: BOARD_11, players, seed }); assert.ok(r.ok, r.error); return r.state; };
const withHand = (s, hand) => ({ ...s, turn: { ...s.turn, hand } });
/** a game on a board edited by `fn(cells)` */
const custom = (fn, hand = ["cross", "bridge", "tallL"]) => { const s = fresh(); const cells = s.board.cells.map((r) => r.map((c) => ({ ...c }))); fn(cells); return withHand({ ...s, board: { ...s.board, cells } }, hand); };
const give = (cells, x, y, owner, status = "claimed") => { cells[y][x].owner = owner; cells[y][x].status = status; };
const put = (s, id, x, y, cubes = P.PIECES[id].cubes) => { const r = G.placeBlock(s, id, cubes, x, y); assert.ok(r.ok, `${id}@${x},${y}: ${r.error}`); return r.state; };
const putAny = (s, id) => { const c = PLAY.legalPlacements(s.board, s.players[s.turn.player].color, s.turn.placed.flatMap((p) => p.world), [id])[0]; assert.ok(c, `${id} has a legal spot`); return put(s, id, c.x, c.y, c.cubes); };
const tile = (s, x, y) => s.board.cells[y][x];
const score = (s, color) => PLAY.tallies(s.board)[color]?.score ?? 0;

t("seeded dealing is deterministic and gives 3 distinct blocks", () => {
  assert.deepEqual(fresh(5).turn.hand, fresh(5).turn.hand); assert.equal(new Set(fresh(5).turn.hand).size, 3);
  assert.notDeepEqual(RNG.draw([1, 2, 3, 4, 5, 6], 3, 1).picks, RNG.draw([1, 2, 3, 4, 5, 6], 3, 2).picks);
});
t("game setup: player count, colours and start areas are checked", () => {
  assert.equal(G.createGame({ layout: BOARD_11, players: [people[0]], seed: 1 }).error, "bad_players");
  assert.equal(G.createGame({ layout: BOARD_11, players: [people[0], { ...people[1], color: "blue" }], seed: 1 }).error, "no_start_area");
  assert.equal(PLAY.tallies(fresh().board).blue.claimed, 3);
  assert.equal(tile(fresh(), 9, 9).owner, null, "an unused corner is open ground");
});
t("connection to existing territory: the first block must be on or beside your own tiles", () => {
  const s = withHand(fresh(), ["cross", "tallT", "step"]);
  assert.equal(G.placeBlock(s, "cross", flat("cross"), 4, 4).error, "not_touching_territory");
  const near = PLAY.legalPlacements(s.board, "blue", [], ["cross"]);
  assert.ok(near.length > 0);
  for (const c of near) assert.ok(PL.place(s.board, c.cubes, c.x, c.y).cells.some((q) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const k = s.board.cells[q.y + dy]?.[q.x + dx]; return k && k.owner === "blue"; })));
});
t("flat-side connectivity: each later block must share a face with a block already placed (corners don't count)", () => {
  const s0 = withHand(fresh(), ["cross", "tallT", "step"]);
  const s1 = putAny(s0, "step"); // beside blue
  const w = s1.turn.placed[0].world;
  // a cross touching only at a corner
  const maxX = Math.max(...w.map((c) => c[0])), minY = Math.min(...w.map((c) => c[1]));
  const far = G.placeBlock(s1, "cross", flat("cross"), maxX + 2, minY + 4);
  assert.equal(far.error, "not_connected");
  // find a spot that touches by a face and one that touches only by a corner
  const faces = PLAY.legalPlacements(s1.board, "blue", w, ["cross"]);
  assert.ok(faces.length > 0, "some cross placement touches by a face");
  for (const c of faces.slice(0, 20)) { const r = PL.place(s1.board, c.cubes, c.x, c.y); assert.ok(r.world.some(([x, y, z]) => w.some(([a, b, d]) => Math.abs(a - x) + Math.abs(b - y) + Math.abs(d - z) === 1)), "every legal block shares a face"); }
});
t("blocks never rest on other blocks: stacking on a placed block is refused", () => {
  const s1 = putAny(withHand(fresh(), ["cross", "tallT", "step"]), "step");
  const w = s1.turn.placed[0].world;
  const r = G.placeBlock(s1, "tallT", flat("tallT"), w[0][0], w[0][1]);
  assert.equal(r.ok, false); assert.equal(r.error, "overlap");
});
t("a turn is three blocks placed one after another, then confirmed", () => {
  let s = withHand(fresh(), ["tallT", "tallL", "step"]);
  assert.equal(G.canSubmit(s), false); assert.equal(G.submitTurn(s).error, "hand_not_empty");
  const go = (id) => { const c = PLAY.legalPlacements(s.board, "blue", s.turn.placed.flatMap((p) => p.world), [id])[0]; assert.ok(c, `${id} has a legal spot`); s = put(s, id, c.x, c.y, c.cubes); };
  go("tallT"); assert.equal(s.turn.placed.length, 1); assert.equal(G.canSubmit(s), false);
  go("tallL"); assert.equal(s.turn.placed.length, 2); assert.equal(G.canSubmit(s), false);
  go("step"); assert.equal(s.turn.placed.length, 3); assert.equal(G.canSubmit(s), true);
  const r = G.submitTurn(s); assert.ok(r.ok);
  assert.equal(r.state.turn.player, 1); assert.equal(r.state.turn.placed.length, 0); assert.equal(r.state.turn.hand.length, 3);
  assert.equal(r.state.history.length, 1); assert.equal(r.state.history[0].blocks.length, 3);
});
t("delayed scoring: nothing is claimed or scored until the turn is confirmed", () => {
  let s = withHand(fresh(), ["tallT", "tallL", "step"]);
  const before = JSON.stringify(s.board);
  for (const id of ["tallT", "tallL", "step"]) { const c = PLAY.legalPlacements(s.board, "blue", s.turn.placed.flatMap((p) => p.world), [id])[0]; s = put(s, id, c.x, c.y, c.cubes); assert.equal(JSON.stringify(s.board), before, "territory is untouched while blocks are temporary"); assert.equal(score(s, "blue"), 15); }
  const r = G.submitTurn(s); assert.ok(r.ok); assert.ok(score(r.state, "blue") > 15);
});
t("score preview: none after the first or second block, available after the third, and it matches the confirmed result", () => {
  let s = withHand(fresh(), ["tallT", "tallL", "step"]);
  const go = (id) => { const c = PLAY.legalPlacements(s.board, "blue", s.turn.placed.flatMap((p) => p.world), [id])[0]; s = put(s, id, c.x, c.y, c.cubes); };
  assert.equal(G.previewTurn(s), null);
  go("tallT"); assert.equal(G.previewTurn(s), null, "no score after block 1");
  go("tallL"); assert.equal(G.previewTurn(s), null, "no score after block 2");
  assert.equal(G.outline(s).length > 0, true, "the outline is available before the third block");
  go("step");
  const pv = G.previewTurn(s); assert.ok(pv);
  const before = score(s, "blue"); const r = G.submitTurn(s);
  assert.equal(score(r.state, "blue") - before, pv.gain.total);
  assert.equal(pv.gain.total, pv.gain.claimed * 5 + pv.gain.captured * 10 + pv.gain.heightBonus);
  assert.deepEqual(r.state.board.cells.map((row) => row.map((c) => c.status)), pv.board.cells.map((row) => row.map((c) => c.status)));
});
t("undo only works before the turn is confirmed", () => {
  let s = putAny(withHand(fresh(), ["tallT", "tallL", "step"]), "step");
  const u = G.undoBlock(s); assert.ok(u.ok); assert.equal(u.state.turn.placed.length, 0); assert.equal(u.state.turn.hand.length, 3);
  assert.equal(G.undoBlock(u.state).error, "nothing_to_undo");
});

// ---- Claimed, captured, height ----
t("claiming: the tiles under the blocks become claimed (pattern), not captured", () => {
  let s = withHand(fresh(), ["step", "tallL", "tallT"]);
  s = putAny(s, "step");
  const cells = s.turn.placed[0].world.map(([x, y]) => [x, y]);
  const r = G.submitTurn({ ...s, turn: { ...s.turn, hand: [] } }); assert.ok(r.ok);
  const seen = [];
  for (const [x, y] of cells) { const c = tile(r.state, x, y); if (c.type === "height") continue; assert.equal(c.owner, "blue"); seen.push(c.status); }
  assert.ok(seen.includes("claimed"), "ordinary tiles are claimed, not captured");
  assert.equal(PLAY.captureAll(r.state.board).captured.length, 0, "anything enclosed was already captured on confirm");
});
t("claimed and captured are separate states: an enclosed claimed tile becomes captured and scores 10", () => {
  const s = custom((c) => { give(c, 2, 1, "blue"); give(c, 3, 0, "blue"); give(c, 2, 0, "blue"); });
  const cap = PLAY.captureAll(s.board);
  assert.equal(tile({ board: cap.board }, 2, 0).status, "captured");
  assert.equal(tile({ board: cap.board }, 3, 0).status, "claimed", "(3,0) has an open side");
  assert.equal(PLAY.tallies(cap.board).blue.captured >= 1, true);
  assert.equal(STRATA_RULES.claimedPoints, 5); assert.equal(STRATA_RULES.capturedPoints, 10);
});
const heightTile = (x, y, n) => (c) => { c[y][x].type = "height"; c[y][x].height = n; };
const blueRow = (c) => { give(c, 1, 0, "blue"); };
t("height tile needs the matching column height: flat block doesn't claim it, exact column does", () => {
  const base = (n) => custom((c) => heightTile(2, 0, n)(c), ["step", "tallT", "tallL"]);
  // a flat block over (2,0) (column height 1) leaves a 2-dot tile unclaimed
  let s = base(2);
  const flatSpot = PLAY.legalPlacements(s.board, "blue", [], ["tallT"]).find((c) => P.size(c.cubes).h === 1 && PL.place(s.board, c.cubes, c.x, c.y).cells.some((q) => q.x === 2 && q.y === 0));
  assert.ok(flatSpot, "a flat block can cover (2,0)");
  const sp = put(s, "tallT", flatSpot.x, flatSpot.y, flatSpot.cubes);
  let r = G.submitTurn({ ...sp, turn: { ...sp.turn, hand: [] } });
  assert.equal(tile(r.state, 2, 0).owner, null, "unmatched height leaves the tile unclaimed");
  // the step's 2-high tower on a 2-dot tile claims it
  const tower = PLAY.legalPlacements(s.board, "blue", [], ["step"]).find((c) => { const pl = PL.place(s.board, c.cubes, c.x, c.y); return pl.world.filter((w) => w[0] === 2 && w[1] === 0).length === 2; });
  assert.ok(tower, "the step can stand its tower on (2,0)");
  s = put(s, "step", tower.x, tower.y, tower.cubes);
  r = G.submitTurn({ ...s, turn: { ...s.turn, hand: [] } });
  assert.equal(tile(r.state, 2, 0).owner, "blue");
  // a 3-dot tile is not claimed by a 2-high column
  const s3 = base(3); const t3 = PLAY.legalPlacements(s3.board, "blue", [], ["step"]).find((c) => PL.place(s3.board, c.cubes, c.x, c.y).world.filter((w) => w[0] === 2 && w[1] === 0).length === 2);
  assert.ok(t3);
  const r3 = G.submitTurn({ ...put(s3, "step", t3.x, t3.y, t3.cubes), turn: { ...put(s3, "step", t3.x, t3.y, t3.cubes).turn, hand: [] } });
  assert.equal(tile(r3.state, 2, 0).owner, null);
});
t("height bonuses are paid on CAPTURE only: 10, 20 and 30 for one, two and three dots", () => {
  assert.deepEqual({ ...STRATA_RULES.heightBonusPoints }, { 1: 10, 2: 20, 3: 30 });
  for (const n of [1, 2, 3]) {
    const claimedOnly = custom((c) => { heightTile(2, 0, n)(c); give(c, 2, 0, "blue"); });
    assert.equal(score(claimedOnly, "blue"), 15 + 5, `claimed ${n}-dot tile: no bonus`);
    const enclosed = custom((c) => { heightTile(2, 0, n)(c); give(c, 2, 0, "blue"); give(c, 3, 0, "blue"); give(c, 2, 1, "blue"); });
    const cap = PLAY.captureAll(enclosed.board).board;
    const tl = PLAY.tallies(cap).blue;
    assert.equal(tile({ board: cap }, 2, 0).status, "captured");
    assert.equal(tl.heightBonus, STRATA_RULES.heightBonusPoints[n], `captured ${n}-dot tile bonus`);
    assert.equal(tl.score, tl.claimed * 5 + tl.captured * 10 + tl.heightBonus);
  }
});

// ---- Bridges, black tiles, captured tiles ----
t("bridge: spans a black tile, claims it, and the legs stand beside it", () => {
  const s = custom((c) => give(c, 4, 3, "blue"), ["bridge", "cross", "step"]);
  const r = G.placeBlock(s, "bridge", P.PIECES.bridge.cubes, 4, 3); // legs on (4,3) and (6,3), span over black (5,3)
  assert.ok(r.ok, r.error);
  assert.equal(r.state.turn.placed[0].world.some(([x, y, z]) => x === 5 && y === 3 && z === 1), true);
  const done = G.submitTurn({ ...r.state, turn: { ...r.state.turn, hand: [] } });
  assert.equal(tile(done.state, 5, 3).owner, "blue"); assert.equal(tile(done.state, 5, 3).status === "claimed" || tile(done.state, 5, 3).status === "captured", true);
  assert.equal(tile(done.state, 5, 3).type, "black", "it stays a black tile, now held by blue");
});
t("black tiles can't be claimed by ordinary blocks: standing on one is refused, hanging over one without being a bridge is refused", () => {
  const s = withHand(fresh(), ["cross", "zigzag", "tallL"]);
  assert.equal(G.placeBlock(s, "cross", flat("cross"), 4, 0).error, "black_tile");
  const hang = P.PIECES.zigzag.cubes; // ground on (2,1),(3,1); its top cube hangs over (4,1), a black tile
  assert.equal(P.isBridge(hang), false);
  assert.equal(G.placeBlock(s, "zigzag", hang, 2, 1).error, "needs_bridge");
});
t("solid captured tiles of an opponent can't be stood on, but a bridge can claim them", () => {
  const s = custom((c) => give(c, 1, 2, "orange", "captured"), ["bridge", "tallL", "cross"]);
  // flat block over the captured tile: refused
  const over = PLAY.legalPlacements(s.board, "blue", [], ["tallL", "cross"]).filter((c) => PL.place(s.board, c.cubes, c.x, c.y).ground.some((q) => q.x === 1 && q.y === 2));
  assert.equal(over.length, 0, "no ordinary block may stand on it");
  let tried = 0;
  for (const cubes of P.orientations(P.PIECES.tallL.cubes)) for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) {
    const pl = PL.place(s.board, cubes, x, y); if (!pl.valid || !pl.ground.some((q) => q.x === 1 && q.y === 2)) continue;
    tried++; assert.equal(G.placeBlock(s, "tallL", cubes, x, y).error, "opponent_captured");
  }
  assert.ok(tried > 0, "there were placements over the captured tile to refuse");
  // bridge: legs on (0,2) and (2,2)
  const r = G.placeBlock(s, "bridge", P.PIECES.bridge.cubes, 0, 2); assert.ok(r.ok, r.error);
  const done = G.submitTurn({ ...r.state, turn: { ...r.state.turn, hand: [] } });
  assert.equal(tile(done.state, 1, 2).owner, "blue", "the bridge took the captured tile");
  assert.equal(tile(done.state, 1, 2).status === "claimed" || tile(done.state, 1, 2).status === "captured", true);
});
t("an opponent's merely CLAIMED tile can be taken by an ordinary block", () => {
  const s = custom((c) => give(c, 3, 0, "orange", "claimed"), ["tallL", "step", "cross"]);
  const spot = PLAY.legalPlacements(s.board, "blue", [], ["step"]).find((c) => PL.place(s.board, c.cubes, c.x, c.y).ground.some((q) => q.x === 3 && q.y === 0));
  assert.ok(spot);
  const r = G.submitTurn({ ...put(s, "step", spot.x, spot.y, spot.cubes), turn: { ...put(s, "step", spot.x, spot.y, spot.cubes).turn, hand: [] } });
  assert.equal(tile(r.state, 3, 0).owner, "blue");
});

// ---- Animation, temporary blocks, patterns ----
t("confirming returns a fill plan that spreads outwards, and the temporary blocks are gone from the state", () => {
  let s = withHand(fresh(), ["tallT", "tallL", "step"]);
  for (const id of ["tallT", "tallL", "step"]) { const c = PLAY.legalPlacements(s.board, "blue", s.turn.placed.flatMap((p) => p.world), [id])[0]; s = put(s, id, c.x, c.y, c.cubes); }
  const r = G.submitTurn(s); assert.ok(r.ok);
  assert.equal(r.state.turn.placed.length, 0, "blocks are removed after confirming");
  assert.equal(JSON.stringify(r.state.board).includes('"world"'), false, "the board stores territory, never blocks");
  const plan = ANIM.fillPlan(r.resolution, r.blocks);
  assert.ok(plan.length >= r.resolution.claimed.length);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].delay >= plan[i - 1].delay, "fills in order outwards");
  assert.equal(plan[0].delay, 0, "tiles under the blocks fill first");
  for (const p of plan) { assert.equal(p.owner, "blue"); assert.ok(p.status === "claimed" || p.status === "captured"); }
  assert.ok(ANIM.fillDuration(plan) > 0);
});
t("territory patterns: waves are not the default for everyone; each colour has a pattern and there are several patterns", () => {
  assert.ok(PAL.PATTERNS.length >= 5);
  const used = ["blue", "yellow", "orange", "turquoise"].map((c) => PAL.PLAYER_PATTERN[c]);
  assert.equal(new Set(used).size, 4, "four colours, four different patterns");
  for (const p of used) assert.ok(PAL.PATTERNS.includes(p));
  assert.equal(PAL.PLAYER_PATTERN.turquoise, "waves"); assert.equal(PAL.PLAYER_PATTERN.blue, "crosses"); assert.equal(PAL.PLAYER_PATTERN.yellow, "dots");
});

// ---- Whole games ----
t("stuck players may end the turn; the tracker ends the game; a replay rebuilds the same board", () => {
  let s = fresh(11, people), guard = 0, rs = 99;
  const rnd = (n) => { const r = RNG.nextRandom(rs); rs = r.seed; return Math.floor(r.value * n); };
  while (s.status !== "finished" && guard++ < 600) {
    for (let i = 0; i < 3; i++) { const all = G.legalMoves(s); if (!all.length) break; const c = all[rnd(all.length)]; const r = G.placeBlock(s, c.pieceId, c.cubes, c.x, c.y); assert.ok(r.ok); s = r.state; }
    const r = G.submitTurn(s); assert.ok(r.ok, r.error); s = r.state;
  }
  assert.equal(s.status, "finished");
  const rep = G.replay({ layout: BOARD_11, players: people, seed: 11 }, s.history); assert.ok(rep.ok, rep.error);
  assert.deepEqual(rep.state.board.cells, s.board.cells);
  assert.deepEqual(G.ranking(rep.state).map((r) => r.score), G.ranking(s).map((r) => r.score));
});
t("humans and computers use the same engine functions (no separate AI rules)", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../src/games/strata/engine/ai.ts", import.meta.url), "utf8");
  assert.ok(src.includes("placeBlock") && src.includes("submitTurn") && src.includes("legalMoves") && src.includes("resolveBlocks"));
  assert.equal(/STRATA_RULES\.(claimed|captured)Points/.test(src), false, "scoring numbers come only from the shared rules");
});

console.log(`\n${n} passing`);
