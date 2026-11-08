"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/claims";
import { friendlyError } from "@/lib/errors";
import { processImage, moderateImage } from "@/lib/images";
import { GIST_MAX, isExperienceCategory } from "@/lib/constants";
import type { GistComment } from "@/lib/gist";
import type { ActionResult } from "@/lib/types";
import { isUuid } from "@/lib/utils";

const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === "string" ? v.trim() : ""; };

/** Adds an experience: title, description, category, picture, link, and an optional date and time. */
export async function createExperience(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { ok: false, error: friendlyError("not_authenticated") };
  const title = str(fd, "title"), description = str(fd, "description"), category = str(fd, "category"), url = str(fd, "url"), starts = str(fd, "starts_at");
  if (title.length < 2 || title.length > 80 || description.length < 10 || description.length > 600) return { ok: false, error: friendlyError("invalid_length") };
  if (!isExperienceCategory(category)) return { ok: false, error: "Pick a category." };
  if (!/^https?:\/\/[^\s]{3,500}$/i.test(url)) return { ok: false, error: friendlyError("invalid_url") };
  let startsAt: string | null = null;
  if (starts) {
    // The form sends the viewer's local time already converted to an ISO instant.
    const d = new Date(starts);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "That date doesn't look right." };
    startsAt = d.toISOString();
  }
  const file = fd.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Add a picture." };

  const id = crypto.randomUUID();
  const path = `${user.id}/${id}.webp`;
  try {
    const img = await processImage(file, "post");
    if ((await moderateImage(img.buffer)) === "flagged") throw new Error("image_flagged");
    const { error } = await supabase.storage.from("experiences").upload(path, img.buffer, { contentType: "image/webp" });
    if (error) throw new Error("invalid_image");
  } catch (e) {
    return { ok: false, error: friendlyError(e instanceof Error ? e.message : "") };
  }
  const { error } = await supabase.rpc("create_experience", { p_id: id, p_title: title, p_description: description, p_category: category, p_image: path, p_url: url, p_starts: startsAt });
  if (error) { await supabase.storage.from("experiences").remove([path]); return { ok: false, error: friendlyError(error) }; }
  revalidatePath("/discover");
  return { ok: true, id };
}

export async function deleteExperience(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: friendlyError("invalid_input") };
  const supabase = await createClient();
  const { data } = await supabase.from("experiences").select("image_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("experiences").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  if (data?.image_path) await supabase.storage.from("experiences").remove([data.image_path as string]);
  revalidatePath("/discover");
  return { ok: true };
}

export async function postGist(body: string): Promise<ActionResult> {
  const text = body.trim();
  if (!text || text.length > GIST_MAX) return { ok: false, error: friendlyError("invalid_length") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_gist", { p_body: text });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/discover");
  return { ok: true };
}

export async function reactToGist(id: string, kind: string): Promise<ActionResult<{ my: string | null }>> {
  if (!isUuid(id)) return { ok: false, error: friendlyError("invalid_input") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("react_gist", { p_gist: id, p_kind: kind });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, my: (data as string | null) ?? null };
}

export async function loadGistComments(id: string): Promise<GistComment[]> {
  if (!isUuid(id)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("gist_comment_list", { p_gist: id });
  return (data ?? []) as GistComment[];
}

export async function addGistComment(id: string, body: string): Promise<ActionResult> {
  const text = body.trim();
  if (!isUuid(id) || !text || text.length > 280) return { ok: false, error: friendlyError("invalid_length") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_gist_comment", { p_gist: id, p_body: text });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

export async function deleteGistComment(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: friendlyError("invalid_input") };
  const supabase = await createClient();
  const { error } = await supabase.from("gist_comments").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

export async function deleteGist(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: friendlyError("invalid_input") };
  const supabase = await createClient();
  const { error } = await supabase.from("gists").delete().eq("id", id);
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath("/discover");
  return { ok: true };
}
