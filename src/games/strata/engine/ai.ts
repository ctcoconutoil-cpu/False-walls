import type { Board, PlayerColor } from "./types.ts";
import { activePlayer, legalMoves, placeBlock, projectBoard, submitTurn, type GameState } from "./game.ts";
import { captureAll, checkBlock, legalPlacements, resolveBlocks, tallies, type Candidate } from "./play.ts";
import { STARTER_SET } from "./pieces.ts";
import { nextRandom } from "./rng.ts";
import type { StrataRules } from "../config/rules.ts";

/**
 * Computer players. They use exactly the same rule functions as people (legalMoves, placeBlock, submitTurn), see only the public
 * board and their own hand, and assume an opponent could hold ANY block (the real hands are never read).
 */
export type Level = "beginner" | "intermediate" | "advanced" | "expert";
export const LEVELS: Array<{ id: Level; name: string; blurb: string }> = [
  { id: "beginner", name: "Beginner", blurb: "Plays legal moves and spreads out, but often misses better ones." },
  { id: "intermediate", name: "Intermediate", blurb: "Picks the move that scores best and hunts for captures." },
  { id: "advanced", name: "Advanced", blurb: "Weighs your best reply and plans its next block." },
  { id: "expert", name: "Expert", blurb: "Plans all three blocks of a turn and defends against every opponent." },
];

type Weights = { opp: number; frontier: number; pockets: number };
const W: Record<Level, Weights> = {
  beginner: { opp: 0, frontier: 0, pockets: 0 },
  intermediate: { opp: 0.5, frontier: 0, pockets: 1 },
  advanced: { opp: 0.6, frontier: 0.2, pockets: 1.2 },
  expert: { opp: 0.7, frontier: 0.2, pockets: 1.5 },
};
const D4: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** How good a board is for `me`: own points minus the best opponent's, plus room to grow and tiles about to be enclosed. */
export function evaluate(board: Board, me: PlayerColor, rules: StrataRules, w: Weights): number {
  const cap = captureAll(board).board;
  const t = tallies(cap, rules);
  let best = 0;
  for (const [c, v] of Object.entries(t)) if (c !== me && v.score > best) best = v.score;
  let value = (t[me]?.score ?? 0) - w.opp * best;
  if (w.frontier || w.pockets) {
    let frontier = 0, pockets = 0;
    for (const row of cap.cells) for (const c of row) {
      if (c.type === "black" || c.owner) continue;
      let mine = 0, closed = 0;
      for (const [dx, dy] of D4) { const n = cap.cells[c.y + dy]?.[c.x + dx]; if (!n || n.type === "black") closed++; else if (n.owner === me) { mine++; closed++; } }
      if (mine > 0) frontier++;
      if (closed >= 3 && mine > 0) pockets++;
    }
    value += w.frontier * frontier + w.pockets * pockets;
  }
  return value;
}

type Step = { cand: Candidate; state: GameState };
const apply = (s: GameState, c: Candidate): Step | null => { const r = placeBlock(s, c.pieceId, c.cubes, c.x, c.y); return r.ok ? { cand: c, state: r.state } : null; };
const me = (s: GameState) => activePlayer(s).color;

/** The worst my position can get after one reply from `opp`, who might hold any block. */
function worstReply(board: Board, mine: PlayerColor, opp: PlayerColor, rules: StrataRules, w: Weights): number {
  const after = captureAll(board).board;
  let worst = evaluate(after, mine, rules, w);
  for (const c of legalPlacements(after, opp, [], STARTER_SET, rules)) {
    const chk = checkBlock(after, opp, [], c.cubes, c.x, c.y, rules);
    if (!chk.ok) continue;
    const v = evaluate(resolveBlocks(after, opp, [{ world: chk.placement.world }], rules).board, mine, rules, w);
    if (v < worst) worst = v;
  }
  return worst;
}
const opponentsOf = (s: GameState) => s.players.map((p) => p.color).filter((c) => c !== me(s));
const nextOpponent = (s: GameState) => s.players[(s.turn.player + 1) % s.players.length].color;

const seedFor = (s: GameState, level: Level) => (s.seed ^ Math.imul(s.turnNumber, 7919) ^ Math.imul(s.turn.placed.length + 1, 104729) ^ Math.imul(LEVELS.findIndex((l) => l.id === level) + 1, 31337)) >>> 0;
const topN = <T,>(items: T[], score: (t: T) => number, n: number): Array<{ item: T; v: number }> => items.map((item) => ({ item, v: score(item) })).sort((a, b) => b.v - a.v).slice(0, n);

/**
 * The next block this computer player would place, or null when none of its remaining blocks fits anywhere.
 * Deterministic for a given game state and level, so games can be replayed and checked.
 */
export function chooseBlock(state: GameState, level: Level): Candidate | null {
  const cands = legalMoves(state);
  if (!cands.length) return null;
  const rules = state.rules, mine = me(state), w = W[level];
  let rng = seedFor(state, level);
  const rand = () => { const r = nextRandom(rng); rng = r.seed; return r.value; };
  const after = (c: Candidate) => apply(state, c)!.state;
  const val = (c: Candidate, ww: Weights = w) => evaluate(projectBoard(after(c)), mine, rules, ww);

  if (level === "beginner") {
    if (rand() < 0.35) return cands[Math.floor(rand() * cands.length)];
    const ranked = topN(cands, (c) => val(c) + rand() * 6, Math.max(1, Math.ceil(cands.length * 0.3)));
    return ranked[Math.floor(rand() * ranked.length)].item;
  }
  if (level === "intermediate") return topN(cands, (c) => val(c) + rand() * 0.01, 1)[0].item;

  if (level === "advanced") {
    const nextOpp = nextOpponent(state);
    const shortlist = topN(cands, (c) => val(c), 8);
    const scored = shortlist.map(({ item }) => {
      const s2 = after(item);
      if (s2.turn.hand.length) {
        // plan my next block too: take the best follow-up
        const follow = legalMoves(s2);
        const best = follow.length ? Math.max(...topN(follow, (f) => evaluate(projectBoard(apply(s2, f)!.state), mine, rules, w), 1).map((x) => x.v)) : evaluate(projectBoard(s2), mine, rules, w);
        return { item, v: best };
      }
      return { item, v: 0.5 * evaluate(projectBoard(s2), mine, rules, w) + 0.5 * worstReply(projectBoard(s2), mine, nextOpp, rules, w) };
    });
    return scored.sort((a, b) => b.v - a.v)[0].item;
  }

  // expert: beam search over the rest of this turn's blocks, then test the best few finished turns against every opponent's reply
  const widths = [6, 4, 3];
  type Node = { first: Candidate; state: GameState };
  let beam: Node[] = topN(cands, (c) => val(c), widths[0]).map(({ item }) => ({ first: item, state: after(item) }));
  const finished: Node[] = [];
  for (let depth = 1; beam.length && depth <= 3; depth++) {
    const next: Node[] = [];
    for (const n of beam) {
      if (!n.state.turn.hand.length) { finished.push(n); continue; }
      const follow = legalMoves(n.state);
      if (!follow.length) { finished.push(n); continue; }
      for (const { item } of topN(follow, (f) => evaluate(projectBoard(apply(n.state, f)!.state), mine, rules, w), widths[Math.min(depth, 2)])) next.push({ first: n.first, state: apply(n.state, item)!.state });
    }
    beam = next;
  }
  finished.push(...beam);
  const leaves = topN(finished, (n) => evaluate(projectBoard(n.state), mine, rules, w), 6);
  const opps = opponentsOf(state);
  // Blend what the finished turn is worth now with its worst case after any opponent's reply, so the expert stays ambitious but safe.
  const final = leaves.map(({ item, v }) => ({ item, v: 0.5 * v + 0.5 * Math.min(...opps.map((o) => worstReply(projectBoard(item.state), mine, o, rules, w))) }));
  return final.sort((a, b) => b.v - a.v)[0].item.first;
}

/** Plays a whole computer turn with no animation (tests and fast-forward). */
export function playAiTurn(state: GameState, level: Level): { state: GameState; blocks: Candidate[] } {
  let s = state;
  const blocks: Candidate[] = [];
  while (s.turn.hand.length) {
    const c = chooseBlock(s, level);
    if (!c) break;
    const r = placeBlock(s, c.pieceId, c.cubes, c.x, c.y);
    if (!r.ok) throw new Error(`The ${level} computer chose an illegal block (${r.error})`);
    s = r.state; blocks.push(c);
  }
  const sub = submitTurn(s);
  if (!sub.ok) throw new Error(`The ${level} computer couldn't end its turn (${sub.error})`);
  return { state: sub.state, blocks };
}
