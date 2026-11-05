import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectArt, ProgressBar, pct } from "@/components/adventure/Bits";
import { NewTeamButton, PlayPanel, RiddleCard } from "@/components/adventure/Client";
import { requireMember } from "@/lib/data/session";
import { getCollection, getFriends } from "@/lib/data/adventure";
import { AREAS } from "@/lib/constants";
import type { AreaSlug } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { return { title: `${(await params).slug.replace(/-/g, " ")} adventure` }; }

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireMember(`/adventure/c/${slug}`);
  const [c, friends] = await Promise.all([getCollection(slug), getFriends()]);
  if (!c) notFound();
  const found = c.objects.filter((o) => o.found).length, total = c.objects.length;
  const p = c.profession;
  const open = c.objects.filter((o) => !o.found && o.mission && !(o.mission.kind !== "direct" && o.mission.solved));
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 pb-8 pt-4">
      <Link href="/adventure" className="text-sm text-chalk-dim underline">Adventure</Link>
      <header className="rounded-3xl p-5" style={{ background: `linear-gradient(135deg, ${p.color}44, #1d1740 70%)`, boxShadow: `inset 0 0 0 2px ${p.color}55` }}>
        <div className="flex items-center gap-4">
          <span aria-hidden className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-night/60 text-5xl">{p.emoji}</span>
          <div className="min-w-0"><h1 className="display text-2xl uppercase leading-tight">{p.name} adventure</h1>{p.blurb && <p className="text-sm text-chalk-dim">{p.blurb}</p>}</div>
        </div>
        <p className="mt-4 display text-lg">{found}/{total} objects collected</p>
        <div className="mt-2"><ProgressBar value={found} total={total} color={p.color} label={`${p.name} progress`} /></div>
        <p className="mt-1 text-sm font-bold" style={{ color: p.color }}>{pct(found, total)}% completed</p>
        {p.ends_at && <p className="mt-2 text-xs text-chalk-dim">Limited time: ends {new Date(p.ends_at).toLocaleDateString()}</p>}
      </header>

      <PlayPanel slug={p.slug} playing={c.playing} activeTeam={c.active_team} teams={c.teams} color={p.color} />

      <section aria-labelledby="objects">
        <h2 id="objects" className="display mb-3 text-xl uppercase">Objects</h2>
        <ul className="grid grid-cols-3 gap-3">
          {c.objects.map((o) => (
            <li key={o.id} className="flex flex-col items-center gap-1.5 rounded-2xl bg-night-2 p-3 text-center">
              <ObjectArt found={o.found} emoji={o.emoji} image_path={o.image_path} rare={o.rarity === "rare"} size={60} silhouette={o.mission?.silhouette} />
              <p className="text-sm font-bold leading-tight">{o.found ? o.name : o.unlocked && o.name ? o.name : "???"}</p>
              <p className="text-[11px] text-chalk-dim">{o.found ? (o.via_team ? "Found with team" : "Found solo") : o.unlocked ? "On the Wall" : o.mission ? "Solve the riddle" : "Hidden"}{o.rarity === "rare" ? " · Rare" : ""}</p>
              {o.found && o.area && <p className="text-[11px]" style={{ color: AREAS[o.area as AreaSlug]?.accent }}>{AREAS[o.area as AreaSlug]?.name}</p>}
            </li>
          ))}
        </ul>
      </section>

      {open.length > 0 && (
        <section aria-labelledby="clues" className="space-y-3">
          <h2 id="clues" className="display text-xl uppercase">Missions</h2>
          {open.map((o) => o.mission && <RiddleCard key={o.mission.riddle_id} riddleId={o.mission.riddle_id} kind={o.mission.kind} prompt={o.mission.prompt} hint={o.mission.hint} difficulty={o.mission.difficulty}
            silhouette={o.mission.silhouette} solved={o.mission.solved} slug={p.slug} color={p.color} objectName={o.name} objectEmoji={o.emoji} compact />)}
        </section>
      )}

      <section aria-labelledby="team" className="space-y-3">
        <h2 id="team" className="display text-xl uppercase">Play with friends</h2>
        <p className="text-sm text-chalk-dim">Invite friends to this collection. Finds are shared, and everyone sees who found what.</p>
        <NewTeamButton slug={p.slug} professionName={p.name} friends={friends ?? []} />
      </section>
    </main>
  );
}
