import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPostsByIds } from "@/lib/data/posts";
import { PICK_MARK, type BrickKey } from "@/lib/constants";
import type { WallPost } from "@/lib/data/wall";
import type { WallColor } from "@/lib/types";

export type PCard = { id: string; kind: "prompt" | "post"; title: string | null; icon: string | null; color: WallColor; post_id: string | null };
/** A card as the wall draws it: the card, the public post it points at (if any), and the owner's numbers. */
export type ViewCard = PCard & { post: WallPost | null; total?: number; unread?: number };
export type WallOwner = { username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null };
export type PublicPrivateWall = { slug: string; brick: BrickKey; bg: string | null; accepting: boolean; owner: WallOwner; cards: ViewCard[] };

const asWallPost = (p: Awaited<ReturnType<typeof getPostsByIds>>[number]): WallPost => ({ ...p, likes: 0, comments: 0 });
async function attachPosts(cards: PCard[]): Promise<ViewCard[]> {
  const ids = cards.filter((c) => c.kind === "post" && c.post_id).map((c) => c.post_id as string);
  const byId = new Map((await getPostsByIds(ids)).map((p) => [p.id, asWallPost(p)]));
  // A pinned post that has since been removed simply drops off the wall.
  const out: ViewCard[] = [];
  for (const c of cards) {
    if (c.kind === "prompt") out.push({ ...c, post: null });
    else { const post = byId.get(c.post_id as string); if (post) out.push({ ...c, post }); }
  }
  return out;
}

/** What anyone with the link may see: the look of the wall and its cards, never any message. */
export const getPublicPrivateWall = cache(async (slug: string): Promise<PublicPrivateWall | null> => {
  if (!/^[a-z0-9_]{3,30}$/i.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_private_wall", { p_slug: slug });
  if (!data) return null;
  const w = data as { slug: string; brick: BrickKey; bg?: string | null; accepting: boolean; owner: WallOwner; cards: PCard[] };
  return { slug: w.slug, brick: w.brick, bg: bgUrl(supabase, w.bg), accepting: w.accepting, owner: w.owner, cards: await attachPosts(w.cards) };
});

export type OwnerWall = { id: string; slug: string; n: number; brick: BrickKey; bg: string | null; isActive: boolean; cards: ViewCard[] };
export type WallTab = { id: string; slug: string; n: number };
/** The signed-in member's walls (up to two), and the one asked for by slug, or the first. Null until they create one. */
export async function getOwnerWalls(userId: string, slug?: string): Promise<{ tabs: WallTab[]; wall: OwnerWall } | null> {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("private_walls").select("id, slug, n, brick, bg_path, is_active").eq("owner_id", userId).order("n");
  if (!rows?.length) return null;
  const w = rows.find((r) => r.slug === slug) ?? rows[0];
  const { data: cards } = await supabase.from("wall_cards").select("id, kind, title, icon, color, post_id").eq("wall_id", w.id).eq("kind", "post").order("created_at", { ascending: false });
  const { data: counts } = await supabase.rpc("private_wall_counts");
  const byCard = new Map(((counts ?? []) as { card_id: string; total: number; unread: number }[]).map((c) => [c.card_id, c]));
  const withCounts = (await attachPosts((cards ?? []) as PCard[])).map((c) => ({ ...c, total: Number(byCard.get(c.id)?.total ?? 0), unread: Number(byCard.get(c.id)?.unread ?? 0) }));
  return {
    tabs: rows.map((r) => ({ id: r.id as string, slug: r.slug as string, n: r.n as number })),
    wall: {
      id: w.id as string, slug: w.slug as string, n: w.n as number, brick: w.brick as BrickKey, bg: w.brick === "custom" ? bgUrl(supabase, w.bg_path as string | null) : null,
      isActive: w.is_active as boolean, cards: withCounts,
    },
  };
}

export type Message = { id: string; body: string; created_at: string; isNew: boolean; reply: string | null };
export type InboxNote = { card: PCard; kind: "ask_me" | "hidden_thought" | "picture" | "prompt_response" | "false_wall" | "prompt"; heading: string; sub: string | null; slug: string; brick: BrickKey };
/** One wall note and every message sent to it, newest first. Only its owner can read this (row-level security). */
export async function getInbox(cardId: string): Promise<{ note: InboxNote; messages: Message[] } | null> {
  const supabase = await createClient();
  const { data: card } = await supabase.from("wall_cards").select("id, kind, title, icon, color, post_id, owner_id, wall_id").eq("id", cardId).maybeSingle();
  if (!card) return null;
  const [{ data: w }, { data: rows }, { data: post }] = await Promise.all([
    supabase.from("private_walls").select("slug, brick").eq("id", card.wall_id).maybeSingle(),
    supabase.from("submissions").select("id, body, created_at, read_at, reply").eq("card_id", cardId).order("created_at", { ascending: false }).limit(300),
    card.post_id ? supabase.from("posts").select("type, title, clue, body").eq("id", card.post_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!w) return null;
  const type = (post?.type ?? "prompt") as InboxNote["kind"];
  const pick = typeof post?.body === "string" && post.body.startsWith(PICK_MARK);
  const heading = (pick ? post?.title || "Pick a number" : type === "hidden_thought" ? post?.clue : post?.title ?? post?.clue) ?? (card.title as string | null) ?? "Your wall";
  const sub = type === "ask_me" && !pick ? (post?.body as string | null) ?? null : null;
  return {
    note: { card: card as PCard, kind: type, heading, sub, slug: w.slug as string, brick: w.brick as BrickKey },
    messages: ((rows ?? []) as { id: string; body: string; created_at: string; read_at: string | null; reply: string | null }[]).map((r) => ({ id: r.id, body: r.body, created_at: r.created_at, isNew: !r.read_at, reply: r.reply })),
  };
}

/** Public address of an uploaded wall background. */
function bgUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null | undefined): string | null {
  return path ? supabase.storage.from("wall-backgrounds").getPublicUrl(path).data.publicUrl : null;
}
