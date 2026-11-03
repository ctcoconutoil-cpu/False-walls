import type { AreaSlug } from "../types";

/**
 * The maze is generated, not drawn: each area is a series of sections, and each section is a small
 * grid of wall and floor tiles built from a seed. The database only stores which post sits in which
 * slot; this module turns a slot into a spot on a wall.
 */
export const CELLS = 5;
export const SIZE = CELLS * 2 + 1; // tiles per side
export const TILE = 128; // px per tile at 1x
export const SLOTS_PER_SECTION = 24;

export type Dir = "n" | "e" | "s" | "w";
export type Point = { x: number; y: number };
export type Face = Point & { dir: Dir };
export type Door = Face & { key: string; to: AreaSlug };
export type MazeSection = {
  area: AreaSlug;
  section: number;
  /** true = wall, false = floor */
  walls: boolean[][];
  faces: Face[];
  doors: Door[];
  start: Point;
};

export const DOORS: Record<AreaSlug, AreaSlug> = {
  main: "hidden", hidden: "picture", picture: "question", question: "community", community: "trending", trending: "main",
};

const DIRS: Record<Dir, Point> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };
const ORDER: Dir[] = ["n", "e", "s", "w"];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
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

const cache = new Map<string, MazeSection>();

export function buildSection(area: AreaSlug, section: number): MazeSection {
  const k = `${area}:${section}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const rand = rng(hash(k));
  const walls: boolean[][] = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(true));

  // Recursive backtracker over cells.
  const seen = new Set<string>();
  const stack: Point[] = [{ x: 0, y: 0 }];
  seen.add("0,0");
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
  // Open a few extra gaps so the maze has loops and is quicker to get around.
  let opened = 0;
  for (let tries = 0; tries < 80 && opened < 5; tries++) {
    const x = 1 + Math.floor(rand() * (SIZE - 2));
    const y = 1 + Math.floor(rand() * (SIZE - 2));
    if (!walls[y][x]) continue;
    const horiz = !walls[y][x - 1] && !walls[y][x + 1] && walls[y - 1][x] && walls[y + 1][x];
    const vert = !walls[y - 1][x] && !walls[y + 1][x] && walls[y][x - 1] && walls[y][x + 1];
    if (horiz || vert) { walls[y][x] = false; opened++; }
  }

  // Wall tiles that touch a floor tile can hold something. Order is a seeded shuffle.
  const all: Face[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!walls[y][x]) continue;
    for (const d of ORDER) {
      const nx = x + DIRS[d].x, ny = y + DIRS[d].y;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && !walls[ny][nx]) { all.push({ x, y, dir: d }); break; }
    }
  }
  const shuffled = shuffle(all, rand);
  const faces = shuffled.slice(0, SLOTS_PER_SECTION);
  const doors: Door[] = [];
  if (section === 0) {
    const spare = shuffled.slice(SLOTS_PER_SECTION);
    if (spare[0]) doors.push({ ...spare[0], key: `${area}>${DOORS[area]}`, to: DOORS[area] });
  }
  const built: MazeSection = { area, section, walls, faces, doors, start: { x: 1, y: 1 } };
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
  return { x: face.x + DIRS[face.dir].x, y: face.y + DIRS[face.dir].y };
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
      if (n.x < 0 || n.y < 0 || n.x >= SIZE || n.y >= SIZE || m.walls[n.y][n.x] || prev.has(key(n))) continue;
      prev.set(key(n), c);
      q.push(n);
    }
  }
  return null;
}

export function step(m: MazeSection, from: Point, dir: Dir): Point | null {
  const n = { x: from.x + DIRS[dir].x, y: from.y + DIRS[dir].y };
  return m.walls[n.y]?.[n.x] === false ? n : null;
}
