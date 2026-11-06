import type { Board, Cell, PlayerColor } from "./types.ts";
import { place, type Placement } from "./placement.ts";
import { orientations, PIECES, stands, type Cube, type Cubes } from "./pieces.ts";
import { STRATA_RULES, type StrataRules } from "../config/rules.ts";

export type Reason = "off_board" | "overlap" | "black_tile" | "unstable" | "needs_bridge" | "opponent_captured" | "not_connected" | "not_touching_territory";
export const PLAY_REASON_TEXT: Record<Reason, string> = {
  off_board: "Part of the block is off the board.",
  overlap: "That spot is already taken by another block.",
  black_tile: "A block can't stand on a black tile. Only a bridge can cross one.",
  unstable: "That block would tip over. It has to stand on its own.",
  needs_bridge: "Black tiles and tiles captured by another player can only be crossed by a bridge.",
  opponent_captured: "A block can't stand on a tile another player has captured. Only a bridge can cross it.",
  not_connected: "Each block has to touch the blocks you already placed, along a flat side.",
  not_touching_territory: "Your first block has to be on or beside your own territory.",
};

export type BlockCheck = { ok: true; placement: Placement } | { ok: false; reason: Reason };
const D4: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const D6: ReadonlyArray<readonly [number, number, number]> = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const cellOf = (b: Board, x: number, y: number): Cell | null => b.cells[y]?.[x] ?? null;
const isTerritory = (c: Cell | null, color: PlayerColor) => !!c && c.owner === color && (c.status === "claimed" || c.status === "captured");
const isRestricted = (c: Cell, color: PlayerColor) => c.type === "black" || (!!c.owner && c.owner !== color && c.status === "captured");
export const worldKeys = (cubes: ReadonlyArray<Cube>) => new Set(cubes.map((c) => c.join(",")));

/**
 * Checks one block against the rules for the player holding `color`.
 * `earlier` are the cubes of blocks already placed this turn. Nothing is claimed here: blocks are temporary until the turn is confirmed.
 */
export function checkBlock(board: Board, color: PlayerColor, earlier: ReadonlyArray<Cube>, cubes: Cubes, x: number, y: number, rules: StrataRules = STRATA_RULES): BlockCheck {
  const prev = worldKeys(earlier);
  const p = place(board, cubes, x, y, prev);
  if (!p.valid) return { ok: false, reason: p.reason! };

  for (const c of p.ground) {
    const cell = cellOf(board, c.x, c.y)!;
    if (isRestricted(cell, color)) return { ok: false, reason: "opponent_captured" };
  }
  if (rules.restrictedNeedBridge && !p.bridge) {
    if (p.span.some((c) => isRestricted(cellOf(board, c.x, c.y)!, color))) return { ok: false, reason: "needs_bridge" };
  }

  if (rules.connectedArrangement && earlier.length) {
    const touches = p.world.some(([wx, wy, wz]) => D6.some(([dx, dy, dz]) => prev.has(`${wx + dx},${wy + dy},${wz + dz}`)));
    if (!touches) return { ok: false, reason: "not_connected" };
  } else if (!earlier.length && rules.mustTouchOwnTerritory) {
    // Any valid arrangement can be placed starting from the block that touches your territory, so the first block has to.
    const onOrNext = p.cells.some((c) => isTerritory(cellOf(board, c.x, c.y), color) || D4.some(([dx, dy]) => isTerritory(cellOf(board, c.x + dx, c.y + dy), color)));
    if (!onOrNext) return { ok: false, reason: "not_touching_territory" };
  }
  return { ok: true, placement: p };
}

export type TurnBlock = { world: Cube[] };

/** What one confirmed turn does to the board. Pure: returns a new board and lists of what changed. */
export type Resolution = {
  board: Board;
  /** Tiles newly claimed this turn (including tiles taken from other players). */
  claimed: Array<{ x: number; y: number; from: PlayerColor | null }>;
  /** Tiles that became captured this turn (before: claimed, or just claimed by a bridge and enclosed). */
  captured: Array<{ x: number; y: number; owner: PlayerColor }>;
};

/**
 * Applies a finished turn: the tiles under the blocks are claimed (a height tile only when the column of cubes on it is as high as its dots),
 * then claimed tiles that are completely enclosed become captured. The blocks themselves are never stored on the board.
 */
export function resolveBlocks(board: Board, color: PlayerColor, blocks: ReadonlyArray<TurnBlock>, rules: StrataRules = STRATA_RULES): Resolution {
  const cubes = new Set(blocks.flatMap((b) => b.world.map((c) => c.join(","))));
  const covered = new Map<string, { x: number; y: number }>();
  for (const b of blocks) for (const [x, y] of b.world) covered.set(`${x},${y}`, { x, y });
  const next: Board = { ...board, cells: board.cells.map((r) => r.map((c) => ({ ...c }))) };
  const claimed: Resolution["claimed"] = [];
  for (const { x, y } of covered.values()) {
    const c = next.cells[y][x];
    if (c.type === "height" && c.height != null) {
      // column of cubes standing on the tile, counted up from the board
      let h = 0; while (cubes.has(`${x},${y},${h}`)) h++;
      const ok = rules.heightMatch === "exact" ? h === c.height : h >= c.height;
      if (!ok) continue;
    }
    if (c.owner === color && (c.status === "claimed" || c.status === "captured")) continue; // already mine
    claimed.push({ x, y, from: c.owner });
    c.owner = color; c.status = "claimed";
  }
  const done = captureAll(next);
  return { board: done.board, claimed, captured: done.captured };
}

/** A claimed tile completely surrounded by its owner's tiles, black tiles or the board edge becomes captured. */
export function captureAll(board: Board): { board: Board; captured: Array<{ x: number; y: number; owner: PlayerColor }> } {
  const cells = board.cells.map((r) => r.map((c) => ({ ...c })));
  const captured: Array<{ x: number; y: number; owner: PlayerColor }> = [];
  for (const row of board.cells) for (const c of row) {
    if (!c.owner || c.status !== "claimed") continue;
    const closed = D4.every(([dx, dy]) => { const n = cellOf(board, c.x + dx, c.y + dy); return !n || (n.type === "black" && !n.owner) || n.owner === c.owner; });
    if (closed) { cells[c.y][c.x].status = "captured"; captured.push({ x: c.x, y: c.y, owner: c.owner }); }
  }
  return { board: { ...board, cells }, captured };
}

export type Tally = { claimed: number; captured: number; heightBonus: number; score: number };
/** Points for everyone, worked out from the board alone. Height bonuses are paid only for CAPTURED height tiles. */
export function tallies(board: Board, rules: StrataRules = STRATA_RULES): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  for (const row of board.cells) for (const c of row) {
    if (!c.owner || c.status === "unclaimed") continue;
    const t = (out[c.owner] ??= { claimed: 0, captured: 0, heightBonus: 0, score: 0 });
    if (c.status === "captured") { t.captured++; if (c.type === "height" && c.height != null) t.heightBonus += rules.heightBonusPoints[c.height] ?? 0; } else t.claimed++;
  }
  for (const t of Object.values(out)) t.score = t.claimed * rules.claimedPoints + t.captured * rules.capturedPoints + t.heightBonus;
  return out;
}

/** Share of the open tiles that someone holds. Drives the end-of-game tracker. Black tiles only count once someone has claimed them. */
export function territoryShare(board: Board): number {
  let open = 0, held = 0;
  for (const row of board.cells) for (const c of row) { if (c.type === "black" && !c.owner) continue; open++; if (c.owner && c.status !== "unclaimed") held++; }
  return open ? held / open : 0;
}

export type Candidate = { pieceId: string; cubes: Cube[]; x: number; y: number };

/** Every legal way to place one block from the list. Used to find stuck hands and by the computer players. */
export function legalPlacements(board: Board, color: PlayerColor, earlier: ReadonlyArray<Cube>, pieceIds: readonly string[], rules: StrataRules = STRATA_RULES, limit = Infinity): Candidate[] {
  const out: Candidate[] = [];
  // Quick pre-filter: a legal block touches the blocks already placed, or (for the first block) your territory, so skip positions far from both.
  const near = new Set<string>();
  const mark = (x: number, y: number) => { near.add(`${x},${y}`); for (const [dx, dy] of D4) near.add(`${x + dx},${y + dy}`); };
  if (earlier.length) for (const [x, y] of earlier) mark(x, y);
  else for (const row of board.cells) for (const c of row) if (isTerritory(c, color)) mark(c.x, c.y);
  for (const id of new Set(pieceIds)) {
    for (const cubes of orientations(PIECES[id].cubes)) {
      if (!stands(cubes)) continue;
      const w = Math.max(...cubes.map((c) => c[0])) + 1, d = Math.max(...cubes.map((c) => c[1])) + 1;
      const foot = [...new Set(cubes.map((c) => `${c[0]},${c[1]}`))].map((k) => k.split(",").map(Number) as [number, number]);
      for (let y = 0; y <= board.height - d; y++) for (let x = 0; x <= board.width - w; x++) {
        if (!foot.some(([fx, fy]) => near.has(`${x + fx},${y + fy}`))) continue;
        if (checkBlock(board, color, earlier, cubes, x, y, rules).ok) { out.push({ pieceId: id, cubes, x, y }); if (out.length >= limit) return out; }
      }
    }
  }
  return out;
}
