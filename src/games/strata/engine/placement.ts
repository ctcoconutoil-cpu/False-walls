import type { Board } from "./types";
import { normalize, type Cube, type Cubes } from "./pieces.ts";

export type Placement = {
  valid: boolean;
  /** Why a placement is invalid, in plain words. */
  reason: "off_board" | "black_tile" | "too_tall" | null;
  /** Height the block rests at: 0 on the board, more when it sits on other blocks. */
  base: number;
  /** Board cells under the block. */
  cells: Array<{ x: number; y: number }>;
  /** Cubes in board coordinates, resting. */
  world: Cube[];
};

export const MAX_STACK = 8;
export const REASON_TEXT: Record<NonNullable<Placement["reason"]>, string> = {
  off_board: "Part of the block is off the board.",
  black_tile: "A block can't stand on a black tile.",
  too_tall: "That stack would be too tall.",
};

/**
 * Where a block comes to rest when dropped with its lowest-left corner over cell (x, y): straight down until it
 * sits on the board or on other blocks. Geometry only: the full STRATA rules (touching, claiming, heights) come later.
 */
export function place(board: Board, cubes: Cubes, x: number, y: number): Placement {
  const n = normalize(cubes);
  const cells = [...new Map(n.map(([cx, cy]) => [`${cx + x},${cy + y}`, { x: cx + x, y: cy + y }])).values()];
  const bad = (reason: Placement["reason"]): Placement => ({ valid: false, reason, base: 0, cells, world: n.map(([cx, cy, cz]): Cube => [cx + x, cy + y, cz]) });
  if (cells.some((c) => !board.cells[c.y]?.[c.x])) return bad("off_board");
  if (cells.some((c) => board.cells[c.y][c.x].type === "black")) return bad("black_tile");
  let base = 0;
  for (const [cx, cy, cz] of n) base = Math.max(base, board.cells[cy + y][cx + x].stack - cz);
  const world = n.map(([cx, cy, cz]): Cube => [cx + x, cy + y, cz + base]);
  if (Math.max(...world.map((c) => c[2])) + 1 > MAX_STACK) return { valid: false, reason: "too_tall", base, cells, world };
  return { valid: true, reason: null, base, cells, world };
}

/** Returns a new board with the block standing on it. Throws on an invalid placement, so callers can't skip validation. */
export function commit(board: Board, p: Placement): Board {
  if (!p.valid) throw new Error(`Cannot commit an invalid placement (${p.reason})`);
  const cells = board.cells.map((row) => row.map((c) => ({ ...c })));
  for (const [x, y, z] of p.world) cells[y][x].stack = Math.max(cells[y][x].stack, z + 1);
  return { ...board, cells };
}
