"use client";
import { useState, type ReactNode } from "react";

export type BadgeRow = { slug: string; name: string; description: string; got: boolean; progress?: string | null };

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
/** One drawing per badge, so each icon says what the badge is for. */
const ICONS: Record<string, ReactNode> = {
  wall_walker: <g {...P}><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 9.3h18M3 14.6h18M9 4v5.3M15 9.3v5.3M9 14.6V20" /></g>,
  truth_finder: <g {...P}><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5.5 5.5M8 10.5l2 2 3.5-4" /></g>,
  conversation_starter: <g {...P}><path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3.5V14H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M19.5 9.5H20a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1v2.5L16 17.5h-4" /></g>,
  trend_spotter: <g {...P}><path d="M3 17l5.5-5.5 4 4L21 7" /><path d="M15 7h6v6" /></g>,
  experience_host: <g {...P}><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z" /><path d="M14 6v12" strokeDasharray="2 2.4" /></g>,
  gist_teller: <g {...P}><path d="M4 10v4a1 1 0 0 0 1 1h2l8 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M18.5 9.5a4 4 0 0 1 0 5" /></g>,
  wall_owner: <g {...P}><path d="M5 21V8l7-5 7 5v13zM9.5 21v-6.5h5V21" /><circle cx="13" cy="17.5" r=".5" /></g>,
  fan_mail: <g {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6.5L20.5 7" /></g>,
  curator: <g {...P}><path d="M9 4h6l-1 6 3 3v1.5H7V13l3-3z" /><path d="M12 14.5V21" /></g>,
  explorer: <g {...P}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></g>,
};
const Fallback = <g {...P}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></g>;

/**
 * Badges in a dropdown. Opening it shows three at a time; the list scrolls inside its own box,
 * so the profile page itself doesn't get long.
 */
export function BadgeShelf({ badges, self }: { badges: BadgeRow[]; self: boolean }) {
  const [open, setOpen] = useState(false);
  const earned = badges.filter((b) => b.got).length;
  return (
    <div className="rounded-2xl bg-night-2">
      <button type="button" aria-expanded={open} aria-controls="badge-list" onClick={() => setOpen((o) => !o)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
        <span className="flex-1 text-lg font-black">{self ? `${earned} of ${badges.length} earned` : `${earned} earned`}</span>
        <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" className={`transition-transform ${open ? "rotate-180" : ""}`} {...P}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul id="badge-list" tabIndex={0} aria-label="Badges" className="mx-2 mb-2 max-h-[15.5rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {badges.map((b) => (
            <li key={b.slug} className={`flex h-[4.5rem] items-center gap-3 rounded-2xl p-3 ${b.got ? "bg-night-3" : "bg-night opacity-70"}`}>
              <span aria-hidden className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${b.got ? "bg-mustard text-[#2c1e02]" : "bg-night-3 text-chalk-dim"}`}>
                <svg viewBox="0 0 24 24" width="28" height="28">{ICONS[b.slug] ?? Fallback}</svg>
              </span>
              <span className="min-w-0"><span className="display block truncate uppercase">{b.name}</span><span className="line-clamp-2 block text-xs leading-tight text-chalk-dim">{b.description}{b.progress ? ` (${b.progress})` : ""}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
