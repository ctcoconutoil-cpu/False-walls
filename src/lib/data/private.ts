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
  return {
    tabs: rows.map((r) => ({ id: r.id as string, slug: r.slug as string, n: r.n as number })),
    wall: {
      id: w.id as string, slug: w.slug as string, n: w.n as number, brick: w.brick as BrickKey, bg: w.brick === "custom" ? bgUrl(supabase, w.bg_path as string | null) : null,
      isActive: w.is_active as boolean, cards: await attachPosts((cards ?? []) as PCard[]),
    },
  };
}

export type Message = { id: string; body: string; created_at: string; isNew: boolean };
/** One prompt card and every message sent to it, newest first. Only its owner can read this (row-level security). */
export async function getInbox(cardId: string): Promise<{ card: PCard; slug: string; brick: BrickKey; messages: Message[] } | null> {
  const supabase = await createClient();
  const { data: card } = await supabase.from("wall_cards").select("id, kind, title, icon, color, post_id, owner_id").eq("id", cardId).eq("kind", "prompt").maybeSingle();
  if (!card) return null;
  const [{ data: w }, { data: rows }] = await Promise.all([
    supabase.from("private_walls").select("slug, brick").eq("owner_id", card.owner_id).order("n").limit(1).maybeSingle(),
    supabase.from("submissions").select("id, body, created_at, read_at").eq("card_id", cardId).order("created_at", { ascending: false }).limit(300),
  ]);
  if (!w) return null;
  return {
    card: card as PCard, slug: w.slug as string, brick: w.brick as BrickKey,
    messages: ((rows ?? []) as { id: string; body: string; created_at: string; read_at: string | null }[]).map((r) => ({ id: r.id, body: r.body, created_at: r.created_at, isNew: !r.read_at })),
  };
}

/** Public address of an uploaded wall background. */
function bgUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null | undefined): string | null {
  return path ? supabase.storage.from("wall-backgrounds").getPublicUrl(path).data.publicUrl : null;
}
