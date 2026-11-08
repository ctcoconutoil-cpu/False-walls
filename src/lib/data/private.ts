import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPostsByIds } from "@/lib/data/posts";
import type { BrickKey } from "@/lib/constants";
import type { WallPost } from "@/lib/data/wall";
import type { WallColor } from "@/lib/types";

export type PCard = { id: string; kind: "prompt" | "post"; title: string | null; icon: string | null; color: WallColor; post_id: string | null };
/** A card as the wall draws it: the card, the public post it points at (if any), and the owner's numbers. */
export type ViewCard = PCard & { post: WallPost | null; total?: number; unread?: number };
export type WallOwner = { username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null };
export type PublicPrivateWall = { slug: string; brick: BrickKey; accepting: boolean; owner: WallOwner; cards: ViewCard[] };

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
  const w = data as { slug: string; brick: BrickKey; accepting: boolean; owner: WallOwner; cards: PCard[] };
  return { slug: w.slug, brick: w.brick, accepting: w.accepting, owner: w.owner, cards: await attachPosts(w.cards) };
});

export type OwnerWall = { slug: string; brick: BrickKey; isActive: boolean; cards: ViewCard[] };
/** The signed-in member's own wall with a count on every prompt card. Null until they create it. */
export async function getOwnerWall(userId: string): Promise<OwnerWall | null> {
  const supabase = await createClient();
  const { data: w } = await supabase.from("private_walls").select("slug, brick, is_active").eq("owner_id", userId).maybeSingle();
  if (!w) return null;
  const [{ data: cards }, { data: counts }] = await Promise.all([
    supabase.from("wall_cards").select("id, kind, title, icon, color, post_id").eq("owner_id", userId).order("created_at", { ascending: false }),
    supabase.rpc("private_wall_counts"),
  ]);
  const n = new Map(((counts ?? []) as { card_id: string; total: number; unread: number }[]).map((r) => [r.card_id, r]));
  const withPosts = await attachPosts((cards ?? []) as PCard[]);
  return {
    slug: w.slug as string, brick: w.brick as BrickKey, isActive: w.is_active as boolean,
    cards: withPosts.map((c) => ({ ...c, total: Number(n.get(c.id)?.total ?? 0), unread: Number(n.get(c.id)?.unread ?? 0) })),
  };
}

export type Message = { id: string; body: string; created_at: string; isNew: boolean };
/** One prompt card and every message sent to it, newest first. Only its owner can read this (row-level security). */
export async function getInbox(cardId: string): Promise<{ card: PCard; slug: string; brick: BrickKey; messages: Message[] } | null> {
  const supabase = await createClient();
  const { data: card } = await supabase.from("wall_cards").select("id, kind, title, icon, color, post_id, owner_id").eq("id", cardId).eq("kind", "prompt").maybeSingle();
  if (!card) return null;
  const [{ data: w }, { data: rows }] = await Promise.all([
    supabase.from("private_walls").select("slug, brick").eq("owner_id", card.owner_id).maybeSingle(),
    supabase.from("submissions").select("id, body, created_at, read_at").eq("card_id", cardId).order("created_at", { ascending: false }).limit(300),
  ]);
  if (!w) return null;
  return {
    card: card as PCard, slug: w.slug as string, brick: w.brick as BrickKey,
    messages: ((rows ?? []) as { id: string; body: string; created_at: string; read_at: string | null }[]).map((r) => ({ id: r.id, body: r.body, created_at: r.created_at, isNew: !r.read_at })),
  };
}
