"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { WALL_ICON_KEYS, isBrick } from "@/lib/constants";
import { isUuid } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

const OK: ActionResult = { ok: true };
const fail = (e: unknown): ActionResult => ({ ok: false, error: friendlyError(e) });

export async function createPrivateWall(brick: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_private_wall", { p_brick: isBrick(brick) ? brick : "classic" });
  if (error) return fail(error);
  revalidatePath("/private");
  return OK;
}

export async function setBrick(brick: string): Promise<ActionResult> {
  if (!isBrick(brick)) return fail("invalid_input");
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail("not_authenticated");
  const { error } = await supabase.from("private_walls").update({ brick, updated_at: new Date().toISOString() }).eq("owner_id", u.user.id);
  if (error) return fail(error);
  revalidatePath("/private");
  return OK;
}

export async function setWallActive(active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail("not_authenticated");
  const { error } = await supabase.from("private_walls").update({ is_active: active, updated_at: new Date().toISOString() }).eq("owner_id", u.user.id);
  if (error) return fail(error);
  revalidatePath("/private");
  return OK;
}

export async function addPromptCard(title: string, icon: string, color: string): Promise<ActionResult> {
  if (!(WALL_ICON_KEYS as readonly string[]).includes(icon)) return fail("invalid_input");
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_prompt_card", { p_title: title, p_icon: icon, p_color: color });
  if (error) return fail(error);
  revalidatePath("/private");
  return OK;
}

export async function addPostCard(postId: string): Promise<ActionResult> {
  if (!isUuid(postId)) return fail("not_found");
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_post_card", { p_post: postId });
  if (error) return fail(error);
  revalidatePath("/private");
  return OK;
}

export async function removeCard(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("not_found");
  const supabase = await createClient();
  const { error } = await supabase.from("wall_cards").delete().eq("id", id);
  if (error) return fail(error);
  revalidatePath("/private");
  return OK;
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("not_found");
  const supabase = await createClient();
  const { error } = await supabase.from("submissions").delete().eq("id", id);
  if (error) return fail(error);
  revalidatePath("/private");
  return OK;
}

/** Opening a card's inbox marks everything in it as seen, which clears the "new" count on the wall. */
export async function markCardRead(cardId: string): Promise<void> {
  if (!isUuid(cardId)) return;
  const supabase = await createClient();
  await supabase.from("submissions").update({ read_at: new Date().toISOString() }).eq("card_id", cardId).is("read_at", null);
  revalidatePath("/private");
}

/**
 * A visitor leaves an anonymous message on a prompt card. No account and no tracking: only a salted hash of the
 * network address is used, and only to slow down spam.
 */
export async function sendToCard(cardId: string, body: string): Promise<ActionResult> {
  if (!isUuid(cardId)) return fail("not_found");
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const key = createHash("sha256").update(`${process.env.GUEST_SALT ?? "false-walls"}:${ip}`).digest("hex");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_to_card", { p_card: cardId, p_body: body, p_key: key });
  if (error) return fail(error);
  return OK;
}

