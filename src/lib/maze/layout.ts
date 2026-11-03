import type { AreaSlug } from "../types";

/**
 * Each area of the Wall is a series of sections. A section is a seeded tile grid: a winding maze with
 * a few open plazas, loops, and a handful of dead ends kept on purpose. The database only stores which
 * post sits in which slot; this module turns a slot into a spot on a wall.
 *
 * Wall tiles are only ever a boundary: the renderer draws them as one connected mass, not as separate blocks.
 */
export const CELLS = 8;
export const SIZE = CELLS * 2 + 1; // tiles per side
export const TILE = 72; // px per tile at 1x
export const FACE = 14; // px of south-facing wall face drawn under each wall tile (2.5D depth)
export const SLOTS_PER_SECTION = 24;

export type Dir = "n" | "e" | "s" | "w";
export type Point = { x: number; y: number };
export type Face = Point & { dir: Dir };
export type Door = Face & { key: string; to: AreaSlug };
export type Room = { x: number; y: number; w: number; h: number };
export type MazeSection = {
  area: AreaSlug;
  section: number;
  /** true = wall, false = floor */
  walls: boolean[][];
  faces: Face[];
  doors: Door[];
  rooms: Room[];
  deadEnds: Point[];
  start: Point;
  seed: number;
};

export const DOORS: Record<AreaSlug, AreaSlug> = {
  main: "hidden", hidden: "picture", picture: "question", question: "community", community: "trending", trending: "main",
};

export const DIRS: Record<Dir, Point> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };
const ORDER: Dir[] = ["n", "e", "s", "w"];

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const cache = new Map<string, MazeSection>();

function floorNeighbours(walls: boolean[][], x: number, y: number): Dir[] {
  return ORDER.filter((d) => { const nx = x + DIRS[d].x, ny = y + DIRS[d].y; return inside(nx, ny) && !walls[ny][nx]; });
}
function findDeadEnds(walls: boolean[][], start: Point): Point[] {
  const out: Point[] = [];
  for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
    if (walls[y][x] || (x === start.x && y === start.y)) continue;
    if (floorNeighbours(walls, x, y).length === 1) out.push({ x, y });
  }
  return out;
}

export function buildSection(area: AreaSlug, section: number): MazeSection {
  const k = `${area}:${section}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const seed = hash(k);
  const rand = rng(seed);
  const walls: boolean[][] = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(true));
  const start: Point = { x: 1, y: 1 };

  // 1. Winding corridors: recursive backtracker over cells.
  const seen = new Set<string>(["0,0"]);
  const stack: Point[] = [{ x: 0, y: 0 }];
  walls[1][1] = false;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = shuffle(ORDER, rand)
      .map((d) => ({ d, x: cur.x + DIRS[d].x, y: cur.y + DIRS[d].y }))
      .filter((n) => n.x >= 0 && n.y >= 0 && n.x < CELLS && n.y < CELLS && !seen.has(`${n.x},${n.y}`));
    if (!options.length) { stack.pop(); continue; }
    const n = options[0];
    seen.add(`${n.x},${n.y}`);
    walls[cur.y * 2 + 1 + DIRS[n.d].y][cur.x * 2 + 1 + DIRS[n.d].x] = false;
    walls[n.y * 2 + 1][n.x * 2 + 1] = false;
    stack.push({ x: n.x, y: n.y });
  }

  // 2. Open plazas: 3x3 rooms where several corridors meet, away from the spawn point.
  const rooms: Room[] = [];
  for (let tries = 0; tries < 30 && rooms.length < 2; tries++) {
    const cx = 1 + Math.floor(rand() * (CELLS - 3)), cy = 1 + Math.floor(rand() * (CELLS - 3));
    if (cx < 2 && cy < 2) continue;
    if (rooms.some((r) => Math.abs(r.x - (cx * 2 + 1)) < 6 && Math.abs(r.y - (cy * 2 + 1)) < 6)) continue;
    const room = { x: cx * 2 + 1, y: cy * 2 + 1, w: 3, h: 3 };
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) walls[y][x] = false;
    rooms.push(room);
  }

  // 3. Loops and open pathways: knock through some dead ends, but keep several so there are still dead ends to find.
  let ends = shuffle(findDeadEnds(walls, start), rand);
  let knocked = 0;
  for (const e of ends) {
    if (knocked >= 3 || ends.length - knocked <= 6) break;
    for (const d of shuffle(ORDER, rand)) {
      const wx = e.x + DIRS[d].x, wy = e.y + DIRS[d].y, bx = wx + DIRS[d].x, by = wy + DIRS[d].y;
      if (wx < 1 || wy < 1 || wx > SIZE - 2 || wy > SIZE - 2 || !inside(bx, by)) continue;
      if (walls[wy][wx] && !walls[by][bx]) { walls[wy][wx] = false; knocked++; break; }
    }
  }
  // A few straight wall segments between two parallel corridors also open up.
  let opened = 0;
  for (let tries = 0; tries < 120 && opened < 3; tries++) {
    const x = 2 + Math.floor(rand() * (SIZE - 4)), y = 2 + Math.floor(rand() * (SIZE - 4));
    if (!walls[y][x]) continue;
    const horiz = !walls[y][x - 1] && !walls[y][x + 1] && walls[y - 1][x] && walls[y + 1][x];
    const vert = !walls[y - 1][x] && !walls[y + 1][x] && walls[y][x - 1] && walls[y][x + 1];
    if (horiz || vert) { walls[y][x] = false; opened++; }
  }

  // 4. Which wall tiles can hold something: those that touch a floor tile.
  ends = findDeadEnds(walls, start);
  const capKey = new Set<string>();
  const caps: Face[] = [];
  for (const e of ends) {
    const open = floorNeighbours(walls, e.x, e.y)[0];
    const back = ORDER.find((d) => DIRS[d].x === -DIRS[open].x && DIRS[d].y === -DIRS[open].y)!;
    const cx = e.x + DIRS[back].x, cy = e.y + DIRS[back].y;
    if (inside(cx, cy) && walls[cy][cx] && !capKey.has(`${cx},${cy}`)) { capKey.add(`${cx},${cy}`); caps.push({ x: cx, y: cy, dir: open }); }
  }
  const others: Face[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!walls[y][x] || capKey.has(`${x},${y}`)) continue;
    const d = ORDER.find((dd) => { const nx = x + DIRS[dd].x, ny = y + DIRS[dd].y; return inside(nx, ny) && !walls[ny][nx]; });
    if (d) others.push({ x, y, dir: d });
  }
  // Dead-end caps are the best hiding places: the hidden door takes one, the rest hold posts first.
  const shuffledCaps = shuffle(caps, rand);
  const door = section === 0 ? shuffledCaps.shift() ?? null : null;
  const ordered = [...shuffledCaps, ...shuffle(others, rand)];
  const faces = ordered.slice(0, SLOTS_PER_SECTION);
  const doors: Door[] = [];
  if (section === 0) {
    const d = door ?? ordered[SLOTS_PER_SECTION];
    if (d) doors.push({ ...d, key: `${area}>${DOORS[area]}`, to: DOORS[area] });
  }
  const built: MazeSection = { area, section, walls, faces, doors, rooms, deadEnds: ends, start, seed };
  cache.set(k, built);
  return built;
}

export function slotToPlace(slot: number): { section: number; index: number } {
  return { section: Math.floor(slot / SLOTS_PER_SECTION), index: slot % SLOTS_PER_SECTION };
}
export function sectionCount(maxSlot: number): number {
  return Math.max(1, Math.ceil((maxSlot + 1) / SLOTS_PER_SECTION));
}

/** The floor tile a person stands on to face a wall tile. */
export function standingTile(m: MazeSection, face: Face): Point {
  const s = { x: face.x + DIRS[face.dir].x, y: face.y + DIRS[face.dir].y };
  return m.walls[s.y]?.[s.x] === false ? s : { x: face.x + DIRS[face.dir].x, y: face.y + DIRS[face.dir].y };
}

/** Which quarter of the section a tile is in. Quarters get slightly different floors so sections feel distinct. */
export function zoneOf(x: number, y: number): number {
  return (x < SIZE / 2 ? 0 : 1) + (y < SIZE / 2 ? 0 : 2);
}

export function findPath(m: MazeSection, from: Point, to: Point): Point[] | null {
  if (m.walls[to.y]?.[to.x] !== false || m.walls[from.y]?.[from.x] !== false) return null;
  const key = (p: Point) => p.y * SIZE + p.x;
  const prev = new Map<number, Point | null>([[key(from), null]]);
  const q: Point[] = [from];
  while (q.length) {
    const c = q.shift()!;
    if (c.x === to.x && c.y === to.y) {
      const path: Point[] = [];
      let n: Point | null = c;
      while (n) { path.unshift(n); n = prev.get(key(n)) ?? null; }
      return path.slice(1);
    }
    for (const d of ORDER) {
      const n = { x: c.x + DIRS[d].x, y: c.y + DIRS[d].y };
      if (!inside(n.x, n.y) || m.walls[n.y][n.x] || prev.has(key(n))) continue;
      prev.set(key(n), c);
      q.push(n);
    }
  }
  return null;
}

export function step(m: MazeSection, from: Point, dir: Dir): Point | null {
  const n = { x: from.x + DIRS[dir].x, y: from.y + DIRS[dir].y };
  return inside(n.x, n.y) && m.walls[n.y][n.x] === false ? n : null;
}
