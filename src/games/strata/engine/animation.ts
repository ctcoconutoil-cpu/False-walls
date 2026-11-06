import type { PlayerColor } from "./types.ts";
import type { Resolution } from "./play.ts";
import type { Cube } from "./pieces.ts";

export type FillStep = { x: number; y: number; owner: PlayerColor; status: "claimed" | "captured"; delay: number };

/**
 * When each changed tile fills with colour after a turn is confirmed. The colour spreads outwards from the blocks:
 * tiles under a block fill first, tiles that become captured by being enclosed fill a little after their neighbours.
 * Pure data, so the same plan drives the renderer and the tests.
 */
export function fillPlan(res: Resolution, blocks: ReadonlyArray<{ world: Cube[] }>, stepMs = 80): FillStep[] {
  const under = [...new Set(blocks.flatMap((b) => b.world.map((c) => `${c[0]},${c[1]}`)))].map((k) => k.split(",").map(Number) as [number, number]);
  const dist = (x: number, y: number) => (under.length ? Math.min(...under.map(([bx, by]) => Math.abs(bx - x) + Math.abs(by - y))) : 0);
  const out = new Map<string, FillStep>();
  const cellAt = (x: number, y: number) => res.board.cells[y][x];
  for (const c of res.claimed) { const cell = cellAt(c.x, c.y); out.set(`${c.x},${c.y}`, { x: c.x, y: c.y, owner: cell.owner as PlayerColor, status: cell.status === "captured" ? "captured" : "claimed", delay: dist(c.x, c.y) * stepMs }); }
  for (const c of res.captured) if (!out.has(`${c.x},${c.y}`)) out.set(`${c.x},${c.y}`, { x: c.x, y: c.y, owner: c.owner, status: "captured", delay: dist(c.x, c.y) * stepMs + 2 * stepMs });
  return [...out.values()].sort((a, b) => a.delay - b.delay);
}

/** How long the whole fill takes, so the renderer knows when to remove the temporary blocks and hand over. */
export const fillDuration = (plan: ReadonlyArray<FillStep>, tileMs = 420) => (plan.length ? Math.max(...plan.map((p) => p.delay)) + tileMs : 0);
