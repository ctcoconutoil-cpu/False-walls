import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExperienceCategory } from "@/lib/constants";

export type Person = { id: string; username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null };
export type Experience = {
  id: string; title: string; description: string; category: ExperienceCategory; url: string; starts_at: string | null; created_at: string;
  image: string | null; author_id: string; author: Person | null;
};
export type Gist = { id: string; body: string; created_at: string; mine: boolean; likes: number; liked: boolean; author: Omit<Person, "id"> };

/** Experiences for Discover: what's coming up first (soonest first), then everything else, newest first. Past events drop off a day later. */
export async function getExperiences(category: string | null): Promise<Experience[]> {
  const supabase = await createClient();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  let q = supabase.from("experiences")
    .select("id, title, description, category, url, starts_at, created_at, image_path, author_id, author:profiles!experiences_author_id_fkey(id,username,display_name,avatar_style,avatar_color,avatar_url)")
    .eq("status", "active").or(`starts_at.is.null,starts_at.gte.${dayAgo}`)
    .order("created_at", { ascending: false }).limit(60);
  if (category) q = q.eq("category", category);
  const { data } = await q;
  const rows = (data ?? []).map((r) => ({
    id: r.id as string, title: r.title as string, description: r.description as string, category: r.category as ExperienceCategory, url: r.url as string,
    starts_at: (r.starts_at as string | null), created_at: r.created_at as string, author_id: r.author_id as string,
    image: r.image_path ? supabase.storage.from("experiences").getPublicUrl(r.image_path as string).data.publicUrl : null,
    author: (Array.isArray(r.author) ? r.author[0] : r.author) as Person | null,
  }));
  const now = Date.now();
  const soon = (e: Experience) => e.starts_at && new Date(e.starts_at).getTime() >= now;
  return [...rows.filter(soon).sort((a, b) => +new Date(a.starts_at!) - +new Date(b.starts_at!)), ...rows.filter((e) => !soon(e))];
}

export async function followsAnyone(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", userId);
  return (count ?? 0) > 0;
}

/** The feed is empty by design until the viewer follows someone. */
export async function getGistFeed(tab: "following" | "foryou"): Promise<Gist[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gist_feed", { p_tab: tab, p_limit: 30 });
  return (data ?? []) as Gist[];
}

export async function getSuggestions(limit = 12): Promise<Person[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("suggest_people", { p_limit: limit });
  return (data ?? []) as Person[];
}
