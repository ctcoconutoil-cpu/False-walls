import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { WallColor } from "@/lib/types";

export type SharedAuthor = { username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url?: string | null };
export type SharedWall = {
  id: string; title: string; body: string | null; wall_color: WallColor; wall_icon: string | null;
  template: "pick_number" | null; options: string[] | null; allow_anonymous: boolean; author: SharedAuthor;
  answers?: { id: string; question: string; answer: string; created_at: string }[];
};
export type SharedQuestion = { question: string; answered: boolean; answer: string | null; wall_token: string | null; author: SharedAuthor };

const isToken = (t: string) => /^[a-f0-9]{32}$/.test(t);

export const getSharedWall = cache(async (token: string) => {
  if (!isToken(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_wall", { p_token: token });
  return (data ?? null) as SharedWall | null;
});

export const getSharedQuestion = cache(async (token: string) => {
  if (!isToken(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_question", { p_token: token });
  return (data ?? null) as SharedQuestion | null;
});
