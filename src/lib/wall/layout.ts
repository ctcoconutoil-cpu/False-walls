import type { PostType } from "@/lib/types";

/**
 * Where every post hangs on the Wall. All numbers are in "design units": the Wall is DH units tall and the screen scales
 * it to fit, so the arrangement looks the same on a small phone and a large one. The layout is a pure function of the
 * posts, so a post lands in the same place, at the same angle, every time, and never moves while you scroll.
 */
export const DH = 660; // height of the wall in design units
export const LANES = 3;
const TOP = 56, LANE_H = 192; // posts hang in three bands; the header sits above them
export const BAY = 330; // the wall repeats its rhythm of lean every bay: left leans left, middle stands straight, right leans right

export type WallStyle = "frame" | "poster" | "board" | "notice" | "panel" | "question" | "hidden" | "plaque";
export type Placed = {
  key: string; index: number; postIndex: number;
  x: number; y: number; w: number; h: number;
  rot: number; ry: number; depth: 0 | 1 | 2; variant: number; style: WallStyle; seed: number;
};
export type LayoutPost = { id: string; type: PostType; kind: string | null; hasImage: boolean; ratio: number | null };

/** A small stable hash to a number in [0, 1). */
export function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

export function styleFor(p: LayoutPost, seed: number): WallStyle {
  switch (p.type) {
    case "picture": return p.hasImage ? (seed < 0.62 ? "frame" : "poster") : "board";
    case "ask_me": return "notice";
    case "prompt_response": return "panel";
    case "hidden_thought": return "hidden";
    case "false_wall": return p.kind === "question" ? "question" : "plaque";
  }
}

function size(style: WallStyle, p: LayoutPost, seed: number, seed2: number): { w: number; h: number } {
  const k = 0.92 + seed2 * 0.26; // some posts are a little bigger, some a little smaller
  if ((style === "frame" || style === "poster") && p.ratio) {
    const landscape = p.ratio > 1.15;
    return landscape ? { w: Math.round(138 * k), h: Math.round(108 * k) } : { w: Math.round(104 * k), h: Math.round(136 * k) };
  }
  const base = { frame: [106, 132], poster: [102, 130], board: [102, 124], notice: [108, 128], panel: [104, 138], question: [104, 124], hidden: [102, 126], plaque: [100, 122] }[style];
  return { w: Math.round(base[0] * k), h: Math.round(base[1] * k * (0.96 + seed * 0.1)) };
}

/**
 * Lays posts out in three staggered bands, always dropping the next post into the band that is least filled so nothing
 * overlaps and the gaps stay uneven. Stops when it has covered `untilX`. With `loop` the posts repeat so the wall never ends.
 */
export function layoutWall(posts: LayoutPost[], untilX: number, loop: boolean): { placed: Placed[]; end: number } {
  const n = posts.length;
  const placed: Placed[] = [];
  if (!n) return { placed, end: 0 };
  const cursor = [26, 86, 52];
  let end = 0;
  for (let k = 0; loop || k < n; k++) {
    const lane = cursor.indexOf(Math.min(...cursor));
    if (cursor[lane] > untilX) break;
    const post = posts[k % n];
    const round = Math.floor(k / n);
    const key = `${post.id}~${round}`;
    const s1 = hash01(key, 1), s2 = hash01(key, 2), s3 = hash01(key, 3), s4 = hash01(key, 4);
    const style = styleFor(post, s1);
    const { w, h } = size(style, post, s2, s3);
    const x = cursor[lane];
    const slack = LANE_H - h - 6;
    const y = TOP + lane * LANE_H + 4 + Math.max(0, slack) * (0.15 + s4 * 0.7); // up and down a little inside the band
    // lean by where it hangs in the bay, not at random: left leans left, middle stays straight, right leans right
    const t = ((x + w / 2) % BAY) / BAY;
    const side = (t - 0.5) * 2; // -1 left … 1 right
    const lean = Math.sign(side) * Math.pow(Math.abs(side), 1.15) * 4.3;
    const rot = Math.max(-5, Math.min(5, lean + (s3 - 0.5) * 1.7));
    const ry = rot * 1.5 + (s2 - 0.5) * 2; // a little perspective in the same direction as the lean
    placed.push({ key, index: k, postIndex: k % n, x, y, w, h, rot, ry, depth: (Math.floor(s4 * 3) % 3) as 0 | 1 | 2, variant: Math.floor(s1 * 997) % 3, style, seed: s2 });
    cursor[lane] = x + w + 24 + s3 * 40 + (post.type === "picture" ? 8 : 0);
    end = Math.max(end, x + w);
  }
  return { placed, end };
}
