import { DIRS, SIZE, hash, type MazeSection, type Point } from "@/lib/maze/layout";
import type { MazeObject } from "@/lib/adventure/types";

export type Placed = MazeObject & { tile: Point; inWall: boolean };

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

/** The floor tile an object is reachable from (first open orthogonal neighbour of its wall tile). */
const openSide = (m: MazeSection, p: Point): Point | null => {
  for (const d of Object.values(DIRS) as Point[]) {
    const x = p.x + d.x, y = p.y + d.y;
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE && !m.walls[y][x]) return { x, y };
  }
  return null;
};

/**
 * Easy objects ("clear") stand on the floor in the open. Hard objects ("hidden") are hidden INSIDE a wall: they take a wall tile with at least one
 * open side, so a player can walk up to it. Placement is deterministic, so the same object is always in the same place for the same player;
 * per_player objects move between players. Floor objects avoid the start, post standing tiles and the door; wall objects avoid the outer border
 * and wall tiles carrying a post or the hidden door. The "kind of spot" is judged by the floor beside the object.
 */
export function placeObjects(m: MazeSection, objects: MazeObject[], userId: string): Placed[] {
  const reservedFloor = new Set<string>([key(m.start)]);
  const reservedWall = new Set<string>();
  for (const f of [...m.faces, ...m.doors]) {
    const d = DIRS[f.dir];
    reservedFloor.add(`${f.x + d.x},${f.y + d.y}`);
    reservedWall.add(key(f));
  }
  const floors: Point[] = [];
  const wallSpots: Point[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!m.walls[y][x]) { if (!reservedFloor.has(`${x},${y}`)) floors.push({ x, y }); }
    else if (x > 0 && y > 0 && x < SIZE - 1 && y < SIZE - 1 && !reservedWall.has(`${x},${y}`) && openSide(m, { x, y })) wallSpots.push({ x, y });
  }
  const kindOf = (p: Point, inWall: boolean) => { if (!inWall) return tileKind(m, p); const f = openSide(m, p); return f ? tileKind(m, f) : "corridor"; };
  const taken = new Set<string>();
  const out: Placed[] = [];
  for (const o of objects) {
    const inWall = o.visibility === "hidden";
    const spots = inWall ? wallSpots : floors;
    let tile: Point | null = null;
    if (o.tile_x != null && o.tile_y != null && spots.some((p) => p.x === o.tile_x && p.y === o.tile_y) && !taken.has(`${o.tile_x},${o.tile_y}`)) tile = { x: o.tile_x, y: o.tile_y };
    if (!tile) {
      const seed = `${o.id}:${o.per_player ? userId : ""}:${m.seed}`;
      const rank = (p: Point) => hash(`${seed}:${p.x},${p.y}`);
      const pool = (kind: MazeObject["placement"] | null) => spots.filter((p) => !taken.has(key(p)) && (!kind || kindOf(p, inWall) === kind));
      const options = pool(o.placement).length ? pool(o.placement) : pool(null);
      tile = options.sort((a, b) => rank(a) - rank(b))[0] ?? null;
    }
    if (tile) { taken.add(key(tile)); out.push({ ...o, tile, inWall }); }
  }
  return out;
}
