import type { AreaSlug, ClueStyle, FalseWallKind, PostType, ReactionKind, WallColor } from "./types";

export const TAGLINE = "Look closer. There's more behind the wall.";

export const WALL_COLORS: Record<WallColor, { name: string; base: string; dark: string; ink: string }> = {
  coral: { name: "Coral", base: "#F2573F", dark: "#B93A27", ink: "#2A0D08" },
  mustard: { name: "Mustard", base: "#F7B538", dark: "#BE8618", ink: "#2C1E02" },
  teal: { name: "Teal", base: "#19B5A5", dark: "#0E7F73", ink: "#04201C" },
  violet: { name: "Violet", base: "#8C5CF5", dark: "#5E34C2", ink: "#150833" },
  sky: { name: "Sky", base: "#5DB7FF", dark: "#2E86CC", ink: "#06213A" },
  lime: { name: "Lime", base: "#B5E04A", dark: "#80A722", ink: "#1B2705" },
  rose: { name: "Rose", base: "#FF7BA9", dark: "#CC4F7D", ink: "#350A1C" },
  slate: { name: "Slate", base: "#6E7691", dark: "#464C66", ink: "#0C0E18" },
};

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
/** Icons an author can pin on their wall. Defaults come from the wall type when none is chosen. */
export const WALL_ICONS = ["🧱", "❓", "🔥", "👀", "💬", "🏆", "💡", "❤️", "⭐", "🌙", "🎵", "🎨", "📸", "🎮", "📚", "⚽", "🍜", "☕", "🌍", "🦋", "🔮", "🗝️", "🎭", "🌈"] as const;
export const DEFAULT_ICON: Record<PostType, string> = { ask_me: "❓", hidden_thought: "💬", picture: "📸", prompt_response: "💡", false_wall: "👀" };
export const iconFor = (post: { type: PostType; wall_icon?: string | null }) =>
  post.wall_icon && (WALL_ICONS as readonly string[]).includes(post.wall_icon) ? post.wall_icon : DEFAULT_ICON[post.type];

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

export const REACTIONS: { kind: ReactionKind; label: string; glyph: string }[] = [
  { kind: "interesting", label: "Interesting", glyph: "◆" },
  { kind: "funny", label: "Funny", glyph: "✦" },
  { kind: "surprising", label: "Surprising", glyph: "!" },
  { kind: "thought_provoking", label: "Thought-provoking", glyph: "?" },
  { kind: "like", label: "Like", glyph: "♥" },
];

export const AREAS: Record<AreaSlug, { name: string; blurb: string; wall: string; floor: string; accent: string; mortar: string; tagline: string }> = {
  main: { name: "Main Wall", blurb: "The crossroads. Every kind of wall turns up here.", wall: "#B4503A", floor: "#2B2540", accent: "#F2573F", mortar: "#7C3425", tagline: "Where it starts" },
  trending: { name: "Trending Wall", blurb: "Conversations people are genuinely talking about.", wall: "#4B2C86", floor: "#1B1233", accent: "#FF7BA9", mortar: "#30195C", tagline: "Lit up tonight" },
  hidden: { name: "Hidden Wall", blurb: "Quiet corners with thoughts people almost kept to themselves.", wall: "#24365F", floor: "#101728", accent: "#5DB7FF", mortar: "#16213D", tagline: "Keep your voice down" },
  picture: { name: "Picture Wall", blurb: "Photographs pinned up with a question attached.", wall: "#2F6F68", floor: "#13292A", accent: "#19B5A5", mortar: "#1E4A45", tagline: "Take a closer look" },
  question: { name: "Question Wall", blurb: "Open invitations: ask what you have always wondered.", wall: "#B98A1F", floor: "#2D2410", accent: "#F7B538", mortar: "#80600F", tagline: "Go on, ask" },
  community: { name: "Community Wall", blurb: "Prompt answers and the chains they grow into.", wall: "#6A8F2E", floor: "#1B2610", accent: "#B5E04A", mortar: "#486420", tagline: "Everyone's mural" },
};
export const AREA_ORDER: AreaSlug[] = ["main", "trending", "hidden", "picture", "question", "community"];

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
