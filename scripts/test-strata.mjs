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
console.log(`\n${n} passed`);
