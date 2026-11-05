import { DIRS, SIZE, hash, type MazeSection, type Point } from "@/lib/maze/layout";
import type { MazeObject } from "@/lib/adventure/types";

export type Placed = MazeObject & { tile: Point };

const key = (p: Point) => `${p.x},${p.y}`;
const floorNeighbours = (m: MazeSection, p: Point) =>
  (Object.values(DIRS) as Point[]).filter((d) => {
    const x = p.x + d.x, y = p.y + d.y;
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE && !m.walls[y][x];
  });

/** Which kind of spot a floor tile is: a dead end, a corner, a junction, a plain corridor, or inside a plaza. */
export function tileKind(m: MazeSection, p: Point): MazeObject["placement"] {
  if (m.rooms.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h)) return "room";
  const n = floorNeighbours(m, p);
  if (n.length <= 1) return "dead_end";
  if (n.length >= 3) return "junction";
  return n[0].x + n[1].x === 0 && n[0].y + n[1].y === 0 ? "corridor" : "corner";
}

/**
 * Chooses a floor tile for every collectible in this section. Deterministic, so the same object is always in the same place for the
 * same player. Objects flagged per_player move around between players. Tiles in front of posts, the start and the hidden door are left clear.
 */
export function placeObjects(m: MazeSection, objects: MazeObject[], userId: string): Placed[] {
  const reserved = new Set<string>([key(m.start)]);
  for (const f of [...m.faces, ...m.doors]) {
    const d = DIRS[f.dir];
    reserved.add(`${f.x + d.x},${f.y + d.y}`);
  }
  const floors: Point[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!m.walls[y][x] && !reserved.has(`${x},${y}`)) floors.push({ x, y });
  const taken = new Set<string>();
  const out: Placed[] = [];
  for (const o of objects) {
    let tile: Point | null = null;
    if (o.tile_x != null && o.tile_y != null && !m.walls[o.tile_y]?.[o.tile_x] && !taken.has(`${o.tile_x},${o.tile_y}`)) tile = { x: o.tile_x, y: o.tile_y };
    if (!tile) {
      const seed = `${o.id}:${o.per_player ? userId : ""}:${m.seed}`;
      const rank = (p: Point) => hash(`${seed}:${p.x},${p.y}`);
      const pool = (kind: MazeObject["placement"] | null) => floors.filter((p) => !taken.has(key(p)) && (!kind || tileKind(m, p) === kind));
      const options = pool(o.placement).length ? pool(o.placement) : pool(null);
      tile = options.sort((a, b) => rank(a) - rank(b))[0] ?? null;
    }
    if (tile) { taken.add(key(tile)); out.push({ ...o, tile }); }
  }
  return out;
}
