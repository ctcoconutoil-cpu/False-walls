import { PRIVATE_ONLY_IN } from "@/lib/constants";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { POST_SELECT, hydratePosts } from "@/lib/data/posts";
import { MAX_WALL_WORDS, wordCount } from "@/lib/constants";
import type { Post } from "@/lib/types";

/** A post as it hangs on the Wall: the post itself plus the two numbers shown on its corner. */
export type WallPost = Post & { likes: number; comments: number };
export const WALL_PAGE = 30;
const RAW = 60;

/** The Wall only carries posts whose wall text is one to three words, so every board reads at a glance. */
export const fitsWall = (p: Post) => { const n = wordCount(p.title); return n >= 1 && n <= MAX_WALL_WORDS; };

/**
 * A page of the Wall, newest first. It reads the same posts, through the same row-level security and the same
 * "publicly discoverable only" rule, as Discover. `next` is the raw offset to ask for next, or null at the end.
 */
export async function getWallPage(offset: number): Promise<{ posts: WallPost[]; next: number | null }> {
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_SELECT).eq("status", "active").eq("visibility", "public").not("type", "in", PRIVATE_ONLY_IN)
    .order("created_at", { ascending: false }).order("id").range(offset, offset + RAW - 1);
  const raw = (data ?? []) as never[];
  const posts = (await hydratePosts(supabase, raw)).filter(fitsWall);
  const ids = posts.map((p) => p.id);
  const likes = new Map<string, number>(), comments = new Map<string, number>();
  if (ids.length) {
    const [rx, an, rp] = await Promise.all([
      supabase.rpc("reaction_counts", { p_type: "post", p_ids: ids }),
      supabase.from("answers").select("post_id").in("post_id", ids).eq("is_public", true).eq("status", "active"),
      supabase.from("replies").select("post_id").in("post_id", ids).eq("status", "active"),
    ]);
    ((rx.data ?? []) as { target_id: string; n: number }[]).forEach((r) => likes.set(r.target_id, (likes.get(r.target_id) ?? 0) + Number(r.n)));
    ((an.data ?? []) as { post_id: string }[]).forEach((r) => comments.set(r.post_id, (comments.get(r.post_id) ?? 0) + 1));
    ((rp.data ?? []) as { post_id: string }[]).forEach((r) => comments.set(r.post_id, (comments.get(r.post_id) ?? 0) + 1));
  }
  return { posts: posts.map((p) => ({ ...p, likes: likes.get(p.id) ?? 0, comments: comments.get(p.id) ?? 0 })), next: raw.length === RAW ? offset + RAW : null };
}

/** How many public posts are newer than the newest one the viewer has on screen. */
export async function countNewerPosts(newestIso: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select("title").eq("status", "active").eq("visibility", "public").not("type", "in", PRIVATE_ONLY_IN).gt("created_at", newestIso).limit(40);
  return (data ?? []).filter((r) => { const n = wordCount(r.title as string | null); return n >= 1 && n <= MAX_WALL_WORDS; }).length;
}
