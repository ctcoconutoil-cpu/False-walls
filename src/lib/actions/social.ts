"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/claims";
import { friendlyError } from "@/lib/errors";
import type { ActionResult, Settings } from "@/lib/types";

async function me() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  return { supabase, uid: user?.id ?? null };
}

export async function sendQuestion(postId: string, body: string, anonymous: boolean): Promise<ActionResult> {
  const { supabase } = await me();
  const { error } = await supabase.rpc("send_question", { p_post: postId, p_body: body, p_anonymous: anonymous });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/inbox");
  return { ok: true };
}

export async function answerQuestion(questionId: string, body: string, isPublic: boolean): Promise<ActionResult> {
  const { supabase } = await me();
  const { error } = await supabase.rpc("answer_question", { p_question: questionId, p_body: body, p_public: isPublic });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/inbox");
  revalidatePath("/wall", "layout");
  return { ok: true };
}

export async function rejectQuestion(id: string): Promise<ActionResult> {
  const { supabase } = await me();
  const { error } = await supabase.rpc("reject_question", { p_question: id });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/inbox");
  return { ok: true };
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  const { supabase } = await me();
  const { error } = await supabase.rpc("delete_question", { p_question: id });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/inbox");
  return { ok: true };
}

export async function blockQuestionSender(id: string): Promise<ActionResult> {
  const { supabase } = await me();
  const { error } = await supabase.rpc("block_question_sender", { p_question: id });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/inbox");
  return { ok: true };
}

export async function setAnswerPublic(id: string, isPublic: boolean): Promise<ActionResult> {
  const { supabase } = await me();
  const { error } = await supabase.rpc("set_answer_public", { p_answer: id, p_public: isPublic });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/inbox");
  revalidatePath("/post", "layout");
  return { ok: true };
}

export async function deleteAnswer(id: string): Promise<ActionResult> {
  const { supabase } = await me();
  const { error, count } = await supabase.from("answers").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: friendlyError(error ?? "forbidden") };
  revalidatePath("/inbox");
  revalidatePath("/post", "layout");
  return { ok: true };
}

export async function setFollow(targetId: string, follow: boolean): Promise<ActionResult> {
  const { supabase, uid } = await me();
  if (!uid) return { ok: false, error: friendlyError("not_authenticated") };
  const { error } = follow
    ? await supabase.from("follows").insert({ follower_id: uid, followee_id: targetId })
    : await supabase.from("follows").delete().eq("follower_id", uid).eq("followee_id", targetId);
  if (error && !/duplicate/.test(error.message)) return { ok: false, error: friendlyError(error.message.includes("rate_limited") ? "rate_limited" : error) };
  revalidatePath("/profile", "layout");
  return { ok: true };
}

export async function setBlock(targetId: string, kind: "block" | "mute" | null): Promise<ActionResult> {
  const { supabase, uid } = await me();
  if (!uid) return { ok: false, error: friendlyError("not_authenticated") };
  const { error } = kind
    ? await supabase.from("blocks").upsert({ blocker_id: uid, blocked_id: targetId, kind })
    : await supabase.from("blocks").delete().eq("blocker_id", uid).eq("blocked_id", targetId);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const { supabase, uid } = await me();
  if (!uid) return { ok: false, error: friendlyError("not_authenticated") };
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", uid).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/inbox");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateSettings(patch: Partial<Settings>): Promise<ActionResult> {
  const { supabase, uid } = await me();
  if (!uid) return { ok: false, error: friendlyError("not_authenticated") };
  const allowed: (keyof Settings)[] = ["profile_public", "discoverable", "show_stats", "show_badges", "show_walls", "show_answers", "show_pictures", "allow_follows",
    "allow_anonymous_questions", "allow_identified_questions", "notify_questions", "notify_answers", "notify_replies", "notify_reactions", "notify_follows", "notify_chains", "notify_badges", "notify_discoveries"];
  const clean: Record<string, boolean> = {};
  for (const k of allowed) if (typeof patch[k] === "boolean") clean[k] = patch[k] as boolean;
  if (!Object.keys(clean).length) return { ok: false, error: friendlyError("invalid_input") };
  const { error } = await supabase.from("user_settings").update(clean).eq("user_id", uid);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/settings");
  return { ok: true };
}

export async function unblockRef(ref: string): Promise<ActionResult> {
  const { supabase } = await me();
  const { error } = await supabase.rpc("unblock_ref", { p_ref: ref });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
