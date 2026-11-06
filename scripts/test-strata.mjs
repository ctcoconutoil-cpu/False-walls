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

// ---- Phase 2: blocks and placement ----
const P = await import("../src/games/strata/engine/pieces.ts");
const PL = await import("../src/games/strata/engine/placement.ts");
const cnt = (k) => P.orientations(P.PIECES[k].cubes).length;
t("cube counts: single 1, domino 2, line 3, L 4, T 4, square 4, cross 5, tower 3, bridge 5, stair 4", () => {
  const want = { single: 1, domino: 2, line3: 3, el: 4, tee: 4, square: 4, cross: 5, tower: 3, bridge: 5, stair: 4 };
  for (const [k, v] of Object.entries(want)) assert.equal(P.PIECES[k].cubes.length, v, k);
});
t("every block is face-connected", () => {
  for (const d of Object.values(P.PIECES)) {
    const set = new Set(d.cubes.map((c) => c.join(",")));
    const seen = new Set([d.cubes[0].join(",")]); const q = [d.cubes[0]];
    while (q.length) { const [x, y, z] = q.pop(); for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) { const k = [x+dx,y+dy,z+dz].join(","); if (set.has(k) && !seen.has(k)) { seen.add(k); q.push([x+dx,y+dy,z+dz]); } } }
    assert.equal(seen.size, d.cubes.length, d.id);
  }
});
t("orientation counts are right (single 1, tower 3, domino 3, square 3, cross 3)", () => { assert.equal(cnt("single"), 1); assert.equal(cnt("tower"), 3); assert.equal(cnt("domino"), 3); assert.equal(cnt("square"), 3); assert.equal(cnt("cross"), 3); });
t("the L block has 24 orientations; mirroring adds none (it is mirror-symmetric in 3D)", () => { assert.equal(P.orientations(P.PIECES.el.cubes).length, 24); assert.equal(P.orientations(P.PIECES.el.cubes, true).length, 24); });
t("four yaw turns return the same block; yaw keeps height", () => {
  let c = P.PIECES.bridge.cubes; const k = P.keyOf(c);
  for (let i = 0; i < 4; i++) { c = P.rotateYaw(c); assert.equal(P.size(c).h, 2); }
  assert.equal(P.keyOf(c), k);
});
t("tilting a flat T onto its side makes it 3 high", () => assert.equal(P.size(P.tiltPitch(P.PIECES.tee.cubes)).h, 2));
t("tower laid down is 3 wide and 1 high", () => { const s = P.size(P.tiltPitch(P.PIECES.tower.cubes)); assert.equal(s.h, 1); assert.equal(s.w * s.d, 3); });
t("flip is its own inverse", () => assert.equal(P.keyOf(P.flip(P.flip(P.PIECES.stair.cubes))), P.keyOf(P.PIECES.stair.cubes)));
t("placing on open floor rests at height 0", () => { const r = PL.place(b, P.PIECES.cross.cubes, 4, 4); assert.ok(r.valid); assert.equal(r.base, 0); assert.equal(r.cells.length, 5); });
t("off-board placement is invalid", () => { for (const [x, y] of [[-1, 0], [9, 5], [0, 10]]) { const r = PL.place(b, P.PIECES.cross.cubes, x, y); assert.equal(r.valid, false); assert.equal(r.reason, "off_board"); } });
t("a block can't stand on a black tile", () => { const r = PL.place(b, P.PIECES.single.cubes, 4, 1); assert.equal(r.reason, "black_tile"); });
t("a block dropped on another rests on top of it", () => {
  let bb = PL.commit(b, PL.place(b, P.PIECES.tower.cubes, 5, 5));
  const r = PL.place(bb, P.PIECES.single.cubes, 5, 5); assert.ok(r.valid); assert.equal(r.base, 3);
  bb = PL.commit(bb, r); assert.equal(bb.cells[5][5].stack, 4);
});
t("a bridge's lintel clears a tower beside its pillar", () => {
  const bb = PL.commit(b, PL.place(b, P.PIECES.single.cubes, 6, 5)); // a 1-high stack under the lintel
  const r = PL.place(bb, P.PIECES.bridge.cubes, 5, 5); assert.ok(r.valid); assert.equal(r.base, 0);
});
t("stack limit is enforced", () => { let bb = b; for (let i = 0; i < 2; i++) bb = PL.commit(bb, PL.place(bb, P.PIECES.tower.cubes, 5, 5)); const r = PL.place(bb, P.PIECES.tower.cubes, 5, 5); assert.equal(r.reason, "too_tall"); });
t("commit refuses an invalid placement and never mutates the old board", () => {
  assert.throws(() => PL.commit(b, PL.place(b, P.PIECES.single.cubes, 4, 1)));
  const before = b.cells[5][5].stack; PL.commit(b, PL.place(b, P.PIECES.single.cubes, 5, 5)); assert.equal(b.cells[5][5].stack, before);
});

// ---- Phase 3: rules engine ----
const G = await import("../src/games/strata/engine/game.ts");
const PLAY = await import("../src/games/strata/engine/play.ts");
const RNG = await import("../src/games/strata/engine/rng.ts");
const { STRATA_RULES } = await import("../src/games/strata/config/rules.ts");
const people = [{ id: "a", name: "Ana", color: "blue", kind: "human" }, { id: "b", name: "Bo", color: "orange", kind: "human" }];
const fresh = (seed = 7, players = people) => { const r = G.createGame({ layout: BOARD_11, players, seed }); assert.ok(r.ok, r.error); return r.state; };
const withHand = (s, hand) => ({ ...s, turn: { ...s.turn, hand } });
const cubesOf = (id) => P.PIECES[id].cubes;
const put = (s, id, x, y, cubes = cubesOf(id)) => { const r = G.placeBlock(s, id, cubes, x, y); assert.ok(r.ok, `${id}@${x},${y}: ${r.error}`); return r.state; };
const tile = (s, x, y) => s.board.cells[y][x];

t("seeded dealing is deterministic and gives 3 distinct blocks", () => {
  assert.deepEqual(fresh(5).turn.hand, fresh(5).turn.hand); assert.equal(new Set(fresh(5).turn.hand).size, 3);
  assert.notDeepEqual(RNG.draw([1, 2, 3, 4, 5, 6], 3, 1).picks, RNG.draw([1, 2, 3, 4, 5, 6], 3, 2).picks);
});
t("game setup: player count, colours and start areas are checked", () => {
  assert.equal(G.createGame({ layout: BOARD_11, players: [people[0]], seed: 1 }).error, "bad_players");
  assert.equal(G.createGame({ layout: BOARD_11, players: [people[0], { ...people[1], color: "blue" }], seed: 1 }).error, "no_start_area");
  assert.equal(G.createGame({ layout: BOARD_11, players: [...people, { id: "c", name: "C", color: "purple", kind: "human" }], seed: 1 }).error, "no_start_area");
  assert.equal(PLAY.tallies(fresh().board).blue.claimed, 3);
  assert.equal(tile(fresh(), 9, 9).owner, null, "an unused corner is open ground");
});
t("a block must touch the player's territory", () => {
  const s = withHand(fresh(), ["single", "domino", "line3"]);
  assert.equal(G.placeBlock(s, "single", cubesOf("single"), 5, 5).error, "not_connected");
  assert.ok(G.placeBlock(s, "single", cubesOf("single"), 2, 1).ok); // beside blue's (1,1)
  assert.ok(G.placeBlock(s, "single", cubesOf("single"), 1, 2).ok); // below blue's (1,1)
  assert.equal(G.placeBlock(s, "single", cubesOf("single"), 2, 2).error, "not_connected", "corner-to-corner doesn't count");
});
t("tiles claimed by an earlier block this turn count as territory for the next one", () => {
  let s = withHand(fresh(), ["domino", "line3", "single"]);
  assert.equal(G.placeBlock(s, "single", cubesOf("single"), 2, 0).error === undefined, true); // (1,0) is blue's
  s = put(s, "domino", 2, 0); // claims (2,0),(3,0)
  assert.ok(G.placeBlock(s, "single", cubesOf("single"), 2, 1).ok); // beside (2,0), which is now blue's
});
t("blocks may not touch black tiles", () => {
  let s = withHand(fresh(), ["domino", "single", "line3"]);
  s = put(s, "domino", 0, 2);
  assert.equal(G.placeBlock(s, "single", cubesOf("single"), 1, 3).error, "touches_black"); // (1,4) is black
  assert.equal(G.placeBlock(s, "single", cubesOf("single"), 3, 1).error, "touches_black"); // (4,1) is black
  assert.ok(G.placeBlock(s, "single", cubesOf("single"), 0, 3).ok);
});
t("a block can't be placed on a black tile (rules layer reports it too)", () => {
  const s = withHand(fresh(), ["single", "domino", "line3"]);
  assert.equal(G.placeBlock(s, "single", cubesOf("single"), 4, 1).error, "black_tile");
});
t("a block can't be placed on, or beside, another player's captured tiles", () => {
  let s = withHand(fresh(), ["single", "domino", "line3"]);
  const cells = s.board.cells.map((r) => r.map((c) => ({ ...c })));
  cells[2][2].owner = "orange"; cells[2][2].status = "captured";
  s = { ...s, board: { ...s.board, cells } };
  assert.equal(G.placeBlock(s, "single", cubesOf("single"), 2, 2).error, "opponent_captured");
  assert.equal(G.placeBlock(s, "single", cubesOf("single"), 2, 1).error, "touches_opponent");
});
t("placing claims the tiles under the block", () => {
  const s = put(withHand(fresh(), ["domino", "single", "line3"]), "domino", 2, 0, P.rotateYaw(cubesOf("domino")));
  for (const y of [0, 1]) { assert.equal(tile(s, 2, y).owner, "blue"); assert.equal(tile(s, 2, y).status, "claimed"); }
  // (3,0) is a 2-dot tile, so a 1-high block there is placed but leaves it unclaimed
  const h = put(withHand(fresh(), ["domino", "single", "line3"]), "domino", 2, 0); assert.equal(tile(h, 2, 0).owner, "blue"); assert.equal(tile(h, 3, 0).owner, null);
});
t("height tiles: only the matching stack height claims them", () => {
  // (0,3) is a 2-dot tile. A single cube on bare ground makes a 1-high stack: placed, but not claimed.
  let s = withHand(fresh(), ["domino", "single", "tower"]);
  s = put(s, "domino", 0, 2, P.PIECES.domino.cubes); // claim (0,2),(1,2)
  const low = put(s, "single", 0, 3);
  assert.equal(tile(low, 0, 3).stack, 1); assert.equal(tile(low, 0, 3).owner, null);
  // with a 1-high stack already there, a second cube makes it 2 high and claims it
  const cells = s.board.cells.map((r) => r.map((c) => ({ ...c }))); cells[3][0].stack = 1;
  const two = put({ ...s, board: { ...s.board, cells } }, "single", 0, 3);
  assert.equal(tile(two, 0, 3).stack, 2); assert.equal(tile(two, 0, 3).owner, "blue");
});
t("height rule can be switched to 'at least'", () => {
  const rules = { ...STRATA_RULES, heightMatch: "at_least" };
  const base = G.createGame({ layout: BOARD_11, players: people, seed: 7, rules }).state;
  let s = withHand(base, ["domino", "tower", "single"]);
  s = put(s, "domino", 0, 2);
  const cells = s.board.cells.map((r) => r.map((c) => ({ ...c }))); cells[3][0].stack = 2;
  const r = put({ ...s, board: { ...s.board, cells } }, "single", 0, 3);
  assert.equal(tile(r, 0, 3).owner, "blue"); // 3 high >= 2
});
t("a block resting on an opponent's claimed tile takes it over", () => {
  let s = withHand(fresh(), ["domino", "single", "line3"]);
  const cells = s.board.cells.map((r) => r.map((c) => ({ ...c }))); cells[0][2].owner = "orange"; cells[0][2].status = "claimed";
  s = put({ ...s, board: { ...s.board, cells } }, "domino", 2, 0);
  assert.equal(tile(s, 2, 0).owner, "blue");
});
t("captured: a claimed tile enclosed by its owner, black tiles or the edge", () => {
  const s = withHand(fresh(), ["single", "domino", "line3"]);
  const p = G.placeBlock(s, "single", cubesOf("single"), 0, 0); assert.ok(p.ok);
  assert.equal(tile(p.state, 0, 0).status, "claimed", "captured only when the turn is submitted");
  const sub = G.submitTurn({ ...p.state, turn: { ...p.state.turn, hand: [] } }); assert.ok(sub.ok);
  assert.equal(tile(sub.state, 0, 0).status, "captured", "the corner is surrounded by blue and the edge");
  assert.equal(tile(sub.state, 1, 0).status, "claimed", "(2,0) beside it is still open");
  assert.equal(sub.captured, 1);
});
t("captured tiles never change hands", () => {
  let s = withHand(fresh(), ["single", "domino", "line3"]);
  s = put(s, "single", 0, 0);
  const sub = G.submitTurn({ ...s, turn: { ...s.turn, hand: [] } }).state;
  assert.equal(tile(sub, 0, 0).status, "captured");
  // orange is next; it can't touch blue's captured tile
  const o = withHand(sub, ["single", "domino", "line3"]);
  assert.equal(G.placeBlock(o, "single", cubesOf("single"), 0, 0).error, "opponent_captured");
});
t("scoring is 5 per claimed tile and 10 per captured tile", () => {
  const s = fresh(); assert.equal(G.ranking(s).find((r) => r.index === 0).score, 3 * STRATA_RULES.claimedPoints);
  const cells = s.board.cells.map((r) => r.map((c) => ({ ...c }))); cells[0][1].status = "captured";
  const r = G.ranking({ ...s, board: { ...s.board, cells } }).find((x) => x.index === 0);
  assert.equal(r.score, 2 * 5 + 10); assert.equal(r.captured, 1);
});
t("the turn: all blocks must be placed before submitting, then play passes on with a fresh hand", () => {
  let s = fresh();
  assert.equal(G.submitTurn(s).error, "hand_not_empty");
  const first = s.turn.hand.slice();
  for (const id of first) { const m = G.legalMoves(withHand(s, [id]))[0]; s = put(withHand(s, [id].concat(s.turn.hand.filter((h) => h !== id))), id, m.x, m.y, m.cubes); s = { ...s, turn: { ...s.turn, hand: s.turn.hand.filter((h) => h !== id) } }; }
  assert.equal(s.turn.hand.length, 0); assert.ok(G.canSubmit(s));
  const sub = G.submitTurn(s); assert.ok(sub.ok);
  assert.equal(sub.state.turn.player, 1); assert.equal(sub.state.turn.hand.length, 3); assert.equal(sub.state.turnNumber, 2); assert.equal(sub.state.history.length, 1);
});
t("a block that isn't in your hand can't be placed", () => assert.equal(G.placeBlock(withHand(fresh(), ["domino"]), "tower", cubesOf("tower"), 2, 1).error, "not_your_block"));
t("undo restores the board and the hand exactly, only before submitting", () => {
  const s0 = withHand(fresh(), ["domino", "single", "line3"]);
  const s1 = put(s0, "domino", 2, 0);
  const u = G.undoBlock(s1); assert.ok(u.ok);
  assert.deepEqual(u.state.board, s0.board); assert.deepEqual([...u.state.turn.hand].sort(), [...s0.turn.hand].sort()); assert.equal(u.state.turn.placed.length, 0);
  assert.equal(G.undoBlock(u.state).error, "nothing_to_undo");
});
t("the tracker triggers a final round; everyone else plays once, then it ends", () => {
  const s0 = fresh(3);
  const cells = s0.board.cells.map((r) => r.map((c) => ({ ...c })));
  let open = 0; for (const r of cells) for (const c of r) if (c.type !== "black") open++;
  let need = Math.ceil(open * 0.62) ; for (const r of cells) for (const c of r) { if (need > 0 && c.type !== "black" && !c.owner) { c.owner = "blue"; c.status = "claimed"; need--; } }
  let s = { ...s0, board: { ...s0.board, cells }, turn: { ...s0.turn, hand: [] } };
  const a = G.submitTurn(s); assert.ok(a.ok); assert.equal(a.state.status, "final_round"); assert.equal(a.state.endAfter, 1);
  const b = G.submitTurn({ ...a.state, turn: { ...a.state.turn, hand: [] } }); assert.ok(b.ok); assert.equal(b.state.status, "finished");
  assert.equal(G.submitTurn(b.state).error, "game_over"); assert.equal(G.placeBlock(b.state, "tower", cubesOf("tower"), 0, 0).error, "game_over");
});
t("a stuck player can end the turn; everyone stuck ends the game", () => {
  // 3x3 board: two start tiles and everything else black, so nothing can ever be placed
  const layout = { id: "t", name: "t", width: 3, height: 3, black: [[1, 0], [2, 0], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], dots: [], starts: [{ color: "blue", cells: [[0, 0]], diamond: [0, 0] }, { color: "orange", cells: [[0, 1]], diamond: [0, 1] }] };
  let s = G.createGame({ layout, players: people, seed: 1, rules: { ...STRATA_RULES, territoryTrackerShare: 2 } }).state; // tracker disabled so only passing can end it
  assert.ok(G.isStuck(s)); assert.ok(G.canSubmit(s));
  s = G.submitTurn(s).state; assert.equal(s.status, "playing"); assert.equal(s.history[0].ended, "pass");
  s = G.submitTurn(s).state; assert.equal(s.status, "finished");
});
t("winners: highest score, then captured tiles; equal means a tie", () => {
  const s = fresh(); assert.equal(G.winners(s).length, 2);
  const cells = s.board.cells.map((r) => r.map((c) => ({ ...c }))); cells[5][5].owner = "orange"; cells[5][5].status = "claimed";
  const w = G.winners({ ...s, board: { ...s.board, cells } }); assert.equal(w.length, 1); assert.equal(w[0].color, "orange");
});
t("replaying the move history rebuilds the same game", () => {
  let s = fresh(11); const opts = { layout: BOARD_11, players: people, seed: 11 };
  for (let turn = 0; turn < 4; turn++) {
    while (s.turn.hand.length && !G.isStuck(s)) { const m = G.legalMoves(s, 1)[0]; s = G.placeBlock(s, m.pieceId, m.cubes, m.x, m.y).state; }
    s = G.submitTurn(s).state;
  }
  const r = G.replay(opts, s.history); assert.ok(r.ok, r.error);
  assert.deepEqual(r.state.board, s.board); assert.equal(r.state.turnNumber, s.turnNumber);
  assert.deepEqual(G.replay(opts, s.history, 2).state.history.length, 2);
});
t("a random full game plays to the end with no illegal states", () => {
  let s = fresh(21, people); let guard = 0;
  while (s.status !== "finished" && guard++ < 400) {
    while (s.turn.hand.length && !G.isStuck(s)) {
      const all = G.legalMoves(s); const pick = all[Math.floor(RNG.nextRandom(guard * 977 + s.turnNumber * 31 + s.turn.hand.length).value * all.length)];
      const r = G.placeBlock(s, pick.pieceId, pick.cubes, pick.x, pick.y); assert.ok(r.ok, r.error); s = r.state;
    }
    const r = G.submitTurn(s); assert.ok(r.ok, r.error); s = r.state;
    for (const row of s.board.cells) for (const c of row) { assert.ok(c.stack >= 0 && c.stack <= 8); if (c.type === "black") { assert.equal(c.stack, 0); assert.equal(c.owner, null); } }
  }
  assert.equal(s.status, "finished"); assert.ok(guard < 400, "the game ended by itself");
  const top = G.ranking(s)[0]; assert.ok(top.score > 0); console.log("   random game:", s.history.length, "turns; scores", G.ranking(s).map((r) => `${r.player.name} ${r.score}`).join(", "));
});
console.log(`\n${n} passed`);
