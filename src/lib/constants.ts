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
  "ask-me": "ask_me", "hidden-thought": "hidden_thought", "picture-wall": "picture",
  "random-prompt": "prompt_response", "false-wall": "false_wall",
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

export const REACTIONS: { kind: ReactionKind; label: string; glyph: string; color: string }[] = [
  { kind: "interesting", label: "Interesting", glyph: "💡", color: "#FFD84A" },
  { kind: "funny", label: "Funny", glyph: "😂", color: "#FFC83D" },
  { kind: "surprising", label: "Surprising", glyph: "😮", color: "#FF9F43" },
  { kind: "thought_provoking", label: "Thought-provoking", glyph: "🤔", color: "#7BC4FF" },
  { kind: "like", label: "Like", glyph: "❤️", color: "#FF4D6D" },
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

/** Brick colours a member can choose for their private wall. */
export const BRICKS = [
  { key: "classic", name: "Classic red", swatch: "#9a2f22" },
  { key: "charcoal", name: "Charcoal", swatch: "#48454a" },
  { key: "navy", name: "Midnight blue", swatch: "#26437a" },
  { key: "plum", name: "Plum", swatch: "#6a2a7c" },
  { key: "forest", name: "Forest", swatch: "#265a3c" },
  { key: "sand", name: "Sand", swatch: "#d3b998" },
] as const;
export type BrickKey = (typeof BRICKS)[number]["key"];
export const isBrick = (v: string): v is BrickKey => BRICKS.some((b) => b.key === v);
/** Keeps at most three words as someone types, so card text can never run long. */
export function clampWords(v: string): string {
  const parts = v.replace(/\s+/g, " ").split(" ");
  const filled = parts.filter(Boolean);
  return filled.length > MAX_WALL_WORDS ? filled.slice(0, MAX_WALL_WORDS).join(" ") : parts.join(" ").replace(/^ /, "");
}
