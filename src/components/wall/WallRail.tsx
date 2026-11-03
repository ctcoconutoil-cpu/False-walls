"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AREAS, AREA_ORDER, POST_TYPES } from "@/lib/constants";
import type { AreaSlug, Post } from "@/lib/types";
import { Button, SampleTag, Sheet } from "@/components/ui";
import { RevealPanel } from "@/components/wall/RevealPanel";
import { BrickWall } from "@/components/wall/BrickWall";
import { useCurtainNav } from "@/components/wall/Curtain";
import { recordDiscovery } from "@/lib/actions/posts";
import { cx, timeAgo } from "@/lib/utils";

type Item = { slot: number; post: Post };
type Props = { area: AreaSlug; section: number; hasMore: boolean; items: Item[]; tab: "trending" | "newest"; loggedIn: boolean };

const caption = (p: Post) => (p.type === "false_wall" ? "Look closer" : p.title ?? p.clue ?? p.body ?? POST_TYPES[p.type].label);

/** The Wall: one row of brick walls that you swipe sideways. Nothing here scrolls down. */
export function WallRail({ area, section, hasMore, items, tab, loggedIn }: Props) {
  const reduce = useReducedMotion();
  const A = AREAS[area];
  const rail = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [revealing, setRevealing] = useState<string | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const { go, overlay } = useCurtainNav();
  const base = `/wall/${area}`;

  useEffect(() => { if (loggedIn) void recordDiscovery("area_visited", area); }, [area, loggedIn]);

  const measure = useCallback(() => {
    const el = rail.current; if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);
  useEffect(() => {
    measure();
    const el = rail.current; if (!el) return;
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [measure, items]);

  // A mouse wheel moves the row sideways, so desktop visitors never have to hunt for a scrollbar.
  useEffect(() => {
    const el = rail.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault(); el.scrollBy({ left: e.deltaY, behavior: "auto" });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const nudge = (dir: 1 | -1) => rail.current?.scrollBy({ left: dir * Math.max(240, rail.current.clientWidth * 0.7), behavior: reduce ? "auto" : "smooth" });

  const open = useCallback((it: Item) => {
    if (it.post.type !== "false_wall") { setSelected(it); return; }
    // A False Wall splits open, then the Behind the Wall screen takes over.
    if (reduce) { go(`/post/${it.post.id}`); return; }
    setRevealing(it.post.id);
    window.setTimeout(() => go(`/post/${it.post.id}`), 650);
    window.setTimeout(() => setRevealing(null), 1500);
  }, [reduce, go]);

  const qs = (s: number) => `${base}?section=${s}${area === "trending" ? `&tab=${tab}` : ""}`;

  return (
    <div className="relative flex h-[calc(100dvh-var(--dock))] flex-col overflow-hidden bg-[#0c0919]">
      {overlay}
      <header className="relative z-40 shrink-0 bg-night/95 px-3 pb-1.5 pt-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-xl leading-tight" style={{ color: A.accent }}>{A.name}</h1>
            <p className="truncate text-xs text-chalk-dim">{A.blurb}</p>
          </div>
          <Link href="/search" aria-label="Search" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-night-3 text-lg">⌕</Link>
        </div>
        <nav aria-label="Wall areas" className="scrollbar-none -mx-3 mt-1.5 flex gap-1.5 overflow-x-auto px-3">
          {AREA_ORDER.map((a) => (
            <Link key={a} href={`/wall/${a}`} aria-current={a === area ? "page" : undefined} className={cx("display shrink-0 rounded-full px-3 py-1.5 text-[13px] font-black", a === area ? "text-[#1a1200]" : "bg-night-3 text-chalk")} style={a === area ? { background: AREAS[a].accent } : undefined}>{AREAS[a].name.replace(" Wall", "")}</Link>
          ))}
        </nav>
        {area === "trending" && (
          <div role="tablist" aria-label="Trending or newest" className="mt-1.5 flex gap-1.5">
            {(["trending", "newest"] as const).map((t) => (
              <Link key={t} role="tab" aria-selected={tab === t} href={`${base}?tab=${t}`} className={cx("rounded-lg px-3 py-1 text-sm font-bold", tab === t ? "bg-chalk text-night" : "bg-night-3")}>{t === "trending" ? "Trending" : "Newest"}</Link>
            ))}
          </div>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={rail} data-testid="wall-rail" onScroll={measure} tabIndex={0} role="list"
          aria-label={`${A.name}. Swipe or use the left and right arrow keys to move along the wall.`}
          className="scrollbar-none flex h-full snap-x snap-mandatory items-center gap-5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-[14vw] outline-none sm:px-16"
        >
          {section > 0 && <Link role="listitem" href={qs(section - 1)} className="grid h-24 w-24 shrink-0 snap-center place-items-center rounded-2xl bg-night-3 text-center text-sm font-bold">‹<br />Earlier walls</Link>}
          {items.length === 0 && (
            <div role="listitem" className="mx-auto w-[min(80vw,22rem)] shrink-0 rounded-2xl bg-night/90 p-4 text-center">
              <p className="display text-lg">{area === "trending" && tab === "trending" ? "Nothing is trending yet" : "This wall is blank"}</p>
              <p className="mt-1 text-sm text-chalk-dim">{area === "trending" && tab === "trending" ? "Walls rise here when several different people react and reply. Check Newest, or start a conversation." : "Be the first to put something here."}</p>
              <Link href="/create" className="mt-3 inline-block rounded-xl bg-mustard px-4 py-2 font-bold text-[#2c1e02]">Create a wall</Link>
            </div>
          )}
          {items.map((it) => (
            <div role="listitem" key={it.post.id} className="w-[72vw] max-w-[320px] shrink-0 snap-center sm:w-[300px]">
              <button
                type="button" data-wall data-post={it.post.id} data-type={it.post.type} onClick={() => open(it)}
                className="relative block w-full text-left active:scale-[0.98]"
                aria-label={`${POST_TYPES[it.post.type].label}: ${caption(it.post)}${it.post.is_sample ? " (sample)" : ""}`}
              >
                <BrickWall post={it.post} big />
                {it.post.is_sample && <span className="absolute -bottom-1 right-2 z-20"><SampleTag /></span>}
                {revealing === it.post.id && (
                  <span aria-hidden className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
                    <motion.span className="block h-24 w-24 rounded-full" style={{ background: "radial-gradient(circle, #fff 0%, #ffe9b0 25%, transparent 70%)" }} initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 6, opacity: 0 }} transition={{ duration: 0.7 }} />
                  </span>
                )}
              </button>
              <p className="mt-2 line-clamp-2 px-1 text-center text-sm font-semibold text-chalk">{caption(it.post)}</p>
              <p className="text-center text-xs text-chalk-dim">{POST_TYPES[it.post.type].label}</p>
            </div>
          ))}
          {hasMore && <Link role="listitem" href={qs(section + 1)} className="grid h-24 w-24 shrink-0 snap-center place-items-center rounded-2xl bg-night-3 text-center text-sm font-bold">›<br />More walls</Link>}
        </div>

        <button type="button" aria-label="Earlier walls" onClick={() => nudge(-1)} disabled={edge.start} className="absolute left-2 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-night/85 text-2xl shadow-[0_3px_0_#0d0b1f] disabled:opacity-30 sm:grid">‹</button>
        <button type="button" aria-label="More walls" onClick={() => nudge(1)} disabled={edge.end} className="absolute right-2 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-night/85 text-2xl shadow-[0_3px_0_#0d0b1f] disabled:opacity-30 sm:grid">›</button>
        {!edge.end && items.length > 1 && <span aria-hidden className="pointer-events-none absolute bottom-3 right-4 z-30 rounded-full bg-night/80 px-3 py-1 text-xs text-chalk-dim sm:hidden">Swipe →</span>}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? POST_TYPES[selected.post.type].label : ""}>
        {selected && <Peek item={selected} loggedIn={loggedIn} go={(h) => { setSelected(null); go(h); }} />}
      </Sheet>
    </div>
  );
}

function Peek({ item, loggedIn, go }: { item: Item; loggedIn: boolean; go: (href: string) => void }) {
  const p = item.post;
  const concealed = p.type === "hidden_thought";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-chalk-dim">
        {p.is_sample && <SampleTag />}
        {p.author ? <span>by {p.author.display_name || p.author.username}</span> : <span>Demonstration content</span>}
        <span>· {timeAgo(p.created_at)}</span>
      </div>
      {concealed ? (
        <>
          {p.body && <p className="text-lg">{p.body}</p>}
          <RevealPanel post={p} loggedIn={loggedIn} />
        </>
      ) : (
        <>
          {p.prompt_text && <p className="text-sm text-chalk-dim">Prompt: {p.prompt_text}</p>}
          {p.title && <p className="display text-2xl">{p.title}</p>}
          {p.body && <p className="whitespace-pre-wrap text-chalk">{p.body}</p>}
          {p.media[0]?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.media[0].url} alt={p.media[0].alt_text ?? p.title ?? "Picture"} loading="lazy" className="max-h-72 w-full rounded-xl object-cover" />
          )}
        </>
      )}
      <Button tone="teal" className="w-full" onClick={() => go(`/post/${p.id}`)}>Go behind the wall</Button>
    </div>
  );
}
