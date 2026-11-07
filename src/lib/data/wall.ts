import "server-only";
import { createClient } from "@/lib/supabase/server";
import { POST_SELECT, hydratePosts } from "@/lib/data/posts";
import type { Post } from "@/lib/types";

/** A post as it hangs on the Wall: the post itself plus the two numbers shown on its corner. */
export type WallPost = Post & { likes: number; comments: number };
export const WALL_PAGE = 24;

/**
 * One page of the Wall, newest first. It reads the same posts, through the same row-level security and the same
 * "publicly discoverable only" rule, as Discover, so the two screens never disagree about what is visible.
 */
export async function getWallPage(offset: number): Promise<{ posts: WallPost[]; hasMore: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_SELECT).eq("status", "active").eq("visibility", "public")
    .order("created_at", { ascending: false }).order("id").range(offset, offset + WALL_PAGE);
  const rows = (data ?? []) as never[];
  const posts = (await hydratePosts(supabase, rows)).slice(0, WALL_PAGE);
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
  return { posts: posts.map((p) => ({ ...p, likes: likes.get(p.id) ?? 0, comments: comments.get(p.id) ?? 0 })), hasMore: (data ?? []).length > WALL_PAGE };
}

/** How many public posts are newer than the newest one the viewer has on screen. */
export async function countNewerPosts(newestIso: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "active").eq("visibility", "public").gt("created_at", newestIso);
  return count ?? 0;
}
