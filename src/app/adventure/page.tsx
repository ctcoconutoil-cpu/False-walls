import Link from "next/link";
import { Empty } from "@/components/ui";
import { CollectionCard, LevelCard, SectionTitle, pct, ProgressBar } from "@/components/adventure/Bits";
import { InviteButtons, PauseButton, RiddleCard } from "@/components/adventure/Client";
import { requireMember } from "@/lib/data/session";
import { getOverview } from "@/lib/data/adventure";
import { cx } from "@/lib/utils";

export const metadata = { title: "Adventure" };
const NAV = [["overview", "Overview"], ["missions", "Missions"], ["collections", "Collections"], ["teams", "Teams"], ["progress", "My progress"], ["rewards", "My rewards"], ["book", "Collection book"]] as const;

export default async function AdventureHome() {
  await requireMember("/adventure");
  const o = await getOverview();
  if (!o) return <main className="mx-auto max-w-xl px-4 py-10"><Empty title="Adventure couldn't load" action={<Link href="/adventure" className="underline">Try again</Link>}>Check your connection and try once more.</Empty></main>;
  const active = o.professions.find((p) => p.id === o.active.profession_id) ?? null;
  const pr = o.progress;
  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 pb-8 pt-4">
      <nav aria-label="Adventure sections" className="scrollbar-none sticky top-0 z-30 -mx-4 flex gap-2 overflow-x-auto bg-night/95 px-4 py-2 backdrop-blur">
        {NAV.map(([id, l]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-full bg-night-3 px-3.5 py-2 text-sm font-bold">{l}</a>)}
      </nav>

      <LevelCard progress={pr} />
      <section className="-mt-4 rounded-2xl bg-night-2 p-4">
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p><span aria-hidden>{active.emoji}</span> Hunting: <b>{active.name}</b>{o.active.team_id ? " (with your team)" : ""}. Look for glowing objects on the walls.</p>
            <div className="flex gap-2"><Link href="/wall" className="btn-press display inline-flex min-h-11 items-center rounded-xl bg-coral px-4 font-black text-[#2a0d08]">Open the maze</Link><PauseButton /></div>
          </div>
        ) : (
          <p className="text-chalk-dim"><b className="text-chalk">Adventure is optional.</b> The Wall works exactly as before. Pick a collection below to start hunting for objects hidden in the maze.</p>
        )}
      </section>

      <section aria-labelledby="missions">
        <SectionTitle id="missions">Missions</SectionTitle>
        {o.missions.length === 0 ? <Empty title="No missions right now">New riddles appear as collections open up.</Empty> : (
          <div className="space-y-3">
            {o.missions.map((m) => <RiddleCard key={m.riddle_id} riddleId={m.riddle_id} kind={m.kind} prompt={m.prompt} hint={m.hint} difficulty={m.difficulty} silhouette={m.kind === "silhouette" ? m.emoji : null}
              solved={m.solved} slug={m.slug} color={m.color} title={`${m.profession_emoji} ${m.profession}`} objectName={m.name} objectEmoji={m.emoji} compact />)}
          </div>
        )}
      </section>

      <section aria-labelledby="collections">
        <SectionTitle id="collections">Professional collections</SectionTitle>
        {o.professions.length === 0 ? <Empty title="No collections yet">Check back soon.</Empty> : (
          <div className="grid gap-3 sm:grid-cols-2">{o.professions.map((p) => <CollectionCard key={p.id} p={p} active={p.id === o.active.profession_id} />)}</div>
        )}
      </section>

      <section aria-labelledby="teams">
        <SectionTitle id="teams">Team adventures</SectionTitle>
        {o.invites.length > 0 && (
          <ul className="mb-3 space-y-2">
            {o.invites.map((i) => (
              <li key={i.team_id} className="space-y-2 rounded-2xl border-2 border-violet bg-night-2 p-3.5">
                <p><span aria-hidden>{i.emoji}</span> <b>{i.from ? `@${i.from}` : "A friend"}</b> invited you to <b>{i.name}</b> ({i.profession}).</p>
                <InviteButtons teamId={i.team_id} />
              </li>
            ))}
          </ul>
        )}
        {o.teams.length === 0 ? <Empty title="No team challenges">Open any collection and start a team challenge with friends.</Empty> : (
          <ul className="space-y-3">
            {o.teams.map((t) => (
              <li key={t.id}>
                <Link href={`/adventure/team/${t.id}`} className="block rounded-2xl bg-night-2 p-4" style={{ borderLeft: `4px solid ${t.color}` }}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="display truncate text-lg">{t.emoji} {t.name}</p>
                    {t.unread > 0 && <span aria-label={`${t.unread} unread messages`} className="grid h-6 min-w-6 place-items-center rounded-full bg-coral px-1.5 text-xs font-black text-[#2a0d08]">{t.unread}</span>}
                  </div>
                  <p className="text-sm text-chalk-dim">{t.profession} · {t.members} {t.members === 1 ? "player" : "players"}{t.status === "complete" ? " · Complete" : ""}</p>
                  <div className="mt-2"><ProgressBar value={t.found} total={t.total} color={t.color} label={`${t.name} team progress`} /></div>
                  <p className="mt-1 text-sm font-bold" style={{ color: t.color }}>Team progress: {t.found}/{t.total} objects</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="progress">
        <SectionTitle id="progress">My progress</SectionTitle>
        <dl className="grid grid-cols-2 gap-3">
          {([["Level", pr.level], ["Objects collected", pr.objects], ["Collections completed", pr.collections], ["Riddles solved", pr.riddles], ["Team challenges done", pr.team_collections], ["Walls explored", pr.sections]] as const).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-night-2 p-3.5"><dt className="text-xs text-chalk-dim">{k}</dt><dd className="display text-3xl">{v}</dd></div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="rewards">
        <SectionTitle id="rewards" action={<Link href="/adventure/rewards" className="text-sm font-bold text-mustard underline">See all</Link>}>My rewards</SectionTitle>
        <Link href="/adventure/rewards" className={cx("flex items-center gap-4 rounded-2xl bg-night-2 p-4", pr.fire && "fw-fire-glow")}>
          <span aria-hidden className={cx("text-4xl", pr.fire && "fw-flicker")} style={{ filter: pr.fire ? undefined : "grayscale(1) brightness(.5)" }}>🔥</span>
          <span><b>Animated Fire</b><br /><span className="text-sm text-chalk-dim">{pr.fire ? "Unlocked. Use it on any wall's reactions." : `Complete 3 collections to unlock (${Math.min(pr.collections, 3)}/3).`}</span></span>
        </Link>
      </section>

      <section aria-labelledby="book">
        <SectionTitle id="book">My collection book</SectionTitle>
        <Link href="/adventure/book" className="block rounded-2xl bg-night-2 p-4">
          <p className="display text-lg">{pr.objects} {pr.objects === 1 ? "object" : "objects"} in your book</p>
          <p className="text-sm text-chalk-dim">An album of everything you've discovered, by profession.</p>
          <p className="mt-2 text-sm font-bold text-mustard">{pct(pr.collections, Math.max(o.professions.length, 1))}% of collections complete · Open the book</p>
        </Link>
      </section>
    </main>
  );
}
