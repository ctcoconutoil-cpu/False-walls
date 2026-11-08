import type { Person } from "@/lib/people";
export const GIST_REACTIONS = [["heart", "❤️", "Love"], ["laugh", "😂", "Funny"], ["wow", "😮", "Wow"], ["sad", "😢", "Sad"], ["fire", "🔥", "Fire"]] as const;
export type GistReaction = (typeof GIST_REACTIONS)[number][0];
export type Gist = { id: string; body: string; created_at: string; mine: boolean; reactions: Partial<Record<GistReaction, number>>; my: GistReaction | null; comments: number; author: Omit<Person, "id"> };
export type GistComment = { id: string; body: string; created_at: string; mine: boolean; author: Omit<Person, "id"> };
