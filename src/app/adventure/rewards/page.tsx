import Link from "next/link";
import { Empty } from "@/components/ui";
import { LevelCard, Medal, ProgressBar } from "@/components/adventure/Bits";
import { requireMember } from "@/lib/data/session";
import { getRewards } from "@/lib/data/adventure";
import { cx } from "@/lib/utils";

export const metadata = { title: "Adventure rewards" };

export default async function Rewards() {
  await requireMember("/adventure/rewards");
  const r = await getRewards();
  if (!r) return <main className="mx-auto max-w-xl px-4 py-10"><Empty title="Rewards couldn't load">Try again in a moment.</Empty></main>;
  const fire = r.items.find((i) => i.reward === "fire");
  const earned = r.items.filter((i) => i.earned && i.reward === "badge"), locked = r.items.filter((i) => !i.earned && i.reward === "badge");
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 pb-8 pt-4">
      <Link href="/adventure" className="text-sm text-chalk-dim underline">Adventure</Link>
      <LevelCard progress={r.progress} />
      {fire && (
        <section aria-labelledby="fire" className={cx("rounded-3xl bg-night-2 p-5", fire.earned && "fw-fire-glow")}>
          <div className="flex items-center gap-4">
            <Medal r={{ ...fire, earned: fire.earned }} size={84} />
            <div className="min-w-0"><h2 id="fire" className="display text-xl">Animated Fire</h2><p className="text-sm text-chalk-dim">{fire.earned ? "Unlocked. Tap the flame under any wall, answer or reply to set it ablaze." : fire.description}</p></div>
          </div>
          {!fire.earned && <div className="mt-3"><ProgressBar value={fire.current} total={fire.threshold} color="#FF6A3D" label="Progress to Animated Fire" /><p className="mt-1 text-xs text-chalk-dim">{fire.current}/{fire.threshold} collections</p></div>}
        </section>
      )}
      <section aria-labelledby="earned">
        <h2 id="earned" className="display mb-3 text-xl uppercase">Earned badges</h2>
        {earned.length === 0 ? <Empty title="No badges yet">Find your first object to earn First Discovery.</Empty> : (
          <ul className="grid grid-cols-3 gap-3">{earned.map((b) => <li key={b.slug} className="flex flex-col items-center gap-2 rounded-2xl bg-night-2 p-3 text-center"><Medal r={b} /><p className="text-sm font-bold leading-tight">{b.title}</p><p className="text-[11px] text-chalk-dim">{b.earned_at ? new Date(b.earned_at).toLocaleDateString() : ""}</p></li>)}</ul>
        )}
      </section>
      <section aria-labelledby="locked">
        <h2 id="locked" className="display mb-3 text-xl uppercase">Locked badges</h2>
        <ul className="grid grid-cols-3 gap-3">
          {locked.map((b) => (
            <li key={b.slug} className="flex flex-col items-center gap-2 rounded-2xl bg-night-2 p-3 text-center">
              <Medal r={b} /><p className="text-sm font-bold leading-tight">{b.title}</p><p className="text-[11px] text-chalk-dim">{b.description}</p>
              <p className="text-[11px] font-bold text-mustard">{b.current}/{b.threshold}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
