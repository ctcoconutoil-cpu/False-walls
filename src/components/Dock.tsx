"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { cx } from "@/lib/utils";

const HIDE = ["/", "/login", "/signup", "/onboarding", "/suspended"];
const ic = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONS: Record<string, ReactNode> = {
  wall: <svg aria-hidden viewBox="0 0 24 24" width="28" height="28" {...ic}><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20" /></svg>,
  discover: <svg aria-hidden viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2c.8 5.2 4.8 9.2 10 10-5.2.800-9.2 4.8-10 10-.8-5.2-4.8-9.2-10-10 5.2-.8 9.2-4.8 10-10z" /></svg>,
  inbox: <svg aria-hidden viewBox="0 0 24 24" width="28" height="28" {...ic}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="m3 7 9 6.500L21 7" /></svg>,
  me: <svg aria-hidden viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8.8 9a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.800zm6.4 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.800zM7.5 14.200h9a4.5 4.5 0 0 1-9 0z" /></svg>,
};

export function Dock({ username, unread }: { username: string | null; unread: number }) {
  const path = usePathname();
  const hidden = HIDE.includes(path) || path.startsWith("/admin") || path.startsWith("/auth") || path.startsWith("/w/") || path.startsWith("/q/");
  useEffect(() => { document.documentElement.style.setProperty("--dock", hidden ? "0px" : "76px"); }, [hidden]);
  if (hidden) return null;
  const item = (href: string, label: string, icon: string, active: boolean, badge?: number) => (
    <Link href={href} aria-current={active ? "page" : undefined} className={cx("relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-bold", active ? "text-[#F9A719]" : "text-[#c9b6e3]")}>
      {ICONS[icon]}{label}
      {!!badge && <span className="absolute right-[22%] top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#E51F2B] px-1 text-[11px] text-white" aria-label={`${badge} unread`}>{badge > 99 ? "99+" : badge}</span>}
    </Link>
  );
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[60] rounded-t-[26px] border-t-2 border-[#46225f] bg-[#1a0925]/97 shadow-[0_-8px_24px_rgba(0,0,0,.5)] backdrop-blur safe-bottom">
      <div className="mx-auto grid max-w-xl grid-cols-5 items-end px-2">
        {item("/wall", "Wall", "wall", path.startsWith("/wall"))}
        {item("/discover", "Discover", "discover", path.startsWith("/discover") || path.startsWith("/search"))}
        <Link href="/create" aria-label="Create: put something on the wall" className="relative -mt-7 mb-1.5 mx-auto grid h-[68px] w-[68px] place-items-center rounded-[22px] bg-[#EE3B24] text-white shadow-[0_6px_0_#8f1d0f,0_10px_20px_rgba(0,0,0,.5)] btn-press [--btn-shadow:#8f1d0f]">
          <svg aria-hidden viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round"><path d="M12 4v16M4 12h16" /></svg>
        </Link>
        {item("/inbox", "Inbox", "inbox", path.startsWith("/inbox"), unread)}
        {item(username ? `/profile/${username}` : "/login", "Me", "me", path.startsWith("/profile") || path === "/settings")}
      </div>
    </nav>
  );
}
