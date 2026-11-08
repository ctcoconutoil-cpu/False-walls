"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** The Wall's header: home, the FALSE WALLS mark, search, activity and a small menu. It stays put while the wall scrolls beneath it. */
export function WallHeader({ unread, onHome }: { unread: number; onHome: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const btn = "grid h-11 w-11 place-items-center rounded-full text-white active:bg-white/10";
  return (
    <header className="wp-header">
      <button type="button" onClick={onHome} aria-label="Back to the top of the Wall" className={btn}>
        <svg aria-hidden viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"><path d="M3.5 11.2 12 3.8l8.5 7.4M5.8 9.8V20h4.4v-5.5h3.6V20h4.4V9.8" /></svg>
      </button>
      <Link href="/wall" aria-label="False Walls" className="wp-logo">
        <svg aria-hidden viewBox="0 0 40 18" className="wp-logo-eye"><path d="M2 12C8 3 32 3 38 12C32 20 8 20 2 12z" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" /><circle cx="20" cy="11" r="4.4" fill="#fff" /></svg>
        <span className="wp-logo-text">False<br />Walls</span>
        <svg aria-hidden viewBox="0 0 20 20" className="wp-logo-marks" fill="none" stroke="#F9A719" strokeWidth="2.6" strokeLinecap="round"><path d="M3 15 9 8M10 18l5-8M12 5l6-3" /></svg>
      </Link>
      <span className="flex-1" />
      <Link href="/search" aria-label="Search" className={btn}>
        <svg aria-hidden viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
      </Link>
      <Link href="/inbox" aria-label={unread ? `Activity, ${unread} new` : "Activity"} className={btn}>
        <span className="relative grid h-[30px] w-[28px] place-items-center rounded-[6px] border-[2.6px] border-white text-[15px] font-black leading-none">
          <span aria-hidden className="absolute -top-[6px] left-[5px] h-[7px] w-[2.6px] rounded bg-white" /><span aria-hidden className="absolute -top-[6px] right-[5px] h-[7px] w-[2.6px] rounded bg-white" />
          {unread > 99 ? "99" : unread}
        </span>
      </Link>
      <div ref={ref} className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label="More" aria-expanded={open} aria-haspopup="menu" className={btn}>
          <svg aria-hidden viewBox="0 0 24 24" width="27" height="27" fill="currentColor"><circle cx="12" cy="4.5" r="2.3" /><circle cx="12" cy="12" r="2.3" /><circle cx="12" cy="19.5" r="2.3" /></svg>
        </button>
        {open && (
          <div role="menu" className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-2xl border-2 border-night-3 bg-night-2 py-1 shadow-2xl">
            {[["/saved", "Saved"], ["/settings", "Settings"], ["/guidelines", "Guidelines"], ["/privacy", "Privacy"]].map(([href, label]) => (
              <Link key={href} href={href} role="menuitem" className="block px-4 py-3 text-sm font-bold text-chalk active:bg-night-3">{label}</Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
