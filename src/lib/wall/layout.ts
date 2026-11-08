import type { PostType } from "@/lib/types";

/**
 * The Wall is read top to bottom. Every "bay" is one screenful: nine posts in three columns of three (left, middle,
 * right), each column starting at a different height so nothing lines up like a grid. Every number is in design units:
 * the wall is DW units wide and the screen scales it to fit, so the arrangement looks the same on every phone.
 * The layout is a pure function of the post list, so a post lands in the same place, at the same angle, every time.
 */
export const DW = 390;
export const BAYH = 770;
export const PER_BAY = 9;
const COL_X = [20, 148, 272]; // left edges of the three columns
const COL_W = [96, 100, 100];
const COL_Y = [92, 22, 128]; // where each column starts inside its bay
const COL_ROT = [-3.4, 0.4, 3.2]; // left leans left, middle stands straight, right leans right
const ROW_PITCH = 208;

export type WallStyle = "frame" | "board" | "special";
export type Slot = {
  key: string; bay: number; pos: number; col: 0 | 1 | 2;
  x: number; y: number; w: number; h: number; rot: number; ry: number; depth: 0 | 1 | 2; variant: number; seed: number;
  postIndex: number; // -1 for a decorative sign
  special: boolean;
};
export type LayoutPost = { id: string; type: PostType; hasImage: boolean };

export function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

const COL_OF = [1, 0, 2, 1, 0, 2, 1, 0, 2]; // the order a bay fills: middle first, then left, then right, a row at a time
/** Every third bay carries a "Trending right now" sign in its last slot instead of a post. */
export const bayHasSign = (bay: number) => bay % 3 === 2;
/** Index of the first post that appears in a bay. */
export const firstPostOfBay = (bay: number) => bay * PER_BAY - Math.floor(bay / 3);

/** The nine slots of one bay. `n` is how many posts exist; with `loop` they repeat so the wall never ends. */
export function layoutBay(bay: number, posts: LayoutPost[], loop: boolean): Slot[] {
  const n = posts.length;
  const out: Slot[] = [];
  let k = firstPostOfBay(bay);
  for (let pos = 0; pos < PER_BAY; pos++) {
    const special = bayHasSign(bay) && pos === PER_BAY - 1;
    if (!special && !loop && k >= n) break;
    const col = COL_OF[pos] as 0 | 1 | 2, row = Math.floor(pos / 3);
    const post = special || !n ? null : posts[k % n];
    const key = special ? `sign~${bay}` : `${post!.id}~${Math.floor(k / Math.max(1, n))}`;
    const s1 = hash01(key, 1), s2 = hash01(key, 2), s3 = hash01(key, 3), s4 = hash01(key, 4);
    const w = Math.round(COL_W[col] + (s1 - 0.5) * 8);
    const h = Math.round(w * (1.5 + s2 * 0.14));
    const x = COL_X[col] + Math.round((s3 - 0.5) * 8);
    const y = bay * BAYH + COL_Y[col] + row * ROW_PITCH + Math.round((s4 - 0.5) * 14);
    const rot = COL_ROT[col] + (s2 - 0.5) * 1.6;
    out.push({
      key, bay, pos, col, x, y, w, h, rot, ry: rot * 1.4 + (s3 - 0.5) * 1.5, depth: (Math.floor(s4 * 3) % 3) as 0 | 1 | 2,
      variant: Math.floor(s1 * 997) % 3, seed: s2, postIndex: special ? -1 : k % Math.max(1, n), special,
    });
    if (!special) k++;
  }
  return out;
}

/** How many bays the loaded posts fill (without looping). */
export function baysFor(n: number): number {
  let b = 0;
  while (firstPostOfBay(b) < n) b++;
  return b;
}
