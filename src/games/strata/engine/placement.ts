import type { Board } from "./types";
import { hangingCubes, isBridge, normalize, spanColumns, stands, type Cube, type Cubes } from "./pieces.ts";

export type PlaceReason = "off_board" | "overlap" | "black_tile" | "unstable";

export type Placement = {
  valid: boolean;
  /** Why a placement is invalid, in plain words. */
  reason: PlaceReason | null;
  /** Always 0: every block stands on the board by itself. Kept so the renderer can treat held and placed blocks alike. */
  base: number;
  /** Every board tile the block is over, including tiles a bridge spans. */
  cells: Array<{ x: number; y: number }>;
  /** Tiles the block stands on (a cube touches the board). */
  ground: Array<{ x: number; y: number }>;
  /** Tiles the block hangs over without touching them. */
  span: Array<{ x: number; y: number }>;
  /** True when the block is a bridge shape in this orientation. */
  bridge: boolean;
  /** Cubes in board coordinates. */
  world: Cube[];
};

export const REASON_TEXT: Record<PlaceReason, string> = {
  off_board: "Part of the block is off the board.",
  overlap: "That spot is already taken by another block.",
  black_tile: "A block can't stand on a black tile. Only a bridge can cross one.",
  unstable: "That block would tip over. It has to stand on its own.",
};

const xy = (c: { x: number; y: number }) => `${c.x},${c.y}`;

/**
 * Where a block goes when its lowest-left corner is over tile (x, y). Blocks never rest on other blocks: each one stands on the board.
 * `occupied` holds the cubes of blocks already placed this turn (as "x,y,z" keys). Geometry only: territory rules are in play.ts.
 */
export function place(board: Board, cubes: Cubes, x: number, y: number, occupied: ReadonlySet<string> = new Set()): Placement {
  const n = normalize(cubes);
  const world = n.map(([cx, cy, cz]): Cube => [cx + x, cy + y, cz]);
  const cells = [...new Map(n.map(([cx, cy]) => [`${cx + x},${cy + y}`, { x: cx + x, y: cy + y }])).values()];
  const span = spanColumns(n).map(([cx, cy]) => ({ x: cx + x, y: cy + y }));
  const spanKeys = new Set(span.map(xy));
  const ground = cells.filter((c) => !spanKeys.has(xy(c)));
  const base = { base: 0, cells, ground, span, world, bridge: isBridge(n) };
  const bad = (reason: PlaceReason): Placement => ({ valid: false, reason, ...base });
  if (cells.some((c) => !board.cells[c.y]?.[c.x])) return bad("off_board");
  if (world.some((c) => occupied.has(c.join(",")))) return bad("overlap");
  // a cube that touches the board can't be on a black tile; hanging cubes may pass over it only as a bridge (checked in play.ts)
  if (ground.some((c) => board.cells[c.y][c.x].type === "black")) return bad("black_tile");
  if (!stands(n)) return bad("unstable");
  return { valid: true, reason: null, ...base };
}

export { hangingCubes };
