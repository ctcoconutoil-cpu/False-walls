import Link from "next/link";
import { requireMember } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { BlockedList, MotionPref, ProfileForm, ToggleGroup, type BlockRow } from "@/components/settings/SettingsForms";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { user, profile, settings } = await requireMember("/settings");
  const supabase = await createClient();
  const [{ data: det }, { data: blocks }] = await Promise.all([
    supabase.from("profile_details").select("bio,interests").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("my_blocks"),
  ]);
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <h1 className="text-3xl">Settings</h1>
      <Section title="Profile"><ProfileForm profile={profile} bio={(det?.bio as string) ?? ""} interests={(det?.interests as string[]) ?? []} /></Section>
      <Section title="Privacy">
        {profile.age_group === "teen" && <p className="rounded-xl bg-night-3 p-3 text-sm">Your account has extra protections: anonymous questions from adults are never delivered to you.</p>}
        <ToggleGroup settings={settings} rows={[
          { key: "profile_public", label: "Public profile", note: "Off hides your bio and interests from everyone but you." },
          { key: "discoverable", label: "Appear in search", note: "Off means people can only find you through your walls." },
          { key: "show_walls", label: "Show my walls on my profile" }, { key: "show_pictures", label: "Show my picture posts on my profile" },
          { key: "show_answers", label: "Show my public answers on my profile" }, { key: "show_stats", label: "Show discovery statistics" }, { key: "show_badges", label: "Show earned badges" },
          { key: "allow_follows", label: "Let people follow me" },
        ]} />
      </Section>
      <Section title="Questions">
        <ToggleGroup settings={settings} rows={[
          { key: "allow_anonymous_questions", label: "Accept anonymous questions", note: "Applies to new questions. You can block, reject or report any sender." },
          { key: "allow_identified_questions", label: "Accept questions with a profile" },
        ]} />
        <p className="text-xs text-chalk-dim">Anonymous means other people can't see who asked. Moderators can look up a sender only when a question is reported for abuse. <Link href="/privacy" className="underline">Read how it works.</Link></p>
      </Section>
      <Section title="Notifications">
        <ToggleGroup settings={settings} rows={[
          { key: "notify_questions", label: "New questions" }, { key: "notify_answers", label: "Answers to my questions" }, { key: "notify_replies", label: "Replies" },
          { key: "notify_reactions", label: "Reactions", note: "Grouped so you don't get one per reaction." }, { key: "notify_follows", label: "New followers" },
          { key: "notify_chains", label: "Wall Chain activity" }, { key: "notify_badges", label: "Badges I earn" }, { key: "notify_discoveries", label: "Relevant discoveries" },
        ]} />
      </Section>
      <Section title="Accessibility"><MotionPref /><p className="text-xs text-chalk-dim">The Wall also has a plain list view and on-screen arrows, available from the top of every maze area.</p></Section>
      <Section title="Blocked and muted"><BlockedList rows={(blocks ?? []) as BlockRow[]} /></Section>
      <Section title="Account">
        <p className="text-sm text-chalk-dim">Signed in as {user.email}. Your email is never shown to anyone.</p>
        <form action={signOut}><Button type="submit" tone="ghost">Log out</Button></form>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-3 rounded-2xl bg-night-2 p-4"><h2 className="text-xl">{title}</h2>{children}</section>; }
