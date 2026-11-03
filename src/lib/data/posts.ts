import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AreaSlug, Post, ReactionKind } from "@/lib/types";
import { SLOTS_PER_SECTION } from "@/lib/maze/layout";

export const POST_SELECT =
  "*, author:profiles!posts_author_id_fkey(id,username,display_name,avatar_style,avatar_color,avatar_url), media:post_media(storage_path,width,height,alt_text,is_hidden), prompt:random_prompts(text)";

type Row = Omit<Post, "media" | "prompt_text"> & {
  media: { storage_path: string; width: number | null; height: number | null; alt_text: string | null; is_hidden: boolean }[] | null;
  prompt: { text: string } | null;
};

/** Attaches short-lived signed URLs for visible (non-concealed) images and flattens joins. */
export async function hydratePosts(supabase: SupabaseClient, rows: Row[]): Promise<Post[]> {
  const paths = rows.flatMap((r) => (r.media ?? []).filter((m) => !m.is_hidden).map((m) => m.storage_path));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("post-media").createSignedUrls(paths, 3600);
    data?.forEach((d) => { if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl); });
  }
  return rows.map((r) => ({
    ...r,
    prompt_text: r.prompt?.text ?? null,
    media: (r.media ?? []).filter((m) => !m.is_hidden).map((m) => ({ ...m, url: urls.get(m.storage_path) })),
  })) as Post[];
}

export type AreaItem = { slot: number; post: Post };

export async function getAreaItems(area: AreaSlug, section: number, tab: "trending" | "newest" = "trending") {
  const supabase = await createClient();
  const from = section * SLOTS_PER_SECTION;

  if (area === "trending") {
    if (tab === "newest") {
      const { data } = await supabase.from("posts").select(POST_SELECT).eq("status", "active").eq("visibility", "public")
        .order("created_at", { ascending: false }).range(from, from + SLOTS_PER_SECTION);
      const posts = await hydratePosts(supabase, (data ?? []) as unknown as Row[]);
      return { items: posts.slice(0, SLOTS_PER_SECTION).map((post, i) => ({ slot: from + i, post })), hasMore: posts.length > SLOTS_PER_SECTION };
    }
    const { data: ranked } = await supabase.rpc("trending_posts", { p_limit: SLOTS_PER_SECTION + 1, p_offset: from, p_area: null, p_type: null });
    const ids = ((ranked ?? []) as { post_id: string }[]).map((r) => r.post_id);
    if (!ids.length) return { items: [] as AreaItem[], hasMore: false };
    const { data } = await supabase.from("posts").select(POST_SELECT).in("id", ids);
    const byId = new Map(((await hydratePosts(supabase, (data ?? []) as unknown as Row[]))).map((p) => [p.id, p]));
    // Only publicly discoverable posts appear in the Wall; followers-only posts stay on profiles and in threads.
    const ordered = (ids.map((id) => byId.get(id)).filter(Boolean) as Post[]).filter((p) => p.visibility === "public");
    return { items: ordered.slice(0, SLOTS_PER_SECTION).map((post, i) => ({ slot: from + i, post })), hasMore: ordered.length > SLOTS_PER_SECTION };
  }

  const [{ data }, { data: last }] = await Promise.all([
    supabase.from("wall_locations")
      .select(`slot_index, post:posts!inner(${POST_SELECT})`)
      .eq("area_slug", area).gte("slot_index", from).lt("slot_index", from + SLOTS_PER_SECTION).order("slot_index"),
    supabase.from("wall_locations").select("slot_index").eq("area_slug", area).order("slot_index", { ascending: false }).limit(1),
  ]);
  const rows = ((data ?? []) as unknown as { slot_index: number; post: Row }[]).filter((r) => r.post.visibility === "public");
  const posts = await hydratePosts(supabase, rows.map((r) => r.post));
  const items: AreaItem[] = rows.map((r, i) => ({ slot: r.slot_index, post: posts[i] }));
  const maxSlot = (last?.[0]?.slot_index as number | undefined) ?? 0;
  return { items, hasMore: maxSlot >= from + SLOTS_PER_SECTION };
}

export type DiscoverFilter = "new" | "trending";
export const DISCOVER_PAGE = 12;

/**
 * The Discover feed. It reads the same posts as the Wall, through the same row-level security, and applies
 * the same "publicly discoverable only" rule, so the two screens can never disagree about what is visible.
 */
export async function getDiscoverFeed(filter: DiscoverFilter, type: string | null, page: number) {
  const supabase = await createClient();
  const from = page * DISCOVER_PAGE;
  if (filter === "trending") {
    const { data: ranked } = await supabase.rpc("trending_posts", { p_limit: DISCOVER_PAGE + 1, p_offset: from, p_area: null, p_type: type });
    const ids = ((ranked ?? []) as { post_id: string }[]).map((r) => r.post_id);
    if (!ids.length) return { posts: [] as Post[], hasMore: false };
    const { data } = await supabase.from("posts").select(POST_SELECT).in("id", ids);
    const byId = new Map((await hydratePosts(supabase, (data ?? []) as unknown as Row[])).map((p) => [p.id, p]));
    const ordered = (ids.map((id) => byId.get(id)).filter(Boolean) as Post[]).filter((p) => p.visibility === "public");
    return { posts: ordered.slice(0, DISCOVER_PAGE), hasMore: ids.length > DISCOVER_PAGE };
  }
  let q = supabase.from("posts").select(POST_SELECT).eq("status", "active").eq("visibility", "public");
  if (type) q = q.eq("type", type);
  const { data } = await q.order("created_at", { ascending: false }).range(from, from + DISCOVER_PAGE);
  const posts = await hydratePosts(supabase, (data ?? []) as unknown as Row[]);
  return { posts: posts.slice(0, DISCOVER_PAGE), hasMore: posts.length > DISCOVER_PAGE };
}

export async function getPostById(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await hydratePosts(supabase, [data as unknown as Row]))[0];
}

export async function getPostsByIds(ids: string[]) {
  if (!ids.length) return [] as Post[];
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_SELECT).in("id", ids).eq("status", "active");
  return hydratePosts(supabase, (data ?? []) as unknown as Row[]);
}

export type ReactionSummary = Record<string, { counts: Partial<Record<ReactionKind, number>>; mine: ReactionKind | null }>;

export async function getReactionSummary(type: "post" | "answer" | "reply", ids: string[]): Promise<ReactionSummary> {
  const out: ReactionSummary = {};
  ids.forEach((id) => (out[id] = { counts: {}, mine: null }));
  if (!ids.length) return out;
  const supabase = await createClient();
  const { data } = await supabase.rpc("reaction_counts", { p_type: type, p_ids: ids });
  ((data ?? []) as { target_id: string; kind: ReactionKind; n: number; mine: boolean }[]).forEach((r) => {
    out[r.target_id].counts[r.kind] = r.n;
    if (r.mine) out[r.target_id].mine = r.kind;
  });
  return out;
}

export async function getThread(postId: string, viewerId: string | null) {
  const supabase = await createClient();
  const [answersRes, repliesRes, chainRes, savedRes] = await Promise.all([
    supabase.from("answers").select("id, question_text, body, created_at, is_public, author_id, asker:profiles!answers_asker_id_fkey(username,display_name,avatar_style,avatar_color,avatar_url)")
      .eq("post_id", postId).eq("is_public", true).eq("status", "active").order("created_at", { ascending: true }),
    supabase.from("replies").select("id, answer_id, parent_reply_id, body, created_at, author_id, author:profiles!replies_author_id_fkey(username,display_name,avatar_style,avatar_color,avatar_url)")
      .eq("post_id", postId).eq("status", "active").order("created_at", { ascending: true }).limit(200),
    supabase.from("wall_chain_links").select("id, chain_id, parent_post_id, child_post_id, via_answer_id"),
    viewerId ? supabase.from("saved_posts").select("post_id").eq("post_id", postId).eq("user_id", viewerId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const links = (chainRes.data ?? []) as { id: string; chain_id: string; parent_post_id: string; child_post_id: string; via_answer_id: string | null }[];
  const parentLink = links.find((l) => l.child_post_id === postId) ?? null;
  const childLinks = links.filter((l) => l.parent_post_id === postId);
  type Au = { username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null };
  const answers = ((answersRes.data ?? []) as unknown as { id: string; question_text: string; body: string; created_at: string; asker: Au | null }[]);
  const replies = ((repliesRes.data ?? []) as unknown as { id: string; answer_id: string | null; parent_reply_id: string | null; body: string; created_at: string; author_id: string; author: Au | null }[]);
  const [pr, ar, rr] = await Promise.all([
    getReactionSummary("post", [postId]), getReactionSummary("answer", answers.map((a) => a.id)), getReactionSummary("reply", replies.map((r) => r.id)),
  ]);
  const related = await getPostsByIds([...(parentLink ? [parentLink.parent_post_id] : []), ...childLinks.map((l) => l.child_post_id)]);
  return {
    answers, replies, saved: !!savedRes.data, parentLink, childLinks, related,
    reactions: { post: pr[postId], answers: ar, replies: rr },
  };
}
