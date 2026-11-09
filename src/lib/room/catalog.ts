/**
 * Furniture catalogue. Every piece is built from a few cheap primitives (boxes, cylinders, spheres) so a whole room
 * stays light enough for a phone. Sizes are in metres: [width, height, depth]. Dimensions are data, not hardcoded in the scene.
 */
export type Part = { s: "box" | "cyl" | "sph"; p: [number, number, number]; d: number[]; c: string; glow?: boolean };
export type Cat = "bedroom" | "living" | "gaming" | "decoration";
export type CatalogItem = { kind: string; name: string; cat: Cat; size: [number, number, number]; parts: Part[]; flat?: boolean; emoji: string; hint?: string };

const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, glow = false): Part => ({ s: "box", p: [x, y, z], d: [w, h, d], c, glow });
const cyl = (x: number, y: number, z: number, r: number, h: number, c: string, glow = false): Part => ({ s: "cyl", p: [x, y, z], d: [r, h], c, glow });
const sph = (x: number, y: number, z: number, r: number, c: string): Part => ({ s: "sph", p: [x, y, z], d: [r], c });
const legs = (w: number, d: number, h: number, c: string, t = 0.05): Part[] =>
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => box(a * (w / 2 - t), h / 2, b * (d / 2 - t), t, h, t, c));

const bed = (w: number, fabric: string): Part[] => [
  box(0, 0.2, 0, w, 0.3, 2, "#6b4a35"), box(0, 0.42, 0.05, w - 0.1, 0.18, 1.85, fabric), box(0, 0.6, -0.9, w - 0.2, 0.12, 0.3, "#f3ece2"),
  box(0, 0.55, -1.02, w, 0.9, 0.08, "#5a3d2b"),
];
const sofa = (w: number, c: string): Part[] => [
  box(0, 0.22, 0, w, 0.3, 0.9, c), box(0, 0.6, -0.36, w, 0.55, 0.18, c), box(-w / 2 + 0.1, 0.45, 0.05, 0.2, 0.3, 0.8, c), box(w / 2 - 0.1, 0.45, 0.05, 0.2, 0.3, 0.8, c),
];

export const CATALOG: CatalogItem[] = [
  // BEDROOM
  { kind: "bed_single", name: "Single bed", cat: "bedroom", size: [1, 1, 2], emoji: "🛏️", parts: bed(1, "#7aa7ff") },
  { kind: "bed_double", name: "Double bed", cat: "bedroom", size: [1.6, 1, 2], emoji: "🛌", parts: bed(1.6, "#ff8fb1") },
  { kind: "bedside", name: "Bedside table", cat: "bedroom", size: [0.45, 0.5, 0.4], emoji: "🪵", parts: [box(0, 0.25, 0, 0.45, 0.5, 0.4, "#8a5a3c"), box(0, 0.34, 0.2, 0.36, 0.14, 0.01, "#6b4329"), sph(0.1, 0.6, 0, 0.06, "#ffd27a")] },
  { kind: "wardrobe", name: "Wardrobe", cat: "bedroom", size: [1.2, 2, 0.6], emoji: "🚪", parts: [box(0, 1, 0, 1.2, 2, 0.6, "#a6785a"), box(-0.3, 1, 0.31, 0.58, 1.9, 0.02, "#8d6247"), box(0.3, 1, 0.31, 0.58, 1.9, 0.02, "#8d6247"), box(-0.05, 1, 0.33, 0.03, 0.3, 0.03, "#e8d7a8"), box(0.05, 1, 0.33, 0.03, 0.3, 0.03, "#e8d7a8")] },
  { kind: "dresser", name: "Dressing table", cat: "bedroom", size: [1, 1.7, 0.5], emoji: "🪞", parts: [box(0, 0.38, 0, 1, 0.76, 0.5, "#e9dcc9"), box(0, 1.3, -0.22, 0.7, 0.8, 0.04, "#cfe9f1"), box(0, 1.3, -0.24, 0.78, 0.88, 0.02, "#d6b36a")] },
  // LIVING
  { kind: "sofa", name: "Sofa", cat: "living", size: [2, 0.9, 0.9], emoji: "🛋️", parts: sofa(2, "#6f5bd6") },
  { kind: "armchair", name: "Armchair", cat: "living", size: [0.9, 0.9, 0.9], emoji: "💺", parts: sofa(0.9, "#e0705a") },
  { kind: "coffee_table", name: "Coffee table", cat: "living", size: [1.1, 0.4, 0.6], emoji: "☕", parts: [box(0, 0.38, 0, 1.1, 0.05, 0.6, "#c8956a"), ...legs(1.1, 0.6, 0.38, "#7a5236")] },
  { kind: "tv_stand", name: "Television stand", cat: "living", size: [1.5, 1, 0.45], emoji: "📺", hint: "Add a video link", parts: [box(0, 0.2, 0, 1.5, 0.4, 0.45, "#5b4a40"), box(0, 0.75, 0, 1.2, 0.7, 0.05, "#111"), box(0, 0.75, 0.03, 1.12, 0.62, 0.01, "#2a5bd7", true), box(0, 0.45, 0, 0.1, 0.1, 0.1, "#222")] },
  { kind: "bookshelf", name: "Bookshelf", cat: "living", size: [1, 1.8, 0.35], emoji: "📚", hint: "Add a book link", parts: [box(0, 0.9, -0.15, 1, 1.8, 0.04, "#8a5a3c"), box(-0.48, 0.9, 0, 0.04, 1.8, 0.35, "#8a5a3c"), box(0.48, 0.9, 0, 0.04, 1.8, 0.35, "#8a5a3c"), ...[0.02, 0.45, 0.9, 1.35, 1.78].map((y) => box(0, y, 0, 1, 0.04, 0.35, "#8a5a3c")), ...[0.2, 0.65, 1.1, 1.55].flatMap((y, i) => [box(-0.3, y + 0.14, 0, 0.12, 0.28, 0.2, ["#d94b4b", "#3d7be0", "#e8b83a", "#4ca36b"][i]), box(-0.1, y + 0.12, 0, 0.1, 0.24, 0.2, ["#3d7be0", "#e8b83a", "#4ca36b", "#d94b4b"][i]), box(0.1, y + 0.14, 0, 0.12, 0.28, 0.2, ["#e8b83a", "#4ca36b", "#d94b4b", "#3d7be0"][i])])] },
  { kind: "record_player", name: "Record player", cat: "living", size: [0.5, 0.35, 0.4], emoji: "🎶", hint: "Add a music link", parts: [box(0, 0.08, 0, 0.5, 0.16, 0.4, "#6a4a32"), cyl(0, 0.17, 0, 0.17, 0.02, "#111"), cyl(0, 0.185, 0, 0.05, 0.01, "#e0705a"), box(0.17, 0.22, -0.1, 0.02, 0.02, 0.2, "#ccc")] },
  // GAMING
  { kind: "gaming_desk", name: "Gaming desk", cat: "gaming", size: [1.5, 0.76, 0.75], emoji: "🖥️", parts: [box(0, 0.74, 0, 1.5, 0.05, 0.75, "#1b1b2b"), ...legs(1.5, 0.75, 0.74, "#10101a"), box(0, 0.76, 0.36, 1.4, 0.01, 0.02, "#a64dff", true)] },
  { kind: "gaming_chair", name: "Gaming chair", cat: "gaming", size: [0.6, 1.2, 0.6], emoji: "🪑", parts: [cyl(0, 0.05, 0, 0.28, 0.05, "#222"), cyl(0, 0.25, 0, 0.04, 0.4, "#333"), box(0, 0.5, 0, 0.5, 0.1, 0.5, "#d92b3a"), box(0, 0.95, -0.24, 0.5, 0.8, 0.1, "#d92b3a"), box(0, 1.0, -0.2, 0.18, 0.7, 0.04, "#222")] },
  { kind: "monitor", name: "Computer monitor", cat: "gaming", size: [0.7, 0.5, 0.2], emoji: "💻", hint: "Link to a site or project", parts: [box(0, 0.3, 0, 0.7, 0.4, 0.04, "#101010"), box(0, 0.3, 0.025, 0.64, 0.34, 0.01, "#38e0c0", true), box(0, 0.05, 0, 0.06, 0.1, 0.06, "#222"), box(0, 0.01, 0, 0.25, 0.02, 0.16, "#222")] },
  { kind: "console", name: "Console", cat: "gaming", size: [0.4, 0.1, 0.3], emoji: "🎮", parts: [box(0, 0.05, 0, 0.4, 0.1, 0.3, "#f1f1f5"), box(0, 0.052, 0.151, 0.3, 0.01, 0.005, "#3a7bff", true)] },
  { kind: "gaming_kit", name: "Gaming accessories", cat: "gaming", size: [0.7, 0.1, 0.3], emoji: "🕹️", parts: [box(-0.2, 0.01, 0, 0.3, 0.02, 0.22, "#18182a"), box(0.2, 0.04, 0, 0.1, 0.06, 0.16, "#222"), box(0.2, 0.08, 0, 0.08, 0.02, 0.1, "#ff4d8d", true)] },
  // DECORATION
  { kind: "plant", name: "Indoor plant", cat: "decoration", size: [0.5, 1, 0.5], emoji: "🪴", parts: [cyl(0, 0.17, 0, 0.17, 0.34, "#c8643c"), sph(0, 0.6, 0, 0.3, "#3f9d4f"), sph(0.12, 0.85, 0.05, 0.2, "#56b563")] },
  { kind: "rug", name: "Rug", cat: "decoration", size: [2, 0.02, 1.4], flat: true, emoji: "🟪", parts: [box(0, 0.01, 0, 2, 0.02, 1.4, "#8c5cf0"), box(0, 0.02, 0, 1.7, 0.01, 1.1, "#ffb84d")] },
  { kind: "lamp", name: "Floor lamp", cat: "decoration", size: [0.4, 1.6, 0.4], emoji: "💡", parts: [cyl(0, 0.02, 0, 0.15, 0.04, "#222"), cyl(0, 0.8, 0, 0.02, 1.6, "#333"), cyl(0, 1.45, 0, 0.2, 0.3, "#ffe3a1", true)] },
  { kind: "mirror", name: "Standing mirror", cat: "decoration", size: [0.6, 1.6, 0.1], emoji: "🪞", parts: [box(0, 0.85, 0, 0.6, 1.5, 0.05, "#c9a24f"), box(0, 0.85, 0.03, 0.52, 1.42, 0.01, "#bfe6f4"), box(0, 0.05, 0.1, 0.5, 0.05, 0.25, "#8d6a2f")] },
  { kind: "curtains", name: "Curtains", cat: "decoration", size: [1.6, 2, 0.15], emoji: "🎀", parts: [box(-0.65, 1, 0, 0.3, 2, 0.12, "#e98ab8"), box(0.65, 1, 0, 0.3, 2, 0.12, "#e98ab8"), box(0, 2.0, 0, 1.6, 0.04, 0.04, "#444")] },
  { kind: "wall_clock", name: "Wall clock", cat: "decoration", size: [0.45, 0.45, 0.06], emoji: "🕰️", parts: [cyl(0, 1.7, 0, 0.22, 0.05, "#f5efe4"), box(0, 1.76, 0.03, 0.02, 0.14, 0.01, "#222"), box(0.04, 1.7, 0.03, 0.1, 0.02, 0.01, "#222")] },
  { kind: "neon", name: "Neon sign", cat: "decoration", size: [0.9, 0.5, 0.05], emoji: "✨", parts: [box(0, 1.7, 0, 0.9, 0.5, 0.02, "#1a1020"), box(0, 1.7, 0.02, 0.7, 0.05, 0.02, "#ff3df0", true), box(0, 1.8, 0.02, 0.5, 0.05, 0.02, "#3dd8ff", true), box(0, 1.6, 0.02, 0.5, 0.05, 0.02, "#ff3df0", true)] },
  { kind: "floor_decor", name: "Floor decoration", cat: "decoration", size: [0.5, 0.5, 0.5], emoji: "🎈", parts: [sph(0, 0.25, 0, 0.25, "#ff6b6b"), sph(0.2, 0.2, 0.1, 0.18, "#ffd93d"), sph(-0.2, 0.18, 0.1, 0.16, "#4dabf7")] },
];
export const CATS: { id: Cat; label: string }[] = [
  { id: "bedroom", label: "Bedroom" }, { id: "living", label: "Living" }, { id: "gaming", label: "Gaming" }, { id: "decoration", label: "Decoration" },
];
export const byKind = (k: string) => CATALOG.find((i) => i.kind === k);

/** Room dimensions in metres. Change them here and every part of the app follows. */
export const ROOM_SIZES = {
  small: { label: "Small", w: 3.6, d: 3.6, h: 2.6 },
  medium: { label: "Medium", w: 5, d: 4.4, h: 2.8 },
  large: { label: "Large", w: 6.8, d: 5.6, h: 3 },
} as const;
export type RoomSize = keyof typeof ROOM_SIZES;
export const THEMES = {
  sunset: { label: "Sunset", wall: "#f2b8a2", floor: "#b98a63", accent: "#e85d4a" },
  midnight: { label: "Midnight", wall: "#3b3f7a", floor: "#2c2a40", accent: "#7c6cff" },
  mint: { label: "Mint", wall: "#a8e0c9", floor: "#d9c9a8", accent: "#2fb38a" },
  sand: { label: "Sand", wall: "#eadcc0", floor: "#a07b55", accent: "#c8853a" },
  lilac: { label: "Lilac", wall: "#cbb5f0", floor: "#e6dccf", accent: "#8a5cf0" },
} as const;
export type Theme = keyof typeof THEMES;
export const FRAMES = ["wood", "black", "white", "gold", "none"] as const;
export const FRAME_COLOUR: Record<string, string> = { wood: "#8a5a3c", black: "#15151a", white: "#f4f1ea", gold: "#d6b04f", none: "#000" };
export const DECOR_KINDS = [["picture", "Photo"], ["poster", "Poster"], ["album", "Album cover"], ["movie", "Movie poster"], ["sport", "Sports"], ["travel", "Travel"], ["artwork", "Artwork"], ["noticeboard", "Noticeboard"]] as const;
export const CATEGORIES = ["music", "football", "basketball", "movies", "gaming", "fashion", "travel", "photography", "books", "technology", "lifestyle", "art", "food"] as const;

export type RoomItem = { id: string; kind: string; x: number; z: number; rot: number; scale: number; link_url: string | null; note: string | null };
export type RoomDecor = { id: string; wall: number; u: number; v: number; w: number; h: number; rot: number; frame: string; z_index: number; image_path: string | null; kind: string; title: string | null; link_url: string | null; note: string | null };
export type RoomData = { name: string; size: RoomSize; theme: Theme; category: string | null; visibility: "public" | "followers" | "private"; items: RoomItem[]; decor: RoomDecor[] };

export const roomImageUrl = (path: string | null) => (path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/room-images/${path}` : null);
/** Half-extents of an item's footprint after rotation and scale, used to keep it inside the room and off other furniture. */
export function footprint(it: RoomItem) {
  const c = byKind(it.kind); if (!c) return { hx: 0.3, hz: 0.3 };
  const [w, , d] = c.size; const cs = Math.abs(Math.cos(it.rot)), sn = Math.abs(Math.sin(it.rot));
  return { hx: ((w * cs + d * sn) / 2) * it.scale, hz: ((w * sn + d * cs) / 2) * it.scale };
}
