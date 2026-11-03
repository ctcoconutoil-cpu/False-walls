import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/claims";
import type { Profile, Settings } from "@/lib/types";

export const getViewer = cache(async () => {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { user: null, profile: null as Profile | null, settings: null as Settings | null };
  // Profile and settings are independent, so fetch them together.
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile) return { user, profile: null as Profile | null, settings: null as Settings | null };
  return { user, profile: profile as Profile, settings: (settings ?? null) as Settings | null };
});

/** Pages for signed-in members with a finished profile. */
export async function requireMember(next = "/wall") {
  const v = await getViewer();
  if (!v.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!v.profile) redirect("/onboarding");
  if (v.profile.status === "suspended") redirect("/suspended");
  return { user: v.user, profile: v.profile, settings: v.settings! };
}

export async function requireStaff() {
  const m = await requireMember("/admin");
  if (m.profile.role !== "moderator" && m.profile.role !== "admin") notFound();
  return m;
}
export async function requireAdmin() {
  const m = await requireMember("/admin");
  if (m.profile.role !== "admin") notFound();
  return m;
}
