import { requireAdmin } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { MilestoneForm, ObjectForm, ProfessionDelete, ProfessionForm, type AdminMilestone, type AdminProfession } from "@/components/admin/AdventureAdmin";

export const metadata = { title: "Adventure admin" };

export default async function AdventureAdmin() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adv_admin_list");
  if (error || !data) return <p className="text-chalk-dim">Adventure couldn't be loaded. Run the Adventure migrations first.</p>;
  const d = data as { professions: AdminProfession[]; milestones: AdminMilestone[]; stats: { players: number; finds: number; teams: number } };
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Adventure</h1>
        <p className="text-sm text-chalk-dim">{d.stats.players} players · {d.stats.finds} objects found · {d.stats.teams} teams. Everything here is live: edits show up in the maze straight away.</p>
      </header>

      <section aria-labelledby="profs" className="space-y-3">
        <h2 id="profs" className="text-2xl">Professions and objects</h2>
        {d.professions.map((p) => (
          <details key={p.id} className="rounded-2xl bg-night-2 p-4">
            <summary className="cursor-pointer text-lg font-bold">{p.emoji} {p.name} <span className="text-sm font-normal text-chalk-dim">· {p.objects.length} objects{p.active ? "" : " · inactive"}</span></summary>
            <div className="mt-4 space-y-5">
              <ProfessionForm p={p} />
              <h3 className="text-lg">Objects</h3>
              {p.objects.map((o) => (
                <details key={o.id} className="rounded-xl bg-night p-3">
                  <summary className="cursor-pointer font-bold">{o.emoji} {o.name} <span className="text-xs font-normal text-chalk-dim">· {o.area} · {o.placement.replace("_", " ")}{o.riddle ? ` · ${o.riddle.kind}` : ""}{o.active ? "" : " · inactive"}</span></summary>
                  <div className="mt-3"><ObjectForm professionId={p.id} o={o} /></div>
                </details>
              ))}
              <details className="rounded-xl border-2 border-dashed border-night-3 p-3">
                <summary className="cursor-pointer font-bold">+ Add an object to {p.name}</summary>
                <div className="mt-3"><ObjectForm professionId={p.id} nextSort={p.objects.length} /></div>
              </details>
              <ProfessionDelete id={p.id} />
            </div>
          </details>
        ))}
        <details className="rounded-2xl border-2 border-dashed border-night-3 p-4">
          <summary className="cursor-pointer text-lg font-bold">+ Add a profession</summary>
          <div className="mt-4"><ProfessionForm /></div>
        </details>
      </section>

      <section aria-labelledby="ms" className="space-y-3">
        <h2 id="ms" className="text-2xl">Rewards and milestones</h2>
        <p className="text-sm text-chalk-dim">Each milestone is awarded once, the moment a player reaches it. One of them can unlock the Animated Fire.</p>
        {d.milestones.map((m) => (
          <details key={m.id} className="rounded-2xl bg-night-2 p-4">
            <summary className="cursor-pointer font-bold">{m.icon} {m.title} <span className="text-sm font-normal text-chalk-dim">· {m.metric.replace("_", " ")} ≥ {m.threshold} · {m.reward === "fire" ? "unlocks Fire" : "badge"}{m.active ? "" : " · inactive"}</span></summary>
            <div className="mt-3"><MilestoneForm m={m} /></div>
          </details>
        ))}
        <details className="rounded-2xl border-2 border-dashed border-night-3 p-4"><summary className="cursor-pointer font-bold">+ Add a milestone</summary><div className="mt-3"><MilestoneForm /></div></details>
      </section>
    </div>
  );
}
