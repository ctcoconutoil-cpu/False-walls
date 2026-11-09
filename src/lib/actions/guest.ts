"use server";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { isUuid } from "@/lib/utils";
import type { ActionResult, ReactionKind } from "@/lib/types";

export type GuestReply = { id: string; body: string; created_at: string; mine: boolean };
export type GuestState = { counts: Partial<Record<ReactionKind, number>>; mine: ReactionKind | null; replies: GuestReply[] };
const KINDS = ["like", "funny", "surprising", "thought_provoking", "interesting"];
const okKey = (k: string) => typeof k === "string" && k.length >= 16 && k.length <= 80;

/** Reactions and replies on a private-wall post. Anyone can use them, signed in or not. */
export async function loadGuest(postId: string, key: string): Promise<GuestState | null> {
  if (!isUuid(postId) || !okKey(key)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_guest_engagement", { p_post: postId, p_key: key });
  return (data as GuestState | null) ?? null;
}
export async function guestReact(postId: string, kind: string, key: string): Promise<ActionResult> {
  if (!isUuid(postId) || !okKey(key) || !KINDS.includes(kind)) return { ok: false, error: friendlyError("invalid_input") };
  const { error } = await (await createClient()).rpc("guest_react", { p_post: postId, p_kind: kind, p_key: key });
  return error ? { ok: false, error: friendlyError(error) } : { ok: true };
}
export async function guestReply(postId: string, body: string, key: string): Promise<ActionResult> {
  if (!isUuid(postId) || !okKey(key)) return { ok: false, error: friendlyError("invalid_input") };
  const { error } = await (await createClient()).rpc("guest_reply", { p_post: postId, p_body: body, p_key: key });
  return error ? { ok: false, error: friendlyError(error) } : { ok: true };
}
export async function deleteGuestReply(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: friendlyError("not_found") };
  const { error } = await (await createClient()).rpc("delete_guest_reply", { p_id: id });
  return error ? { ok: false, error: friendlyError(error) } : { ok: true };
}
