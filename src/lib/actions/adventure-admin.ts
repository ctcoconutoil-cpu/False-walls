"use server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data/session";
import { friendlyError } from "@/lib/errors";
import type { FormState } from "@/lib/actions/auth";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => { const v = str(fd, k); return v === "" ? null : Number(v); };
const flag = (fd: FormData, k: string) => fd.get(k) === "on";
const done = (msg: string): FormState => { revalidatePath("/admin/adventure"); revalidatePath("/adventure", "layout"); return { notice: msg }; };
const fail = (e: unknown): FormState => ({ error: typeof e === "object" && e && "message" in e && String((e as { message: string }).message).length < 160 ? friendlyError(e as never) : "That couldn't be saved. Check the fields and try again." });

export async function saveProfession(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_admin_profession", { p: {
    id: str(fd, "id") || null, slug: str(fd, "slug"), name: str(fd, "name"), emoji: str(fd, "emoji"), color: str(fd, "color"), blurb: str(fd, "blurb"),
    sort_order: num(fd, "sort_order") ?? 0, active: flag(fd, "active"), starts_at: str(fd, "starts_at") || null, ends_at: str(fd, "ends_at") || null } });
  return error ? fail(error) : done("Saved.");
}

export async function deleteProfession(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_admin_delete_profession", { p_id: str(fd, "id") });
  return error ? fail(error) : done("Deleted.");
}

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export async function saveObject(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  let image_path: string | null = str(fd, "image_path") || null;
  if (flag(fd, "remove_image")) image_path = null;
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    const ext = TYPES[file.type];
    if (!ext) return { error: "Upload a PNG, JPG, WebP or SVG image." };
    if (file.size > 1024 * 1024) return { error: "Keep illustrations under 1 MB." };
    const path = `objects/${randomUUID()}.${ext}`;
    const up = await supabase.storage.from("adventure").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) return { error: "The picture couldn't be uploaded. Try a smaller file." };
    image_path = path;
  }
  const { error } = await supabase.rpc("adv_admin_object", { o: {
    id: str(fd, "id") || null, profession_id: str(fd, "profession_id"), name: str(fd, "name"), emoji: str(fd, "emoji"), image_path, rarity: str(fd, "rarity"), area: str(fd, "area"),
    section: num(fd, "section") ?? 0, placement: str(fd, "placement"), tile_x: num(fd, "tile_x"), tile_y: num(fd, "tile_y"), visibility: str(fd, "visibility"), per_player: flag(fd, "per_player"),
    sort_order: num(fd, "sort_order") ?? 0, active: flag(fd, "active"),
    riddle_prompt: str(fd, "riddle_prompt"), riddle_kind: str(fd, "riddle_kind"), riddle_hint: str(fd, "riddle_hint"), riddle_difficulty: num(fd, "riddle_difficulty") ?? 1, riddle_answers: str(fd, "riddle_answers") } });
  return error ? fail(error) : done("Saved.");
}

export async function deleteObject(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_admin_delete_object", { p_id: str(fd, "id") });
  return error ? fail(error) : done("Deleted.");
}

export async function saveMilestone(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_admin_milestone", { m: {
    id: str(fd, "id") || null, slug: str(fd, "slug"), title: str(fd, "title"), description: str(fd, "description"), icon: str(fd, "icon"), color: str(fd, "color"),
    metric: str(fd, "metric"), threshold: num(fd, "threshold") ?? 1, reward: str(fd, "reward"), sort_order: num(fd, "sort_order") ?? 0, active: flag(fd, "active") } });
  return error ? fail(error) : done("Saved.");
}

export async function deleteMilestone(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("adv_admin_delete_milestone", { p_id: str(fd, "id") });
  return error ? fail(error) : done("Deleted.");
}
