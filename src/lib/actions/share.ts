"use server";
import { revalidatePath } from "next/cache";
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
