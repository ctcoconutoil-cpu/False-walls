"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/claims";
import { friendlyError } from "@/lib/errors";
import { processImage, moderateImage } from "@/lib/images";
import { AVATAR_COLORS, AVATAR_STYLES, INTERESTS } from "@/lib/constants";
import { safeNext } from "@/lib/utils";

export type FormState = { error?: string; notice?: string } | null;

const creds = z.object({ email: z.string().trim().email("Enter a valid email address."), password: z.string().min(8, "Use at least 8 characters.").max(72) });

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = creds.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (fd.get("terms") !== "on") return { error: "Agree to the community guidelines and privacy notice to continue." };
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${site}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: error.message.includes("registered") ? "That email already has an account. Log in instead." : "We couldn't create that account. Try again." };
  if (!data.session) return { notice: "Check your email for a confirmation link, then come back to finish your profile." };
  redirect("/onboarding");
}

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = creds.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "That email and password don't match." };
  redirect(safeNext(String(fd.get("next") ?? "")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const onboardingSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, "Usernames are 3 to 20 letters, numbers or underscores."),
  display_name: z.string().trim().max(30, "Nicknames are up to 30 characters.").optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth."),
  avatar_style: z.enum(AVATAR_STYLES),
  avatar_color: z.string().refine((c) => AVATAR_COLORS.includes(c) || /^#[0-9A-Fa-f]{6}$/.test(c)),
  bio: z.string().trim().max(200, "Bios are up to 200 characters.").optional(),
});

export async function completeOnboarding(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const auth = { user: await getAuthUser(supabase) };
  if (!auth.user) redirect("/login");
  const parsed = onboardingSchema.safeParse({
    username: fd.get("username"), display_name: fd.get("display_name") || undefined, birth_date: fd.get("birth_date"),
    avatar_style: fd.get("avatar_style") || "blob", avatar_color: fd.get("avatar_color") || "#F2573F", bio: fd.get("bio") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const interests = fd.getAll("interests").map(String).filter((i) => INTERESTS.includes(i)).slice(0, 8);

  // Check age before uploading anything, so under-13 sign-ups store nothing.
  const birth = new Date(parsed.data.birth_date + "T00:00:00Z");
  const age = (Date.now() - birth.getTime()) / 31557600000;
  if (Number.isNaN(age) || age < 0 || age > 120) return { error: friendlyError("invalid_birth_date") };
  if (age < 13) {
    await supabase.auth.signOut();
    return { error: friendlyError("under_age") };
  }

  let avatarPath: string | null = null;
  const file = fd.get("avatar");
  if (file instanceof File && file.size > 0) {
    try {
      const img = await processImage(file, "avatar");
      if ((await moderateImage(img.buffer)) === "flagged") return { error: friendlyError("image_flagged") };
      avatarPath = `${auth.user.id}/avatar.webp`;
      const { error } = await supabase.storage.from("avatars").upload(avatarPath, img.buffer, { contentType: "image/webp", upsert: true });
      if (error) return { error: friendlyError("invalid_image") };
    } catch (e) {
      return { error: friendlyError(e instanceof Error ? e.message : "") };
    }
  }

  const { error } = await supabase.rpc("complete_onboarding", {
    p_username: parsed.data.username, p_display_name: parsed.data.display_name ?? null,
    p_avatar_style: parsed.data.avatar_style, p_avatar_color: parsed.data.avatar_color,
    p_avatar_url: avatarPath, p_bio: parsed.data.bio ?? null, p_interests: interests, p_birth_date: parsed.data.birth_date,
  });
  if (error) {
    if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
    if (error.message === "under_age") await supabase.auth.signOut();
    return { error: friendlyError(error) };
  }
  revalidatePath("/", "layout");
  redirect("/wall");
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const auth = { user: await getAuthUser(supabase) };
  if (!auth.user) redirect("/login");
  const display = String(fd.get("display_name") ?? "").trim();
  const bio = String(fd.get("bio") ?? "").trim();
  if (display.length > 30 || bio.length > 200) return { error: friendlyError("invalid_length") };
  const style = String(fd.get("avatar_style") ?? "blob");
  const color = String(fd.get("avatar_color") ?? "#F2573F");
  if (!(AVATAR_STYLES as readonly string[]).includes(style) || !/^#[0-9A-Fa-f]{6}$/.test(color)) return { error: friendlyError("invalid_input") };
  const interests = fd.getAll("interests").map(String).filter((i) => INTERESTS.includes(i)).slice(0, 8);

  const update: Record<string, unknown> = { display_name: display || null, avatar_style: style, avatar_color: color };
  const file = fd.get("avatar");
  if (file instanceof File && file.size > 0) {
    try {
      const img = await processImage(file, "avatar");
      if ((await moderateImage(img.buffer)) === "flagged") return { error: friendlyError("image_flagged") };
      const path = `${auth.user.id}/avatar.webp`;
      const { error } = await supabase.storage.from("avatars").upload(path, img.buffer, { contentType: "image/webp", upsert: true });
      if (error) return { error: friendlyError("invalid_image") };
      update.avatar_url = path;
    } catch (e) { return { error: friendlyError(e instanceof Error ? e.message : "") }; }
  }
  if (fd.get("remove_avatar") === "on") {
    await supabase.storage.from("avatars").remove([`${auth.user.id}/avatar.webp`]);
    update.avatar_url = null;
  }
  const { error: pErr } = await supabase.from("profiles").update(update).eq("id", auth.user.id);
  if (pErr) return { error: friendlyError(pErr.message.includes("contact") || pErr.message.includes("check") ? "contact_info" : pErr) };
  const { error: dErr } = await supabase.from("profile_details").update({ bio: bio || null, interests }).eq("user_id", auth.user.id);
  if (dErr) return { error: friendlyError(dErr.message.includes("check") ? "contact_info" : dErr) };
  revalidatePath("/", "layout");
  return { notice: "Profile saved." };
}
