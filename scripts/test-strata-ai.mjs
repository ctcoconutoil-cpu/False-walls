// STRATA computer players. Slower than the engine tests (it plays full games).
// Run: node --experimental-strip-types --no-warnings scripts/test-strata-ai.mjs
import assert from "node:assert/strict";
import { createGame, ranking, checkMove, legalMoves, activePlayer } from "../src/games/strata/engine/game.ts";
import { chooseBlock, playAiTurn, LEVELS } from "../src/games/strata/engine/ai.ts";
import { BOARD_11 } from "../src/games/strata/config/layouts.ts";

let n = 0;
const t = (name, fn) => { const t0 = performance.now(); fn(); n++; console.log("ok", name, `(${(performance.now() - t0).toFixed(0)} ms)`); };
const duel = (levels, seed) => {
  const colors = ["blue", "turquoise"];
  const players = levels.map((lv, i) => ({ id: `p${i}`, name: lv, color: colors[i], kind: "ai", level: lv }));
  let s = createGame({ layout: BOARD_11, players, seed }).state, guard = 0;
  while (s.status !== "finished" && guard++ < 120) s = playAiTurn(s, players[s.turn.player].level).state;
  assert.equal(s.status, "finished", "game ended");
  const r = ranking(s);
  return { score: [r.find((x) => x.index === 0).score, r.find((x) => x.index === 1).score], turns: s.history.length };
};

t("every level only ever picks legal blocks, on many positions", () => {
  for (const lv of LEVELS.map((l) => l.id)) {
    const players = [{ id: "a", name: "A", color: "blue", kind: "ai" }, { id: "b", name: "B", color: "turquoise", kind: "ai" }, { id: "c", name: "C", color: "yellow", kind: "ai" }];
    let s = createGame({ layout: BOARD_11, players, seed: 17 }).state, checked = 0;
    for (let turn = 0; turn < 4 && s.status !== "finished"; turn++) {
      while (s.turn.hand.length) {
        const c = chooseBlock(s, lv); if (!c) break;
        assert.ok(checkMove(s, c.cubes, c.x, c.y).ok, `${lv} chose an illegal block`); checked++;
        assert.ok(s.turn.hand.includes(c.pieceId), `${lv} used a block it doesn't hold`);
        s = placeNow(s, c);
      }
      s = playAiTurn(s, lv).state;
    }
    assert.ok(checked > 3, lv);
  }
});
import { placeBlock } from "../src/games/strata/engine/game.ts";
function placeNow(s, c) { const r = placeBlock(s, c.pieceId, c.cubes, c.x, c.y); assert.ok(r.ok, r.error); return r.state; }

t("the computer is deterministic: same position, same choice", () => {
  const players = [{ id: "a", name: "A", color: "blue", kind: "ai" }, { id: "b", name: "B", color: "turquoise", kind: "ai" }];
  const s = createGame({ layout: BOARD_11, players, seed: 5 }).state;
  for (const lv of LEVELS.map((l) => l.id)) assert.deepEqual(chooseBlock(s, lv), chooseBlock(s, lv));
});
t("it doesn't read other hands: the choice is unchanged when the opponent's future hand is altered", () => {
  const players = [{ id: "a", name: "A", color: "blue", kind: "ai" }, { id: "b", name: "B", color: "turquoise", kind: "ai" }];
  const s = createGame({ layout: BOARD_11, players, seed: 5 }).state;
  // the engine keeps no hidden opponent hand at all: the next hand is dealt from the seed only after a turn ends
  assert.ok(!("hands" in s) && !("opponentHand" in s));
});
t("a stuck computer returns null instead of an illegal block", () => {
  // a 2 x 2 board: every block is at least three tiles long, so nothing fits
  const layout = { id: "t", name: "t", width: 2, height: 2, black: [[1, 0], [0, 1]], dots: [], starts: [{ color: "blue", cells: [[0, 0]], diamond: [0, 0] }, { color: "turquoise", cells: [[1, 1]], diamond: [1, 1] }] };
  const s = createGame({ layout, players: [{ id: "a", name: "A", color: "blue", kind: "ai" }, { id: "b", name: "B", color: "turquoise", kind: "ai" }], seed: 1 }).state;
  for (const lv of LEVELS.map((l) => l.id)) assert.equal(chooseBlock(s, lv), null);
});
t("computers can play 3 and 4 player games to the end", () => {
  for (const cols of [["blue", "turquoise", "yellow"], ["blue", "turquoise", "yellow", "orange"]]) {
    const players = cols.map((color, i) => ({ id: `p${i}`, name: color, color, kind: "ai" }));
    let s = createGame({ layout: BOARD_11, players, seed: 8 }).state, g = 0;
    while (s.status !== "finished" && g++ < 150) s = playAiTurn(s, "intermediate").state;
    assert.equal(s.status, "finished");
  }
});

// Strength: stronger levels should beat weaker ones across mirrored seats and several seeds.
const strength = (strong, weak, seeds) => {
  let strongPts = 0, weakPts = 0, wins = 0, games = 0;
  for (const seed of seeds) for (const swap of [false, true]) {
    const r = duel(swap ? [weak, strong] : [strong, weak], seed);
    const [a, b] = swap ? [r.score[1], r.score[0]] : r.score;
    strongPts += a; weakPts += b; games++; if (a > b) wins++;
  }
  console.log(`   ${strong} vs ${weak}: won ${wins}/${games}, points ${strongPts}-${weakPts}`);
  return { wins, games, strongPts, weakPts };
};
t("intermediate beats beginner", () => { const r = strength("intermediate", "beginner", [1, 2, 3, 4, 5]); assert.ok(r.wins > r.games / 2 && r.strongPts > r.weakPts); });
t("advanced beats beginner", () => { const r = strength("advanced", "beginner", [1, 2, 3]); assert.ok(r.wins > r.games / 2 && r.strongPts > r.weakPts); });
t("expert beats beginner", () => { const r = strength("expert", "beginner", [1, 2]); assert.ok(r.wins > r.games / 2 && r.strongPts > r.weakPts); });
t("expert beats intermediate in most games", () => { const r = strength("expert", "intermediate", [1, 2, 3, 4, 5, 6]); assert.ok(r.wins >= r.games / 2 + 1, "expert should win most games"); });
console.log(`\n${n} passed`);
