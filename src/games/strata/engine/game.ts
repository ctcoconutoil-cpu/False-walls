import type { Board, BoardLayout, PlayerColor } from "./types.ts";
import { createBoard } from "./board.ts";
import { applyBlock, captureAll, checkBlock, legalPlacements, tallies, territoryShare, type Reason, type Tally } from "./play.ts";
import { STARTER_SET, type Cube, type Cubes } from "./pieces.ts";
import { draw } from "./rng.ts";
import { STRATA_RULES, type StrataRules } from "../config/rules.ts";

export type PlayerInfo = { id: string; name: string; color: PlayerColor; kind: "human" | "ai"; level?: "beginner" | "intermediate" | "advanced" | "expert" };
export type PlacedBlock = { pieceId: string; cubes: Cube[]; x: number; y: number; world: Cube[] };
export type Turn = {
  /** Index into `players`. */
  player: number;
  /** Blocks still to place this turn. */
  hand: string[];
  placed: PlacedBlock[];
  /** The board before each block this turn, so undo is exact. */
  snapshots: Board[];
};
export type MoveRecord = { turnNumber: number; player: number; blocks: Array<{ pieceId: string; cubes: Cube[]; x: number; y: number }>; captured: number; ended: "submit" | "stuck" | "pass" };
export type GameStatus = "playing" | "final_round" | "finished";

export type GameState = {
  rules: StrataRules;
  board: Board;
  players: PlayerInfo[];
  turn: Turn;
  turnNumber: number;
  seed: number;
  status: GameStatus;
  /** Index of the player whose turn ends the game, once the tracker has filled. */
  endAfter: number | null;
  /** Turns in a row that ended with nothing placed. */
  passes: number;
  history: MoveRecord[];
};

export type GameError = Reason | "not_your_block" | "no_blocks_left" | "game_over" | "hand_not_empty" | "nothing_to_undo" | "bad_players" | "no_start_area";
export type Result<T> = ({ ok: true } & T) | { ok: false; error: GameError };

export function createGame(opts: { layout: BoardLayout; players: PlayerInfo[]; seed: number; rules?: StrataRules }): Result<{ state: GameState }> {
  const rules = opts.rules ?? STRATA_RULES;
  const n = opts.players.length;
  if (n < rules.minPlayers || n > rules.maxPlayers) return { ok: false, error: "bad_players" };
  const colours = new Set(opts.players.map((p) => p.color));
  if (colours.size !== n || !opts.players.every((p) => opts.layout.starts.some((s) => s.color === p.color))) return { ok: false, error: "no_start_area" };
  // Only the colours in play keep a starting area, so an unused corner stays open ground.
  const layout: BoardLayout = { ...opts.layout, starts: opts.layout.starts.filter((s) => colours.has(s.color)) };
  const hand = draw(STARTER_SET, rules.blocksPerTurn, opts.seed);
  const board = createBoard(layout);
  return { ok: true, state: { rules, board, players: opts.players, turn: { player: 0, hand: hand.picks, placed: [], snapshots: [] }, turnNumber: 1, seed: hand.seed, status: "playing", endAfter: null, passes: 0, history: [] } };
}

export const activePlayer = (s: GameState) => s.players[s.turn.player];
const earlierCubes = (s: GameState): Cube[] => s.turn.placed.flatMap((p) => p.world);

/** Would this block be legal right now? Used for the live preview. */
export function checkMove(s: GameState, cubes: Cubes, x: number, y: number) {
  return checkBlock(s.board, activePlayer(s).color, earlierCubes(s), cubes, x, y, s.rules);
}

export function placeBlock(s: GameState, pieceId: string, cubes: Cubes, x: number, y: number): Result<{ state: GameState }> {
  if (s.status === "finished") return { ok: false, error: "game_over" };
  if (!s.turn.hand.includes(pieceId)) return { ok: false, error: s.turn.hand.length ? "not_your_block" : "no_blocks_left" };
  const me = activePlayer(s);
  const chk = checkBlock(s.board, me.color, earlierCubes(s), cubes, x, y, s.rules);
  if (!chk.ok) return { ok: false, error: chk.reason };
  const hand = [...s.turn.hand];
  hand.splice(hand.indexOf(pieceId), 1);
  const board = applyBlock(s.board, me.color, chk.placement, s.rules);
  const block: PlacedBlock = { pieceId, cubes: cubes.map((c) => [...c] as Cube), x, y, world: chk.placement.world };
  return { ok: true, state: { ...s, board, turn: { ...s.turn, hand, placed: [...s.turn.placed, block], snapshots: [...s.turn.snapshots, s.board] } } };
}

/** Takes back the last block placed this turn. Only possible before the turn is submitted. */
export function undoBlock(s: GameState): Result<{ state: GameState }> {
  const last = s.turn.placed[s.turn.placed.length - 1];
  if (!last || s.status === "finished") return { ok: false, error: "nothing_to_undo" };
  return { ok: true, state: { ...s, board: s.turn.snapshots[s.turn.snapshots.length - 1], turn: { ...s.turn, hand: [...s.turn.hand, last.pieceId], placed: s.turn.placed.slice(0, -1), snapshots: s.turn.snapshots.slice(0, -1) } } };
}

/** Every legal placement for the blocks still in hand. */
export const legalMoves = (s: GameState, limit = Infinity) => legalPlacements(s.board, activePlayer(s).color, earlierCubes(s), s.turn.hand, s.rules, limit);
/** True when blocks remain but none of them can legally go anywhere. */
export const isStuck = (s: GameState) => s.turn.hand.length > 0 && legalMoves(s, 1).length === 0;
export const canSubmit = (s: GameState) => s.status !== "finished" && (s.turn.hand.length === 0 || (s.rules.allowEndWhenStuck && isStuck(s)));

export function ranking(s: GameState): Array<{ player: PlayerInfo; index: number } & Tally> {
  const t = tallies(s.board, s.rules);
  return s.players
    .map((player, index) => ({ player, index, ...(t[player.color] ?? { claimed: 0, captured: 0, score: 0 }) }))
    .sort((a, b) => b.score - a.score || b.captured - a.captured || a.index - b.index);
}
/** Winners (more than one means a tie on points and captured tiles). */
export function winners(s: GameState): PlayerInfo[] {
  const r = ranking(s);
  return r.filter((x) => x.score === r[0].score && x.captured === r[0].captured).map((x) => x.player);
}

/** Ends the turn: captures enclosed tiles, scores, checks the tracker, and passes play on. */
export function submitTurn(s: GameState): Result<{ state: GameState; captured: number }> {
  if (s.status === "finished") return { ok: false, error: "game_over" };
  if (!canSubmit(s)) return { ok: false, error: "hand_not_empty" };
  const n = s.players.length;
  const { board, captured } = captureAll(s.board);
  const placedNothing = s.turn.placed.length === 0;
  const record: MoveRecord = {
    turnNumber: s.turnNumber, player: s.turn.player, captured: captured.length,
    blocks: s.turn.placed.map(({ pieceId, cubes, x, y }) => ({ pieceId, cubes, x, y })),
    ended: placedNothing ? "pass" : s.turn.hand.length ? "stuck" : "submit",
  };
  const passes = placedNothing ? s.passes + 1 : 0;
  let status: GameStatus = s.status, endAfter = s.endAfter;
  if (status === "playing" && territoryShare(board) >= s.rules.territoryTrackerShare) { status = "final_round"; endAfter = (s.turn.player + n - 1) % n; }
  const over = passes >= n || (status === "final_round" && s.turn.player === endAfter);
  const nextPlayer = (s.turn.player + 1) % n;
  const hand = draw(STARTER_SET, s.rules.blocksPerTurn, s.seed);
  return {
    ok: true, captured: captured.length,
    state: { ...s, board, status: over ? "finished" : status, endAfter, passes, history: [...s.history, record], turnNumber: s.turnNumber + 1, seed: hand.seed, turn: { player: nextPlayer, hand: hand.picks, placed: [], snapshots: [] } },
  };
}

/** Rebuilds a game from its move history (for replays and server checks). Returns the state after `upTo` turns. */
export function replay(opts: { layout: BoardLayout; players: PlayerInfo[]; seed: number; rules?: StrataRules }, history: MoveRecord[], upTo = history.length): Result<{ state: GameState }> {
  const made = createGame(opts);
  if (!made.ok) return made;
  let s = made.state;
  for (const rec of history.slice(0, upTo)) {
    for (const b of rec.blocks) {
      const r = placeBlock(s, b.pieceId, b.cubes, b.x, b.y);
      if (!r.ok) return r;
      s = r.state;
    }
    const sub = submitTurn(s);
    if (!sub.ok) return sub;
    s = sub.state;
  }
  return { ok: true, state: s };
}
