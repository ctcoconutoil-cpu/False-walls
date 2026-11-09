"use server";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { BG_UPLOAD, isBrick } from "@/lib/constants";
import { moderateImage, processImage } from "@/lib/images";
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

export async function setBrick(wallId: string, brick: string): Promise<ActionResult> {
  if (!isBrick(brick) || !isUuid(wallId)) return fail("invalid_input");
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail("not_authenticated");
  const { error } = await supabase.from("private_walls").update({ brick, updated_at: new Date().toISOString() }).eq("id", wallId).eq("owner_id", u.user.id);
  if (error) return fail(error);
  revalidatePath("/private");
  return OK;
}

export async function setWallActive(wallId: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(wallId)) return fail("invalid_input");
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail("not_authenticated");
  const { error } = await supabase.from("private_walls").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", wallId).eq("owner_id", u.user.id);
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
export async function sendToCard(cardId: string, body: string, slug: string): Promise<ActionResult> {
  if (!isUuid(cardId) || !/^[a-z0-9_]{3,30}$/i.test(slug)) return fail("not_found");
  // One message per visitor per wall. A cookie in their own browser is used, not their network address, so people
  // who share a connection are never blocked because of someone else.
  const jar = await cookies();
  const mark = `fw_sent_${slug.toLowerCase()}`;
  if (jar.get(mark)) return fail("already_sent");
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const key = createHash("sha256").update(`${process.env.GUEST_SALT ?? "false-walls"}:${ip}`).digest("hex");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_to_card", { p_card: cardId, p_body: body, p_key: key });
  if (error) return fail(error);
  jar.set(mark, "1", { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return OK;
}


/** Uses the member's own picture as the wall background. It is cropped to 1080 x 1920 (portrait, 9:16). */
export async function uploadWallBackground(fd: FormData): Promise<ActionResult> {
  const file = fd.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a picture first." };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return fail("not_authenticated");
  const wallId = String(fd.get("wall") ?? "");
  if (!isUuid(wallId)) return fail("no_wall");
  const { data: wall } = await supabase.from("private_walls").select("bg_path").eq("id", wallId).eq("owner_id", u.user.id).maybeSingle();
  if (!wall) return fail("no_wall");
  let buf: Buffer;
  try {
    const checked = await processImage(file, "post"); // type, size and content checks
    if ((await moderateImage(checked.buffer)) === "flagged") return fail("image_flagged");
    buf = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate()
      .resize(BG_UPLOAD.width, BG_UPLOAD.height, { fit: "cover", position: "centre" }).webp({ quality: 78 }).toBuffer();
  } catch (e) { return fail(e instanceof Error ? e.message : "invalid_image"); }
  const path = `${u.user.id}/${Date.now()}.webp`;
  const up = await supabase.storage.from("wall-backgrounds").upload(path, buf, { contentType: "image/webp" });
  if (up.error) return fail("invalid_image");
  const { error } = await supabase.from("private_walls").update({ brick: "custom", bg_path: path, updated_at: new Date().toISOString() }).eq("id", wallId).eq("owner_id", u.user.id);
  if (error) { await supabase.storage.from("wall-backgrounds").remove([path]); return fail(error); }
  if (wall.bg_path) await supabase.storage.from("wall-backgrounds").remove([wall.bg_path as string]);
  revalidatePath("/private");
  return OK;
}
