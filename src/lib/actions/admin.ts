"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaff } from "@/lib/data/session";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

// Each action re-checks the caller on the server, and the database functions check again.

export async function modRemove(type: string, id: string, reportId: string | null, note: string): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_remove_content", { p_type: type, p_id: id, p_report: reportId, p_note: note });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function modRestore(type: string, id: string, note: string): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_restore_content", { p_type: type, p_id: id, p_note: note });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function modDismiss(reportId: string, note: string): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_dismiss_report", { p_report: reportId, p_note: note });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function modSetUserStatus(userId: string, status: "active" | "suspended", note: string): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_set_user_status", { p_user: userId, p_status: status, p_note: note });
  if (error) return { ok: false, error: friendlyError(error) };
  // Also block sign-in at the auth layer when a service key is configured.
  const service = createServiceClient();
  if (service) await service.auth.admin.updateUserById(userId, { ban_duration: status === "suspended" ? "876000h" : "none" });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function modSetRole(userId: string, role: "user" | "moderator" | "admin"): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_set_role", { p_user: userId, p_role: role });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function modSuppressTrending(postId: string, suppressed: boolean): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_suppress_trending", { p_post: postId, p_suppressed: suppressed });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function modLookupSender(questionId: string): Promise<ActionResult<{ sender: { id: string; username: string; status: string } }>> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mod_get_question_sender", { p_question: questionId });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, sender: data as { id: string; username: string; status: string } };
}

export async function adminSavePrompt(id: string | null, text: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_prompt", { p_id: id, p_text: text, p_active: active });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function adminSaveBadge(b: { slug: string; name: string; description: string; rule: string; threshold: number; active: boolean }): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  if (!/^[a-z_]{3,32}$/.test(b.slug) || !(b.threshold >= 1 && b.threshold <= 1000)) return { ok: false, error: friendlyError("invalid_input") };
  const { error } = await supabase.rpc("admin_upsert_badge", { p_slug: b.slug, p_name: b.name, p_description: b.description, p_rule: b.rule, p_threshold: b.threshold, p_active: b.active });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
