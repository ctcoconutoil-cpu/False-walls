import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { POST_SELECT, hydratePosts } from "@/lib/data/posts";
import { Avatar, Empty, LinkButton } from "@/components/ui";
import { WallItem } from "@/components/maze/WallItem";
import { ProfileActions } from "@/components/profile/ProfileActions";
import { signOut } from "@/lib/actions/auth";
import type { AuthorLite, Post } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

type Pub = AuthorLite & { created_at: string; is_self: boolean; suspended: boolean; is_private: boolean; bio: string | null; interests: string[]; allow_follows: boolean; show_walls: boolean; show_answers: boolean; show_pictures: boolean; following: boolean; followers_count: number; following_count: number; stats: Record<string, number> | null; badges: { slug: string; name: string; description: string; earned_at: string }[] };

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: username === "me" ? "Your profile" : `@${username}` };
}

const STAT_LABELS: [string, string][] = [["walls_explored", "Walls explored"], ["false_walls_discovered", "False Walls discovered"], ["questions_answered", "Questions answered"], ["conversations", "Conversations joined"], ["chains_explored", "Wall Chains explored"], ["areas_visited", "Areas visited"]];

export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getViewer();
  if (username === "me") redirect(viewer.profile ? `/profile/${viewer.profile.username}` : "/login?next=/profile/me");
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_profile_public", { p_username: username });
  if (!data) notFound();
  const p = data as Pub;
  const self = p.is_self;

  const [wallsRes, picsRes, answersRes, allBadges] = await Promise.all([
    p.show_walls ? supabase.from("posts").select(POST_SELECT).eq("author_id", p.id).eq("status", "active").neq("type", "picture").order("created_at", { ascending: false }).limit(24) : Promise.resolve({ data: [] }),
    p.show_pictures ? supabase.from("posts").select(POST_SELECT).eq("author_id", p.id).eq("status", "active").eq("type", "picture").order("created_at", { ascending: false }).limit(24) : Promise.resolve({ data: [] }),
    p.show_answers ? supabase.from("answers").select("id, question_text, body, created_at, post_id").eq("author_id", p.id).eq("is_public", true).eq("status", "active").order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    self ? supabase.from("badges").select("slug,name,description,threshold,rule").eq("active", true).order("sort_order") : Promise.resolve({ data: [] }),
  ]);
  const walls = await hydratePosts(supabase, (wallsRes.data ?? []) as never);
  const pics = await hydratePosts(supabase, (picsRes.data ?? []) as never);
  const answers = (answersRes.data ?? []) as { id: string; question_text: string; body: string; created_at: string; post_id: string }[];
  const earned = new Set(p.badges.map((b) => b.slug));
  const progressFor = (rule: string): number | null => !p.stats ? null : rule === "walls_explored" ? p.stats.walls_explored : rule === "reveals" ? p.stats.false_walls_discovered : rule === "areas_visited" ? p.stats.areas_visited : null;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar user={p} size={96} ring={p.avatar_color} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl">{p.display_name || p.username}</h1>
          <p className="text-chalk-dim">@{p.username} · joined {timeAgo(p.created_at)}</p>
          {p.suspended && <p className="mt-1 rounded bg-danger/20 px-2 py-1 text-sm text-[#ffb4b4]">This account is suspended.</p>}
          {p.allow_follows && <p className="mt-1 text-sm text-chalk-dim"><strong className="text-chalk">{p.followers_count}</strong> followers · <strong className="text-chalk">{p.following_count}</strong> following</p>}
        </div>
      </header>
      {p.bio && <p className="whitespace-pre-wrap text-lg">{p.bio}</p>}
      {p.is_private && !self && <p className="rounded-xl bg-night-2 p-3 text-sm text-chalk-dim">This profile is private. Bio and interests are hidden.</p>}
      {p.interests.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="Interests">{p.interests.map((i) => <li key={i} className="rounded-full bg-night-3 px-3 py-1 text-sm">{i}</li>)}</ul>}
      {self ? (
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/settings" tone="mustard" size="sm">Edit profile and privacy</LinkButton>
          <LinkButton href="/saved" tone="ghost" size="sm">Saved walls</LinkButton>
          <form action={signOut}><button className="btn-press min-h-11 rounded-xl bg-night-3 px-4 py-1.5 text-sm font-black shadow-[0_4px_0_#0d0b1f]">Log out</button></form>
        </div>
      ) : <ProfileActions userId={p.id} following={p.following} allowFollows={p.allow_follows} loggedIn={!!viewer.profile} />}

      {p.stats && (
        <section aria-labelledby="disc" className="space-y-3">
          <h2 id="disc" className="text-2xl">Discovery</h2>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STAT_LABELS.map(([k, l]) => <div key={k} className="rounded-2xl bg-night-2 p-3"><dd className="display text-3xl text-mustard">{p.stats![k] ?? 0}</dd><dt className="text-xs text-chalk-dim">{l}</dt></div>)}
          </dl>
        </section>
      )}

      {(p.badges.length > 0 || self) && (
        <section aria-labelledby="badges" className="space-y-3">
          <h2 id="badges" className="text-2xl">Badges</h2>
          {self && (allBadges.data ?? []).length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {(allBadges.data as { slug: string; name: string; description: string; threshold: number; rule: string }[]).map((b) => {
                const got = earned.has(b.slug); const prog = progressFor(b.rule);
                return (
                  <li key={b.slug} className={`flex items-center gap-3 rounded-2xl p-3 ${got ? "bg-night-3" : "bg-night-2 opacity-70"}`}>
                    <span aria-hidden className={`display grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl ${got ? "bg-mustard text-[#2c1e02]" : "bg-night text-chalk-dim"}`}>{got ? "★" : "☆"}</span>
                    <span><span className="display block uppercase">{b.name}</span><span className="block text-xs text-chalk-dim">{b.description}{!got && prog !== null ? ` (${Math.min(prog, b.threshold)}/${b.threshold})` : ""}</span></span>
                  </li>);
              })}
            </ul>
          ) : (
            <ul className="flex flex-wrap gap-2">{p.badges.map((b) => <li key={b.slug} title={b.description} className="display rounded-full bg-mustard px-3 py-1.5 text-sm uppercase text-[#2c1e02]">★ {b.name}</li>)}</ul>
          )}
        </section>
      )}

      {p.show_walls && (
        <section aria-labelledby="walls" className="space-y-3">
          <h2 id="walls" className="text-2xl">Walls</h2>
          {walls.length === 0 ? <Empty title="No walls yet" action={self ? <Link className="font-bold text-mustard underline" href="/create">Put something on the wall</Link> : undefined} /> : <Grid posts={walls} />}
        </section>
      )}
      {p.show_pictures && pics.length > 0 && <section aria-labelledby="pics" className="space-y-3"><h2 id="pics" className="text-2xl">Picture posts</h2><Grid posts={pics} /></section>}
      {p.show_answers && answers.length > 0 && (
        <section aria-labelledby="ans" className="space-y-3">
          <h2 id="ans" className="text-2xl">Public answers</h2>
          <ul className="space-y-2">{answers.map((a) => <li key={a.id}><Link href={`/post/${a.post_id}`} className="block rounded-2xl bg-night-2 p-3"><span className="block text-sm text-chalk-dim">{a.question_text}</span><span className="mt-1 block font-semibold">{a.body}</span></Link></li>)}</ul>
        </section>
      )}
    </main>
  );
}

function Grid({ posts }: { posts: Post[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {posts.map((post) => <li key={post.id} className="h-40"><Link href={`/post/${post.id}`} className="block h-full" aria-label={post.title ?? post.clue ?? post.body ?? "Open wall"}><WallItem post={post} compact /></Link></li>)}
    </ul>
  );
}
