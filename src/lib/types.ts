export type PostType = "ask_me" | "hidden_thought" | "picture" | "prompt_response" | "false_wall";
export type WallColor = "coral" | "mustard" | "teal" | "violet" | "sky" | "lime" | "rose" | "slate";
export type ClueStyle = "crack" | "handle" | "glow" | "texture" | "opening";
export type FalseWallKind = "question" | "photo" | "story" | "poll" | "conversation";
export type ReactionKind = "interesting" | "funny" | "surprising" | "thought_provoking" | "like";
export type AreaSlug = "main" | "trending" | "hidden" | "picture" | "question" | "community";

export type AuthorLite = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_style: string;
  avatar_color: string;
  avatar_url: string | null;
};

export type MediaLite = { storage_path: string; width: number | null; height: number | null; alt_text: string | null; url?: string };

export type Post = {
  id: string;
  author_id: string | null;
  type: PostType;
  title: string | null;
  body: string | null;
  clue: string | null;
  prompt_id: string | null;
  false_wall_kind: FalseWallKind | null;
  clue_style: ClueStyle | null;
  wall_color: WallColor;
  wall_icon: string | null;
  visibility: "public" | "followers";
  reveal_mode: "anyone" | "followers";
  allow_anonymous_questions: boolean;
  allow_replies: boolean;
  allow_chains: boolean;
  area_slug: AreaSlug;
  is_sample: boolean;
  status: "active" | "hidden" | "removed";
  created_at: string;
  author: AuthorLite | null;
  media: MediaLite[];
  prompt_text?: string | null;
};

export type Profile = AuthorLite & { age_group: "teen" | "adult"; role: "user" | "moderator" | "admin"; status: "active" | "suspended" };

export type Settings = {
  profile_public: boolean; discoverable: boolean; show_stats: boolean; show_badges: boolean; show_walls: boolean;
  show_answers: boolean; show_pictures: boolean; allow_follows: boolean; allow_anonymous_questions: boolean;
  allow_identified_questions: boolean; notify_questions: boolean; notify_answers: boolean; notify_replies: boolean;
  notify_reactions: boolean; notify_follows: boolean; notify_chains: boolean; notify_badges: boolean; notify_discoveries: boolean;
};

export type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };
