import Link from "next/link";
import { adventureImage } from "@/lib/adventure/image";
import type { Profession, Progress, RewardItem } from "@/lib/adventure/types";
import { cx } from "@/lib/utils";

/** A collectible's picture: its illustration when found, a "?" (or a black silhouette) while it is still hidden. */
export function ObjectArt({ emoji, image_path, found, size = 56, rare, silhouette }: { emoji?: string | null; image_path?: string | null; found: boolean; size?: number; rare?: boolean; silhouette?: string | null }) {
  const img = found ? adventureImage(image_path) : null;
  return (
    <span aria-hidden className={cx("relative grid shrink-0 place-items-center rounded-2xl", found ? "bg-night-3" : "bg-night")} style={{ width: size, height: size, boxShadow: rare && found ? "0 0 0 2px #7DF9FF, 0 0 14px #7DF9FF88" : undefined }}>
      {found ? (
        img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" width={size * 0.7} height={size * 0.7} loading="lazy" /> : <span style={{ fontSize: size * 0.58, lineHeight: 1 }}>{emoji}</span>
      ) : silhouette ? (
        <span style={{ fontSize: size * 0.58, lineHeight: 1, filter: "brightness(0) opacity(.55)" }}>{silhouette}</span>
      ) : (
        <span className="display text-chalk-dim" style={{ fontSize: size * 0.5 }}>?</span>
      )}
    </span>
  );
}

export function ProgressBar({ value, total, color = "#F2573F", label }: { value: number; total: number; color?: string; label?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label={label ?? "Progress"} className="h-3 w-full overflow-hidden rounded-full bg-night">
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 10px ${color}99` }} />
    </div>
  );
}

export const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0);

export function CollectionCard({ p, active }: { p: Profession; active: boolean }) {
  const done = p.total > 0 && p.found >= p.total;
  return (
    <Link href={`/adventure/c/${p.slug}`} className="group block rounded-2xl bg-night-2 p-4 shadow-[0_4px_0_#0d0b1f] active:translate-y-0.5" style={{ borderTop: `4px solid ${p.color}` }}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl" style={{ background: `${p.color}26`, boxShadow: `inset 0 0 0 2px ${p.color}66` }}>{p.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="display truncate text-lg uppercase leading-tight">{p.name} adventure</p>
          <p className="text-sm text-chalk-dim">{p.found}/{p.total} objects collected</p>
        </div>
        {active && <span className="rounded-full bg-teal px-2 py-0.5 text-[11px] font-black text-[#04201c]">Playing</span>}
      </div>
      <div className="mt-3"><ProgressBar value={p.found} total={p.total} color={p.color} label={`${p.name} progress`} /></div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: p.color }}>{pct(p.found, p.total)}% completed</span>
        <span className="display rounded-lg bg-night-3 px-3 py-1 text-sm">{done ? "Review" : p.found > 0 ? "Continue" : "Start"}</span>
      </div>
    </Link>
  );
}

/** A badge medal. Earned ones are in colour; locked ones are dim with a lock. */
export function Medal({ r, size = 72 }: { r: Pick<RewardItem, "icon" | "color" | "title"> & { earned: boolean; reward?: string }; size?: number }) {
  const fire = r.reward === "fire";
  return (
    <span role="img" aria-label={`${r.title}${r.earned ? "" : " (locked)"}`} className="relative grid place-items-center rounded-full" style={{
      width: size, height: size, background: r.earned ? `radial-gradient(circle at 30% 25%, ${r.color}, ${r.color}88 70%)` : "#1b1733",
      boxShadow: r.earned ? `0 0 0 3px #fff3, 0 0 0 6px ${r.color}66, 0 6px 14px #0008` : "inset 0 0 0 2px #2c2650", opacity: r.earned ? 1 : 0.7 }}>
      <span aria-hidden className={cx(fire && r.earned && "fw-flicker")} style={{ fontSize: size * 0.48, lineHeight: 1, filter: r.earned ? "drop-shadow(0 2px 2px #0006)" : "grayscale(1) brightness(.5)" }}>{r.icon}</span>
      {!r.earned && <span aria-hidden className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-night-3 text-xs">🔒</span>}
    </span>
  );
}

export function LevelCard({ progress }: { progress: Progress }) {
  return (
    <section aria-labelledby="overview" className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg, #3b1f6e, #1d1740 60%, #2a1535)", boxShadow: "inset 0 0 0 2px #ffffff14" }}>
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-coral text-[#2a0d08]"><span className="text-center leading-none"><span className="block text-[10px] font-black uppercase">Level</span><span className="display text-3xl">{progress.level}</span></span></span>
        <div className="min-w-0 flex-1">
          <h2 id="overview" className="display text-2xl leading-tight">Adventure</h2>
          <p className="text-sm text-chalk-dim">{progress.objects} objects found · {progress.collections} collections done</p>
          <div className="mt-2"><ProgressBar value={progress.xp_into} total={progress.xp_per_level} color="#F7B538" label="Progress to the next level" /></div>
          <p className="mt-1 text-xs text-chalk-dim">{progress.xp_per_level - progress.xp_into} points to level {progress.level + 1}</p>
        </div>
      </div>
      {progress.next && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-night/60 p-3">
          <span aria-hidden className="text-2xl">{progress.next.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Next reward: {progress.next.title}</p>
            <ProgressBar value={Math.min(progress.next.current, progress.next.threshold)} total={progress.next.threshold} color="#FF6A3D" label={`Progress to ${progress.next.title}`} />
          </div>
          <span className="text-xs text-chalk-dim">{Math.min(progress.next.current, progress.next.threshold)}/{progress.next.threshold}</span>
        </div>
      )}
    </section>
  );
}

export function SectionTitle({ id, children, action }: { id: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id={id} className="display text-xl uppercase tracking-wide">{children}</h2>
      {action}
    </div>
  );
}
