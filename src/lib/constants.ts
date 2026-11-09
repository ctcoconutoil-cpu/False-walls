import type { ClueStyle, FalseWallKind, PostType, ReactionKind, WallColor } from "./types";

export const TAGLINE = "Look closer. There's more behind the wall.";

export const WALL_COLORS: Record<WallColor, { name: string; base: string; dark: string; ink: string }> = {
  coral: { name: "Bright red", base: "#E51F2B", dark: "#A8121C", ink: "#FFFFFF" },
  mustard: { name: "Golden yellow", base: "#F9A719", dark: "#C77F08", ink: "#2A1A05" },
  teal: { name: "Electric blue", base: "#1879D2", dark: "#0F5599", ink: "#FFFFFF" },
  violet: { name: "Deep purple", base: "#30123F", dark: "#1B0827", ink: "#F1E4FA" },
  sky: { name: "Electric blue", base: "#1879D2", dark: "#0F5599", ink: "#FFFFFF" },
  lime: { name: "Golden yellow", base: "#F9A719", dark: "#C77F08", ink: "#2A1A05" },
  rose: { name: "Dusty pink", base: "#D5B5A5", dark: "#A98672", ink: "#3A1D14" },
  slate: { name: "Charcoal black", base: "#29252A", dark: "#121013", ink: "#F6EFE4" },
};
/** The six colours the app offers; teal and lime stay valid in the database for older posts and look like blue and gold. */
export const WALL_COLOR_CHOICES = ["coral", "mustard", "sky", "violet", "rose", "slate"] as const;
/** The icon an author puts on their post. Keys are stored in posts.wall_icon (8 characters at most). */
export const WALL_ICON_KEYS = ["crown", "flame", "heart", "eye", "ask", "mega", "star", "music", "plane", "camera", "ghost", "bolt", "moon", "book", "coffee", "game", "ball", "globe", "bulb", "chat", "rocket", "key"] as const;
export type WallIconKey = (typeof WALL_ICON_KEYS)[number];
export const MAX_WALL_WORDS = 3;
export function wordCount(s: string | null | undefined): number { return (s ?? "").trim().split(/\s+/).filter(Boolean).length; }

export const AVATAR_STYLES = ["blob", "brick", "door", "star", "eye", "bolt"] as const;
export const AVATAR_COLORS = ["#F2573F", "#F7B538", "#19B5A5", "#8C5CF5", "#5DB7FF", "#B5E04A", "#FF7BA9", "#E9E7F5"];
export const INTERESTS = ["art", "music", "gaming", "books", "sports", "tech", "food", "travel", "film", "science", "fashion", "nature", "writing", "photography", "fitness", "design"];

export const POST_TYPES: Record<PostType, { label: string; blurb: string; icon: string }> = {
  ask_me: { label: "Ask Me", blurb: "Invite questions, anonymous or not. You choose what gets answered.", icon: "?" },
  hidden_thought: { label: "Hidden Thought", blurb: "Share a thought, but keep part of it concealed behind a clue.", icon: "…" },
  picture: { label: "Picture Wall", blurb: "Pin a photo with a question or caption attached.", icon: "▣" },
  prompt_response: { label: "Random Prompt", blurb: "Answer a conversation prompt from the platform.", icon: "!" },
  false_wall: { label: "Build a False Wall", blurb: "Conceal a question, photo, story, poll or conversation behind a wall.", icon: "▤" },
};
/** Icons an author can put on a private wall. */
export const WALL_ICONS = ["🧱", "❓", "🔥", "👀", "💬", "🏆", "💡", "❤️", "⭐", "🌙", "🎵", "🎨", "📸", "🎮", "📚", "⚽", "🍜", "☕", "🌍", "🦋", "🔮", "🗝️", "🎭", "🌈"] as const;

export const CREATE_ROUTES: Record<string, PostType> = {
  "picture-wall": "picture", "false-wall": "false_wall",
  // These three only live on private walls: reached from "My private wall", never listed on the public Wall or Discover.
  "ask-me": "ask_me", "hidden-thought": "hidden_thought", "random-prompt": "prompt_response",
  // A numbered list of questions, stored as an Ask Me wall.
  "pick-number": "ask_me",
};
export const TYPE_TO_ROUTE: Record<PostType, string> = {
  ask_me: "ask-me", hidden_thought: "hidden-thought", picture: "picture-wall", prompt_response: "random-prompt", false_wall: "false-wall",
};

export const FALSE_WALL_KINDS: Record<FalseWallKind, string> = {
  question: "A question", photo: "A photograph", story: "A story", poll: "A poll", conversation: "A conversation",
};
export const CLUE_STYLES: Record<ClueStyle, { label: string; hint: string }> = {
  crack: { label: "Crack", hint: "A thin crack runs across the wall." },
  handle: { label: "Hidden handle", hint: "A small handle sits half out of sight." },
  glow: { label: "Glowing edge", hint: "Light leaks around the edges." },
  texture: { label: "Odd texture", hint: "The bricks look different here." },
  opening: { label: "Suspicious opening", hint: "A gap that should not be there." },
};

/** The same five reactions and colours as Walls Gist. The stored kinds stay as they were. */
export const REACTIONS: { kind: ReactionKind; label: string; glyph: string; color: string }[] = [
  { kind: "like", label: "Love", glyph: "❤️", color: "#FF4D6D" },
  { kind: "funny", label: "Funny", glyph: "😂", color: "#FFC83D" },
  { kind: "surprising", label: "Wow", glyph: "😮", color: "#FF9F43" },
  { kind: "thought_provoking", label: "Sad", glyph: "😢", color: "#7BC4FF" },
  { kind: "interesting", label: "Fire", glyph: "🔥", color: "#F9A719" },
];

export const LIMITS = {
  title: 120, body: 1000, clue: 140, hidden: 2000, question: 500, reply: 600, answer: 1000, bio: 200, caption: 120,
  images: 4, imageBytes: 5 * 1024 * 1024, avatarBytes: 2 * 1024 * 1024,
};
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "threat", label: "Threat or violence" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "minor_safety", label: "Puts a young person at risk" },
  { value: "privacy", label: "Shares private information" },
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "self_harm", label: "Self-harm concern" },
  { value: "hate", label: "Hateful content" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
] as const;

/** Brick colours for a private wall, drawn in the Discover brick style: dark brick, lighter mortar. Each also comes with a glow. */
export const BRICK_COLOURS = [
  { key: "red", name: "Red", wall: "#A8121C", mortar: "#E51F2B" },
  { key: "gold", name: "Golden", wall: "#C77F08", mortar: "#F9A719" },
  { key: "blue", name: "Blue", wall: "#0F5599", mortar: "#1879D2" },
  { key: "purple", name: "Purple", wall: "#241033", mortar: "#6a3a85" },
  { key: "pink", name: "Dusty pink", wall: "#A98672", mortar: "#D5B5A5" },
  { key: "black", name: "Charcoal", wall: "#121013", mortar: "#4a444c" },
  { key: "green", name: "Green", wall: "#0f5a31", mortar: "#1f9d55" },
  { key: "teal", name: "Teal", wall: "#0a5b60", mortar: "#16b2b8" },
  { key: "orange", name: "Orange", wall: "#a8430a", mortar: "#f26a1b" },
  { key: "magenta", name: "Magenta", wall: "#7a0f4d", mortar: "#d6258f" },
] as const;
/** The look for a colour key like "bk-blue" or "bk-blue-glow", or null for any other kind of background. */
export function brickLook(key: string): { wall: string; mortar: string; glow: boolean } | null {
  const m = /^bk-([a-z]+)(-glow)?$/.exec(key);
  const c = m && BRICK_COLOURS.find((x) => x.key === m[1]);
  return c ? { wall: c.wall, mortar: c.mortar, glow: !!m![2] } : null;
}
/** Older brick photos, art and lifestyle pictures, and the member's own upload. */
export const BRICKS = [
  { key: "classic", name: "Classic red", swatch: "#9a2f22", group: "legacy" },
  { key: "charcoal", name: "Charcoal", swatch: "#48454a", group: "legacy" },
  { key: "navy", name: "Midnight blue", swatch: "#26437a", group: "legacy" },
  { key: "plum", name: "Plum", swatch: "#6a2a7c", group: "legacy" },
  { key: "forest", name: "Forest", swatch: "#265a3c", group: "legacy" },
  { key: "sand", name: "Sand", swatch: "#d3b998", group: "legacy" },
  { key: "art1", name: "Paint strokes", swatch: "#2a1344", group: "art" },
  { key: "art2", name: "Street mural", swatch: "#3a363c", group: "art" },
  { key: "life1", name: "Cosy corner", swatch: "#c89a7e", group: "life" },
  { key: "life2", name: "City dusk", swatch: "#5c2a6e", group: "life" },
] as const;
export type PresetKey = (typeof BRICKS)[number]["key"];
export type BrickKey = string;
export const isBrick = (v: string): boolean => v === "custom" || BRICKS.some((b) => b.key === v) || !!brickLook(v);
/** True when the look is a picture (art, lifestyle or uploaded) rather than bricks. */
export const isPicture = (v: string) => v === "custom" || BRICKS.some((b) => b.key === v && b.group !== "legacy");
export const BG_UPLOAD = { width: 1080, height: 1920, maxMb: 5 } as const;
/** Keeps at most three words as someone types, so card text can never run long. */
export function clampWords(v: string): string {
  const parts = v.replace(/\s+/g, " ").split(" ");
  const filled = parts.filter(Boolean);
  return filled.length > MAX_WALL_WORDS ? filled.slice(0, MAX_WALL_WORDS).join(" ") : parts.join(" ").replace(/^ /, "");
}

export const EXPERIENCE_CATEGORIES = { music: "Music", games: "Games", food: "Food", travel: "Travel", film: "Film", sports: "Sports", art: "Art", learning: "Learning", wellness: "Wellness", nightlife: "Nightlife", community: "Community", other: "Other" } as const;
export type ExperienceCategory = keyof typeof EXPERIENCE_CATEGORIES;
export const isExperienceCategory = (v: unknown): v is ExperienceCategory => typeof v === "string" && v in EXPERIENCE_CATEGORIES;
export const GIST_MAX = 280;

/** Post types that belong to private walls only. The public Wall, Discover, search and profiles leave them out. */
export const PRIVATE_ONLY_TYPES = ["ask_me", "hidden_thought", "prompt_response"] as const;
export const PRIVATE_ONLY_IN = `(${PRIVATE_ONLY_TYPES.join(",")})`;

/** A "Pick a number" wall is an Ask Me wall whose body starts with this marker, then one question per line. */
export const PICK_MARK = "#pick\n";
export const PICK_MAX = 10;
export function parsePick(body: string | null | undefined): string[] | null {
  if (!body || !body.startsWith(PICK_MARK)) return null;
  const qs = body.slice(PICK_MARK.length).split("\n").map((q) => q.trim()).filter(Boolean);
  return qs.length ? qs : null;
}
