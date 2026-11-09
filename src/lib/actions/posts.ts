"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/claims";
import { friendlyError } from "@/lib/errors";
import { processImage, moderateImage } from "@/lib/images";
import { LIMITS, FALSE_WALL_KINDS, CLUE_STYLES, WALL_COLORS, WALL_ICON_KEYS, MAX_WALL_WORDS, wordCount } from "@/lib/constants";
import type { ActionResult, FalseWallKind, PostType, ReactionKind } from "@/lib/types";
import { isUuid } from "@/lib/utils";

const TYPES: PostType[] = ["ask_me", "hidden_thought", "picture", "prompt_response", "false_wall"];
const text = (fd: FormData, k: string, max: number) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max + 1) : null;
};

export async function createPost(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const auth = { user: await getAuthUser(supabase) };
  if (!auth.user) return { ok: false, error: friendlyError("not_authenticated") };

  const type = String(fd.get("type")) as PostType;
  if (!TYPES.includes(type)) return { ok: false, error: friendlyError("invalid_input") };
  const title = text(fd, "title", LIMITS.title), body = text(fd, "body", LIMITS.body), clue = text(fd, "clue", LIMITS.clue);
  const hidden = text(fd, "hidden_text", LIMITS.hidden);
  if ((title?.length ?? 0) > LIMITS.title || (body?.length ?? 0) > LIMITS.body || (clue?.length ?? 0) > LIMITS.clue || (hidden?.length ?? 0) > LIMITS.hidden)
    return { ok: false, error: friendlyError("invalid_length") };

  // Every post shows one to three words and a big icon on the wall.
  // Posts for a private wall are drawn as notes, so they carry no wall words or icon.
  const wallId = fd.get("wall");
  const forWall = typeof wallId === "string" && isUuid(wallId);
  const wallWords = wordCount(title);
  const icon = String(fd.get("wall_icon") ?? "");
  if (!forWall && type !== "picture") {
    if (wallWords < 1 || wallWords > MAX_WALL_WORDS) return { ok: false, error: `Use one to ${MAX_WALL_WORDS} words for what shows on the wall.` };
    if (!(WALL_ICON_KEYS as readonly string[]).includes(icon)) return { ok: false, error: "Pick an icon for your post." };
  }

  const kind = (fd.get("false_wall_kind") as FalseWallKind | null) || null;
  const style = (fd.get("clue_style") as string | null) || null;
  const color = String(fd.get("wall_color") || "coral");
  if (kind && !(kind in FALSE_WALL_KINDS)) return { ok: false, error: friendlyError("invalid_input") };
  if (style && !(style in CLUE_STYLES)) return { ok: false, error: friendlyError("invalid_input") };
  if (!(color in WALL_COLORS)) return { ok: false, error: friendlyError("invalid_input") };
  const promptId = String(fd.get("prompt_id") ?? "");
  const chainParent = String(fd.get("chain_parent") ?? "");
  const chainAnswer = String(fd.get("chain_answer") ?? "");

  let payload: Record<string, unknown> | null = null;
  if (type === "false_wall" && kind === "poll") {
    const options = fd.getAll("poll_option").map((o) => String(o).trim()).filter(Boolean).slice(0, 4);
    if (options.some((o) => o.length > 60)) return { ok: false, error: friendlyError("invalid_length") };
    payload = { options, question: text(fd, "poll_question", 140) };
  }

  const pid = crypto.randomUUID();
  const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0).slice(0, LIMITS.images + 1);
  if (files.length > LIMITS.images) return { ok: false, error: friendlyError("too_many_images") };
  const alt = text(fd, "alt", 200);
  const uploaded: string[] = [];
  const media: { path: string; width: number; height: number; bytes: number; alt: string | null }[] = [];
  try {
    for (const [i, f] of files.entries()) {
      const img = await processImage(f, "post");
      if ((await moderateImage(img.buffer)) === "flagged") throw new Error("image_flagged");
      const path = `${auth.user.id}/${pid}/${i}.webp`;
      const { error } = await supabase.storage.from("post-media").upload(path, img.buffer, { contentType: "image/webp" });
      if (error) throw new Error("invalid_image");
      uploaded.push(path);
      media.push({ path, width: img.width, height: img.height, bytes: img.bytes, alt });
    }
  } catch (e) {
    if (uploaded.length) await supabase.storage.from("post-media").remove(uploaded);
    return { ok: false, error: friendlyError(e instanceof Error ? e.message : "") };
  }

  const { data, error } = await supabase.rpc("create_post", {
    p_type: type, p_title: title, p_body: body, p_clue: clue, p_prompt_id: isUuid(promptId) ? promptId : null,
    p_false_wall_kind: kind, p_clue_style: style, p_wall_color: color,
    p_visibility: fd.get("visibility") === "followers" ? "followers" : "public",
    p_reveal_mode: fd.get("reveal_mode") === "followers" ? "followers" : "anyone",
    p_allow_anonymous: fd.get("allow_anonymous") !== "off", p_allow_replies: fd.get("allow_replies") !== "off", p_allow_chains: fd.get("allow_chains") !== "off",
    p_area_slug: (fd.get("area_slug") as string) || null, p_hidden_text: hidden, p_payload: payload, p_media: media,
    p_chain_parent: isUuid(chainParent) ? chainParent : null, p_chain_answer: isUuid(chainAnswer) ? chainAnswer : null, p_id: pid,
  });
  if (error) {
    if (uploaded.length) await supabase.storage.from("post-media").remove(uploaded);
    return { ok: false, error: friendlyError(error) };
  }
  if (!forWall && icon) await supabase.rpc("set_post_icon", { p_id: pid, p_icon: icon });
  const frame = Number(fd.get("frame"));
  if (type === "picture" && !forWall && Number.isInteger(frame) && frame >= 0 && frame <= 2) await supabase.rpc("set_post_frame", { p_id: pid, p_frame: frame });
  // Ask Me, Hidden Thought and Random Prompt posts hang on the author's private wall instead of the public Wall.
  if (forWall) {
    const pin = await supabase.rpc("pin_to_private_wall", { p_post: pid, p_wall: wallId as string });
    if (pin.error) return { ok: false, error: friendlyError(pin.error) };
    revalidatePath("/private");
  }
  revalidatePath("/wall", "layout");
  revalidatePath("/profile", "layout");
  return { ok: true, id: data as string };
}

export async function editPost(id: string, v: { title: string; body: string; clue: string; hidden: string | null }): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_post", { p_id: id, p_title: v.title, p_body: v.body, p_clue: v.clue, p_hidden_text: v.hidden });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/post/${id}`);
  revalidatePath("/wall", "layout");
  return { ok: true };
}

export async function deletePost(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: media } = await supabase.from("post_media").select("storage_path").eq("post_id", id);
  const { error, count } = await supabase.from("posts").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: friendlyError(error ?? "forbidden") };
  const paths = (media ?? []).map((m) => m.storage_path as string);
  if (paths.length) await supabase.storage.from("post-media").remove(paths);
  revalidatePath("/wall", "layout");
  revalidatePath("/profile", "layout");
  return { ok: true };
}

export async function deleteMedia(postId: string, storagePath: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("post_media").delete({ count: "exact" }).eq("storage_path", storagePath).eq("post_id", postId);
  if (error || !count) return { ok: false, error: friendlyError(error ?? "forbidden") };
  await supabase.storage.from("post-media").remove([storagePath]);
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export type Revealed = { hidden_text: string | null; payload: { options?: string[]; question?: string | null }; media: { id: string; storage_path: string; width: number | null; height: number | null; alt_text: string | null; url?: string }[] };

export async function revealPost(id: string): Promise<ActionResult<{ data: Revealed; poll: { mine: number | null; counts: number[] } | null }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_post", { p_id: id });
  if (error) return { ok: false, error: friendlyError(error) };
  const revealed = data as Revealed;
  if (revealed.media.length) {
    const { data: urls } = await supabase.storage.from("post-media").createSignedUrls(revealed.media.map((m) => m.storage_path), 3600);
    revealed.media = revealed.media.map((m) => ({ ...m, url: urls?.find((u) => u.path === m.storage_path)?.signedUrl ?? undefined }));
  }
  let poll: { mine: number | null; counts: number[] } | null = null;
  if (revealed.payload?.options) {
    const { data: p } = await supabase.rpc("poll_results", { p_post: id });
    if (p) poll = p as { mine: number | null; counts: number[] };
  }
  revalidatePath("/profile", "layout");
  return { ok: true, data: revealed, poll };
}

export async function votePoll(id: string, idx: number): Promise<ActionResult<{ poll: { mine: number | null; counts: number[] } }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vote_poll", { p_post: id, p_idx: idx });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, poll: data as { mine: number | null; counts: number[] } };
}

export async function recordDiscovery(kind: "wall_explored" | "area_visited" | "door_found" | "chain_explored", key: string): Promise<ActionResult<{ added: boolean }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_discovery", { p_kind: kind, p_key: key });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, added: data === true };
}

export async function setReaction(type: "post" | "answer" | "reply", id: string, kind: ReactionKind | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_reaction", { p_type: type, p_id: id, p_kind: kind });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

export async function postReply(postId: string, body: string, answerId: string | null, parentId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_reply", { p_post: postId, p_body: body, p_answer: answerId, p_parent: parentId });
  if (error) return { ok: false, error: friendlyError(error) };
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function deleteReply(postId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase.from("replies").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { ok: false, error: friendlyError(error ?? "forbidden") };
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function toggleSave(postId: string, save: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const auth = { user: await getAuthUser(supabase) };
  if (!auth.user) return { ok: false, error: friendlyError("not_authenticated") };
  const { error } = save
    ? await supabase.from("saved_posts").insert({ user_id: auth.user.id, post_id: postId })
    : await supabase.from("saved_posts").delete().eq("user_id", auth.user.id).eq("post_id", postId);
  if (error && !/duplicate/.test(error.message)) return { ok: false, error: friendlyError(error) };
  revalidatePath("/saved");
  return { ok: true };
}

export async function reportContent(type: "user" | "post" | "answer" | "reply" | "question", id: string, reason: string, details: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_content", { p_type: type, p_id: id, p_reason: reason, p_details: details.slice(0, 500) || null });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}
