import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui";
import { ObjectArt, ProgressBar } from "@/components/adventure/Bits";
import { InviteButtons, TeamChat, TeamTools } from "@/components/adventure/Client";
import { requireMember } from "@/lib/data/session";
import { getFriends, getTeam, getTeamMessages } from "@/lib/data/adventure";

export const metadata = { title: "Team adventure" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  await requireMember(`/adventure/team/${id}`);
  const t = await getTeam(id);
  if (!t) notFound();
  const invited = t.me.status === "invited";
  const [messages, friends] = invited ? [[], []] : await Promise.all([getTeamMessages(id), getFriends(id)]);
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 pb-8 pt-4">
      <Link href="/adventure" className="text-sm text-chalk-dim underline">Adventure</Link>
      <header className="rounded-3xl p-5" style={{ background: `linear-gradient(135deg, ${t.profession.color}44, #1d1740 70%)` }}>
        <p className="text-sm text-chalk-dim">{t.profession.emoji} {t.profession.name} adventure{t.team.status === "complete" ? " · Complete 🎉" : ""}</p>
        <h1 className="display text-2xl uppercase leading-tight">{t.team.name}</h1>
        <p className="mt-3 display text-lg">Team progress: {t.found}/{t.total} objects</p>
        <div className="mt-2"><ProgressBar value={t.found} total={t.total} color={t.profession.color} label="Team progress" /></div>
      </header>

      {invited ? (
        <div className="space-y-2 rounded-2xl border-2 border-violet bg-night-2 p-4"><p>You've been invited to this team.</p><InviteButtons teamId={id} /></div>
      ) : (
        <TeamTools teamId={id} friends={friends ?? []} playing={t.playing} slug={t.profession.slug} status={t.team.status} />
      )}

      <section aria-labelledby="members">
        <h2 id="members" className="display mb-3 text-xl uppercase">Team members</h2>
        <ul className="space-y-2">
          {t.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-night-2 p-3">
              <Avatar user={m} size={40} />
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{m.display_name || m.username}{m.id === t.me.id ? " (you)" : ""}{m.id === t.team.owner_id ? " · Owner" : ""}</p><p className="text-sm text-chalk-dim">{m.status === "invited" ? "Invited" : `${m.found} ${m.found === 1 ? "object" : "objects"} found`}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="finds">
        <h2 id="finds" className="display mb-3 text-xl uppercase">Shared collection</h2>
        <ul className="grid grid-cols-3 gap-3">
          {t.objects.map((o) => (
            <li key={o.id} className="flex flex-col items-center gap-1.5 rounded-2xl bg-night-2 p-3 text-center">
              <ObjectArt found={o.found} emoji={o.emoji} image_path={o.image_path} size={56} />
              <p className="text-sm font-bold leading-tight">{o.found ? o.name : "???"}</p>
              <p className="text-[11px] text-chalk-dim">{o.found && o.by ? `Found by @${o.by}` : "Not found yet"}</p>
            </li>
          ))}
        </ul>
      </section>

      {!invited && (
        <section aria-labelledby="chat">
          <h2 id="chat" className="display mb-3 text-xl uppercase">Team chat</h2>
          <TeamChat teamId={id} initial={messages ?? []} />
          <p className="mt-2 text-xs text-chalk-dim">Only your team can see this chat. It is separate from your inbox.</p>
        </section>
      )}
    </main>
  );
}
