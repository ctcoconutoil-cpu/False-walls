"use server";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { LIMITS, WALL_COLORS, WALL_ICONS } from "@/lib/constants";
import type { ActionResult } from "@/lib/types";

export type PrivateWallInput = {
  title: string; body: string; template: "pick_number" | null; options: string[];
  color: string; icon: string; anonymous: boolean;
};

/** Creates a private link wall. It is never listed anywhere; people reach it through its share link. */
export async function createPrivateWall(v: PrivateWallInput): Promise<ActionResult<{ id: string; token: string }>> {
  const title = v.title.trim(), body = v.body.trim();
  const options = v.template === "pick_number" ? v.options.map((o) => o.trim()).filter(Boolean) : [];
  if (title.length < 3 || title.length > LIMITS.title || body.length > 300 || options.some((o) => o.length > 80))
    return { ok: false, error: friendlyError("invalid_length") };
  if (!(v.color in WALL_COLORS) || (v.icon && !(WALL_ICONS as readonly string[]).includes(v.icon)) || (v.template && v.template !== "pick_number"))
    return { ok: false, error: friendlyError("invalid_input") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_private_wall", {
    p_title: title, p_body: body || null, p_template: v.template, p_options: v.template ? options : null,
    p_wall_color: v.color, p_wall_icon: v.icon || null, p_allow_anonymous: v.anonymous,
  });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/profile", "layout");
  const r = data as { id: string; token: string };
  return { ok: true, id: r.id, token: r.token };
}

/** Sends a question to a private wall through its share link. */
export async function sendQuestionViaLink(token: string, body: string, anonymous: boolean): Promise<ActionResult> {
  if (!/^[a-f0-9]{32}$/.test(token)) return { ok: false, error: friendlyError("not_found") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_question_via_link", { p_token: token, p_body: body, p_anonymous: anonymous });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/inbox");
  return { ok: true };
}

/** Makes an anonymous question shareable and returns its public token. */
export async function shareQuestion(questionId: string): Promise<ActionResult<{ token: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_question", { p_id: questionId });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, token: data as string };
}

/** Lets someone without an account leave an anonymous question on a private wall. Nothing about them is stored. */
export async function sendGuestQuestion(token: string, body: string): Promise<ActionResult> {
  if (!/^[a-f0-9]{32}$/.test(token)) return { ok: false, error: friendlyError("not_found") };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  // Only a salted hash of the address is sent, and only to rate limit spam.
  const key = createHash("sha256").update(`${process.env.GUEST_SALT ?? "false-walls"}:${ip}`).digest("hex");
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_guest_question", { p_token: token, p_body: body, p_key: key });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}
