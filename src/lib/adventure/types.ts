export type Profession = { id: string; slug: string; name: string; emoji: string; color: string; blurb: string | null; total: number; found: number; ends_at?: string | null };
export type Progress = {
  objects: number; riddles: number; collections: number; team_collections: number; sections: number; rare: number;
  xp: number; level: number; xp_into: number; xp_per_level: number; fire: boolean;
  next: { title: string; metric: string; threshold: number; current: number; icon: string } | null;
};
export type Mission = {
  riddle_id: string; kind: "riddle" | "silhouette" | "direct"; prompt: string; hint: string | null; difficulty: number;
  profession: string; slug: string; color: string; profession_emoji: string; solved: boolean; emoji: string | null; name: string | null;
};
export type TeamLite = { id: string; name: string; status: string; profession: string; slug: string; emoji: string; color: string; members: number; found: number; total: number; unread: number };
export type Invite = { team_id: string; name: string; profession: string; emoji: string; from: string | null };
export type Overview = {
  joined: boolean; active: { profession_id: string | null; team_id: string | null }; progress: Progress;
  professions: Profession[]; missions: Mission[]; teams: TeamLite[]; invites: Invite[];
};
export type CollectionObject = {
  id: string; sort: number; rarity: "common" | "rare"; found: boolean; found_at: string | null; via_team: boolean; unlocked: boolean;
  name: string | null; emoji: string | null; image_path: string | null; area: string | null;
  mission: { riddle_id: string; kind: Mission["kind"]; prompt: string; hint: string | null; difficulty: number; solved: boolean; silhouette: string | null } | null;
};
export type Collection = {
  profession: { id: string; slug: string; name: string; emoji: string; color: string; blurb: string | null; ends_at: string | null };
  playing: boolean; active_team: string | null; teams: { id: string; name: string }[]; objects: CollectionObject[];
};
export type BookShelf = {
  slug: string; name: string; emoji: string; color: string; total: number; found: number;
  items: { name: string; emoji: string; image_path: string | null; rarity: string; found_at: string | null; via_team: boolean; found: boolean }[];
};
export type RewardItem = { slug: string; title: string; description: string; icon: string; color: string; reward: "badge" | "fire"; metric: string; threshold: number; current: number; earned: boolean; earned_at: string | null };
export type Rewards = { progress: Progress; items: RewardItem[] };
export type Person = { id?: string; username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null };
export type TeamDetail = {
  team: { id: string; name: string; status: string; owner_id: string }; me: { id: string; status: string };
  profession: { slug: string; name: string; emoji: string; color: string }; total: number; found: number; playing: boolean;
  members: (Person & { id: string; status: string; found: number })[];
  objects: { id: string; found: boolean; name: string | null; emoji: string | null; image_path: string | null; by: string | null; found_at: string | null }[];
};
export type TeamMessage = { id: number; kind: "text" | "discovery"; body: string; created_at: string; mine: boolean; user: Person | null };
export type MazeObject = {
  id: string; name: string; emoji: string; image_path: string | null; rarity: "common" | "rare"; visibility: "clear" | "hidden";
  placement: "dead_end" | "corner" | "junction" | "corridor" | "room"; tile_x: number | null; tile_y: number | null; section: number; per_player: boolean;
};
export type MazeAdventure = { profession: { slug: string; name: string; emoji: string; color: string }; team_id: string | null; objects: MazeObject[] };
export type CollectResult = {
  object: { id: string; name: string; emoji: string; image_path: string | null; rarity: string };
  mine: boolean; shared: boolean; total: number; found: number; team_found: number | null; rewards: string[];
};
export type AnswerResult = { correct: boolean; object?: { id: string; name: string; emoji: string; image_path: string | null }; rewards?: string[] };
export type ProfileAdventure = { fire: boolean; level: number; badges: { slug: string; title: string; icon: string; color: string; reward: string }[] };
