/**
 * The Wall keeps one look per day. Five brick-wall designs take turns, each with its own brick colour, lamp glow,
 * plants and painted marks, so the wall feels new every 24 hours while the posts on it stay the same.
 */
export type WallTheme = {
  name: string;
  brick: string | null;      // /wall/bricks/<brick>.webp; null keeps the original red brick
  greens: [string, string, string, string, string];
  vine: string;
  glow: [string, string, string];
  bulb: string;
  crown: string;
  eye: [string, string, string]; // outline, iris, pupil
  scribble: string;
  blossoms?: string[];       // flowers among the leaves
  stars?: boolean;
};

export const WALL_THEMES: WallTheme[] = [
  { name: "Red Brick", brick: null, greens: ["#1f5a24", "#2d7a2f", "#3f9a3a", "#58b34a", "#7cc65a"], vine: "#17481c", glow: ["#ffb85a", "#ff8a2a", "#ff6a1a"], bulb: "#ffe3a0", crown: "#f6bd3a", eye: ["#8d3bd6", "#a24cf0", "#2a0a45"], scribble: "#ff7a2e" },
  { name: "Midnight Blue", brick: "navy", greens: ["#1b4f5a", "#25707a", "#2f8f93", "#4fb3ad", "#7dd3c4"], vine: "#123a44", glow: ["#cfe9ff", "#6fb4ff", "#3a7cff"], bulb: "#e2f3ff", crown: "#9fd6ff", eye: ["#4a8bff", "#5aa0ff", "#0b1d4a"], scribble: "#7ee8ff", stars: true },
  { name: "Plum Bloom", brick: "plum", greens: ["#2f4a2a", "#3f6a3a", "#5a8a4a", "#7aa85a", "#9bc46a"], vine: "#243c20", glow: ["#ffc2e6", "#ff7cc4", "#e0409a"], bulb: "#ffd6f0", crown: "#ff8fd0", eye: ["#ff5cb8", "#ff7ccc", "#3a0a2a"], scribble: "#ffd36a", blossoms: ["#ff8fd0", "#ffd1ec", "#ffffff", "#ff5cb8"] },
  { name: "Forest Gold", brick: "forest", greens: ["#2a6a20", "#3f8a2a", "#5aa83a", "#86c84a", "#b4e060"], vine: "#1d4a18", glow: ["#fff0a0", "#ffd24a", "#e6a000"], bulb: "#fff4b8", crown: "#ffe27a", eye: ["#7fd46a", "#9be67a", "#0e3a16"], scribble: "#ffd24a", blossoms: ["#ffe27a", "#fff6c8", "#ffffff"] },
  { name: "Sandstone Sunset", brick: "sand", greens: ["#4a5a22", "#66782c", "#86973a", "#a6b64e", "#c4d36a"], vine: "#38441a", glow: ["#ffc08a", "#ff8a5a", "#e0502a"], bulb: "#ffdcb4", crown: "#e0502a", eye: ["#d8503a", "#f07a4a", "#4a1408"], scribble: "#1879D2", blossoms: ["#ff6a3a", "#ffb04a", "#fff0d0"] },
];

/** Which design the Wall wears right now. It turns over at midnight UTC. `?theme=0..4` previews one. */
export function themeIndexFor(date = new Date(), override?: string | null): number {
  const n = override != null && /^[0-4]$/.test(override) ? Number(override) : Math.floor(date.getTime() / 86_400_000) % WALL_THEMES.length;
  return n;
}
