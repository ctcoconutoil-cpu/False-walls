import type { Board, Cell, PlayerColor } from "./types.ts";
import { commit, place, type Placement } from "./placement.ts";
import { orientations, PIECES, type Cube, type Cubes } from "./pieces.ts";
import { STRATA_RULES, type StrataRules } from "../config/rules.ts";

export type Reason = "off_board" | "black_tile" | "too_tall" | "touches_black" | "opponent_captured" | "touches_opponent" | "not_connected";
export const PLAY_REASON_TEXT: Record<Reason, string> = {
  off_board: "Part of the block is off the board.",
  black_tile: "A block can't stand on a black tile.",
  too_tall: "That stack would be too tall.",
  touches_black: "A block can't touch a black tile.",
  opponent_captured: "That tile is captured by another player.",
  touches_opponent: "A block can't touch another player's captured tiles.",
  not_connected: "A block has to touch your territory or a block you already placed this turn.",
};

export type BlockCheck = { ok: true; placement: Placement } | { ok: false; reason: Reason };
const D4: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const D6: ReadonlyArray<readonly [number, number, number]> = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const cellOf = (b: Board, x: number, y: number): Cell | null => b.cells[y]?.[x] ?? null;
const isTerritory = (c: Cell | null, color: PlayerColor) => !!c && c.owner === color && (c.status === "claimed" || c.status === "captured");

/**
 * Checks one block against the rules, for the player holding `color`.
 * `earlier` are the world cubes of blocks already placed this turn.
 */
export function checkBlock(board: Board, color: PlayerColor, earlier: ReadonlyArray<Cube>, cubes: Cubes, x: number, y: number, rules: StrataRules = STRATA_RULES): BlockCheck {
  const p = place(board, cubes, x, y);
  if (!p.valid) return { ok: false, reason: p.reason! };
  const here = new Set(p.cells.map((c) => `${c.x},${c.y}`));

  for (const c of p.cells) {
    const cell = cellOf(board, c.x, c.y)!;
    if (cell.owner && cell.owner !== color && cell.status === "captured") return { ok: false, reason: "opponent_captured" };
  }
  // A cube standing on the board touches whatever is beside it. Higher cubes only touch other cubes.
  for (const [wx, wy, wz] of p.world) {
    if (wz !== 0) continue;
    for (const [dx, dy] of D4) {
      const n = cellOf(board, wx + dx, wy + dy);
      if (!n || here.has(`${wx + dx},${wy + dy}`)) continue;
      if (n.type === "black") return { ok: false, reason: "touches_black" };
      if (n.owner && n.owner !== color && n.status === "captured") return { ok: false, reason: "touches_opponent" };
    }
  }

  const onOrNextToTerritory = p.cells.some((c) => isTerritory(cellOf(board, c.x, c.y), color) || D4.some(([dx, dy]) => isTerritory(cellOf(board, c.x + dx, c.y + dy), color)));
  if (rules.chainBlocks) {
    const prev = new Set(earlier.map((c) => c.join(",")));
    const touchesPrev = prev.size > 0 && p.world.some(([wx, wy, wz]) => D6.some(([dx, dy, dz]) => prev.has(`${wx + dx},${wy + dy},${wz + dz}`)));
    if (!onOrNextToTerritory && !touchesPrev) return { ok: false, reason: "not_connected" };
  }
  return { ok: true, placement: p };
}

/** Puts the block on the board and claims the tiles under it. Height tiles only change hands when the stack height matches their dots. */
export function applyBlock(board: Board, color: PlayerColor, p: Placement, rules: StrataRules = STRATA_RULES): Board {
  const next = commit(board, p);
  for (const f of p.cells) {
    const c = next.cells[f.y][f.x];
    if (c.type === "height" && c.height != null) {
      const ok = rules.heightMatch === "exact" ? c.stack === c.height : c.stack >= c.height;
      if (!ok) continue;
    }
    c.status = c.owner === color && c.status === "captured" ? "captured" : "claimed";
    c.owner = color;
  }
  return next;
}

/** A claimed tile completely surrounded by its owner's tiles, black tiles or the board edge becomes captured. */
export function captureAll(board: Board): { board: Board; captured: Array<{ x: number; y: number; owner: PlayerColor }> } {
  const cells = board.cells.map((r) => r.map((c) => ({ ...c })));
  const captured: Array<{ x: number; y: number; owner: PlayerColor }> = [];
  for (const row of board.cells) for (const c of row) {
    if (!c.owner || c.status !== "claimed") continue;
    const closed = D4.every(([dx, dy]) => { const n = cellOf(board, c.x + dx, c.y + dy); return !n || n.type === "black" || n.owner === c.owner; });
    if (closed) { cells[c.y][c.x].status = "captured"; captured.push({ x: c.x, y: c.y, owner: c.owner }); }
  }
  return { board: { ...board, cells }, captured };
}

export type Tally = { claimed: number; captured: number; score: number };
export function tallies(board: Board, rules: StrataRules = STRATA_RULES): Record<string, Tally> {
  const out: Record<string, Tally> = {};
  for (const row of board.cells) for (const c of row) {
    if (!c.owner || c.status === "unclaimed") continue;
    const t = (out[c.owner] ??= { claimed: 0, captured: 0, score: 0 });
    if (c.status === "captured") t.captured++; else t.claimed++;
  }
  for (const t of Object.values(out)) t.score = t.claimed * rules.claimedPoints + t.captured * rules.capturedPoints;
  return out;
}

/** Share of the open (non-black) tiles that someone holds. Drives the end-of-game tracker. */
export function territoryShare(board: Board): number {
  let open = 0, held = 0;
  for (const row of board.cells) for (const c of row) { if (c.type === "black") continue; open++; if (c.owner && c.status !== "unclaimed") held++; }
  return open ? held / open : 0;
}

export type Candidate = { pieceId: string; cubes: Cube[]; x: number; y: number };

/** Every legal way to place one block from the list. Used to find stuck hands and by the computer players. */
export function legalPlacements(board: Board, color: PlayerColor, earlier: ReadonlyArray<Cube>, pieceIds: readonly string[], rules: StrataRules = STRATA_RULES, limit = Infinity): Candidate[] {
  const out: Candidate[] = [];
  for (const id of new Set(pieceIds)) {
    for (const cubes of orientations(PIECES[id].cubes)) {
      const w = Math.max(...cubes.map((c) => c[0])) + 1, d = Math.max(...cubes.map((c) => c[1])) + 1;
      for (let y = 0; y <= board.height - d; y++) for (let x = 0; x <= board.width - w; x++) {
        if (checkBlock(board, color, earlier, cubes, x, y, rules).ok) { out.push({ pieceId: id, cubes, x, y }); if (out.length >= limit) return out; }
      }
    }
  }
  return out;
}
