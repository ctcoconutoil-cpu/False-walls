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
console.log(`\n${n} passed`);
