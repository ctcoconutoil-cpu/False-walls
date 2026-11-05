"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cx } from "@/lib/utils";

const HIDE = ["/", "/login", "/signup", "/onboarding", "/suspended"];

export function Dock({ username, unread }: { username: string | null; unread: number }) {
  const path = usePathname();
  const hidden = HIDE.includes(path) || path.startsWith("/admin") || path.startsWith("/auth") || path.startsWith("/w/") || path.startsWith("/q/");
  useEffect(() => { document.documentElement.style.setProperty("--dock", hidden ? "0px" : "68px"); }, [hidden]);
  if (hidden) return null;
  const item = (href: string, label: string, glyph: string, active: boolean, badge?: number) => (
    <Link href={href} aria-current={active ? "page" : undefined} className={cx("relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold", active ? "text-mustard" : "text-chalk-dim")}>
      <span aria-hidden className="text-xl leading-none">{glyph}</span>{label}
      {!!badge && <span className="absolute right-[24%] top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] text-[#2a0d08]" aria-label={`${badge} unread`}>{badge > 99 ? "99+" : badge}</span>}
    </Link>
  );
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[60] border-t-2 border-night-3 bg-night/95 backdrop-blur safe-bottom">
      <div className="mx-auto flex max-w-xl items-end px-2">
        {item("/wall", "Wall", "▦", path.startsWith("/wall"))}
        {item("/discover", "Discover", "✦", path.startsWith("/discover") || path.startsWith("/search"))}
        <Link href="/create" aria-label="Create: put something on the wall" className="relative -mt-5 mb-1.5 grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-coral text-3xl font-black text-[#2a0d08] shadow-[0_5px_0_#8f2c1b] btn-press [--btn-shadow:#8f2c1b]">+</Link>
        {item("/adventure", "Adventure", "🧭", path.startsWith("/adventure"))}
        {item("/games", "Games", "▣", path.startsWith("/games"))}
        {item("/inbox", "Inbox", "✉", path.startsWith("/inbox"), unread)}
        {item(username ? `/profile/${username}` : "/login", "Me", "☻", path.startsWith("/profile") || path === "/settings")}
      </div>
    </nav>
  );
}
