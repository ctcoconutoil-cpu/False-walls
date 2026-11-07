"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { Wordmark } from "@/components/ui";
import { WallCard, wallText } from "@/components/wall/WallCard";
import { loadWallPage, newerOnWall } from "@/lib/actions/wall";
import type { WallPost } from "@/lib/data/wall";
import { DH, layoutWall, type LayoutPost } from "@/lib/wall/layout";

const PARALLAX = [0.07, 0, -0.05]; // far posts drift a little against the scroll, near ones a little with it
const BUCKET = 1600;
type Focus = { key: string; fx: number; fy: number; fs: number };

/**
 * The Main Wall: one continuous brick wall you swipe along sideways. Posts hang on it as physical objects; tapping one
 * brings it forward and opens it. The wall stays mounted underneath the post (see the @modal route), so closing it
 * leaves you exactly where you were.
 */
export function GalleryWall({ initial, hasMore: initialMore }: { initial: WallPost[]; hasMore: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const reduce = useReducedMotion();
  const [posts, setPosts] = useState(initial);
  const [hasMore, setHasMore] = useState(initialMore);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [box, setBox] = useState({ w: 390, h: 640 });
  const [view, setView] = useState({ l: 0, r: 600 });
  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const dragged = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const s = box.h / DH; // design units to screen pixels

  const layoutPosts = useMemo<LayoutPost[]>(() => posts.map((p) => {
    const m = p.media[0];
    return { id: p.id, type: p.type, kind: p.false_wall_kind, hasImage: !!m?.url, ratio: m?.width && m?.height ? m.width / m.height : null };
  }), [posts]);
  const untilX = Math.ceil((view.r + 1200) / BUCKET) * BUCKET;
  const { placed, end } = useMemo(() => layoutWall(layoutPosts, untilX, !hasMore), [layoutPosts, untilX, hasMore]);
  const width = (hasMore ? end + 160 : untilX + 400);

  // Measure the screen so the wall (660 units tall) always fills its height exactly.
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Remember where you were if you leave the Wall for another tab and come back.
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    try { const x = Number(sessionStorage.getItem("fw-wall-x")); if (x > 0) el.scrollLeft = x; } catch {}
    return () => { try { sessionStorage.setItem("fw-wall-x", String(el.scrollLeft)); } catch {} };
  }, []);

  const sync = useCallback(() => {
    const el = scroller.current, st = stage.current; if (!el || !st) return;
    const sx = (el.scrollLeft + el.clientWidth / 2) / s;
    st.style.setProperty("--sx", sx.toFixed(1));
    setView((v) => {
      const l = Math.floor((el.scrollLeft / s) / 80) * 80, r = Math.ceil(((el.scrollLeft + el.clientWidth) / s) / 80) * 80;
      return v.l === l && v.r === r ? v : { l, r };
    });
  }, [s]);
  const raf = useRef(0);
  const onScroll = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; sync(); }); }, [sync]);
  useEffect(() => { sync(); }, [sync, box]);

  // Load further posts as you approach the end of what is on the wall.
  useEffect(() => {
    if (!hasMore || loading.current || view.r + 1600 < end) return;
    loading.current = true;
    loadWallPage(posts.length).then((r) => {
      setPosts((cur) => { const seen = new Set(cur.map((p) => p.id)); return [...cur, ...r.posts.filter((p) => !seen.has(p.id))]; });
      setHasMore(r.hasMore);
    }).finally(() => { loading.current = false; });
  }, [view.r, end, hasMore, posts.length]);

  // New posts: never shift the wall under your hands. Offer them, and bring them in when asked.
  useEffect(() => {
    const newest = posts[0]?.created_at; if (!newest) return;
    const tick = async () => { if (document.visibilityState === "visible") { try { setNewCount(await newerOnWall(newest)); } catch {} } };
    const t = setInterval(tick, 40000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [posts]);
  const showNew = async () => {
    const r = await loadWallPage(0);
    const old = new Set(posts.map((p) => p.id));
    setFresh(new Set(r.posts.filter((p) => !old.has(p.id)).map((p) => p.id)));
    setPosts(r.posts); setHasMore(r.hasMore); setNewCount(0);
    scroller.current?.scrollTo({ left: 0, behavior: reduce ? "auto" : "smooth" });
  };

  // Closing a post (the URL returns to /wall) sends it back to its place; the scroll position was never touched.
  useEffect(() => { if (path === "/wall") setFocus(null); }, [path]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const open = (key: string, id: string, el: HTMLElement, w: number, h: number) => {
    if (dragged.current || focus) return;
    const sc = scroller.current; if (!sc) return;
    const sr = sc.getBoundingClientRect(), er = el.getBoundingClientRect();
    const tw = Math.min(sr.width * 0.78, 340);
    const fs = Math.min(tw / (w * s), (sr.height * 0.5) / (h * s));
    const fx = (sr.left + sr.width / 2 - (er.left + er.width / 2)) / s;
    const fy = (sr.top + sr.height * 0.46 - (er.top + er.height / 2)) / s;
    setFocus({ key, fx, fy, fs });
    router.prefetch(`/post/${id}`);
    timer.current = setTimeout(() => router.push(`/post/${id}`, { scroll: false }), reduce ? 0 : 420);
  };
  const cancelFocus = () => { if (timer.current) clearTimeout(timer.current); if (path === "/wall") setFocus(null); };

  // Mouse: drag the wall with a little momentum. Touch uses the browser's own swipe.
  const drag = useRef<{ x: number; l: number; v: number; t: number; id: number } | null>(null);
  const glide = useRef(0);
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || focus) return;
    cancelAnimationFrame(glide.current);
    drag.current = { x: e.clientX, l: scroller.current!.scrollLeft, v: 0, t: performance.now(), id: e.pointerId };
    dragged.current = false;
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current, el = scroller.current; if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!dragged.current && Math.abs(dx) > 6) { dragged.current = true; el.classList.add("is-dragging"); el.setPointerCapture(d.id); }
    if (!dragged.current) return;
    const now = performance.now(), nl = d.l - dx;
    d.v = (nl - el.scrollLeft) / Math.max(1, now - d.t) * 0.8 + d.v * 0.2; d.t = now;
    el.scrollLeft = nl;
  };
  const onUp = () => {
    const d = drag.current, el = scroller.current; drag.current = null; if (!d || !el) return;
    el.classList.remove("is-dragging");
    let v = reduce ? 0 : d.v * 16;
    const step = () => { if (Math.abs(v) < 0.4) return; el.scrollLeft += v; v *= 0.94; glide.current = requestAnimationFrame(step); };
    step();
    setTimeout(() => { dragged.current = false; }, 0);
  };
  const onWheel = (e: React.WheelEvent) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && scroller.current) scroller.current.scrollLeft += e.deltaY; };

  const visible = placed.filter((p) => (p.x + p.w > view.l - 160 && p.x < view.r + 160) || p.key === focus?.key);
  const stageStyle = { width, transform: `scale(${s})` } as CSSProperties;

  return (
    <div className="wp-root">
      <div ref={scroller} className={`wp-scroller ${focus ? "has-focus" : ""}`} onScroll={onScroll}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
        tabIndex={0} role="region" aria-label="The Wall. Swipe sideways to explore.">
        <div className="wp-track" style={{ width: width * s }}>
          <div ref={stage} className="wp-stage" style={stageStyle}>
            {visible.map((p) => {
              const post = posts[p.postIndex]; if (!post) return null;
              const isFocus = focus?.key === p.key;
              const style = {
                left: p.x, top: p.y, width: p.w, height: p.h, "--z": 1 + p.depth, "--rot": p.rot.toFixed(2), "--ry": p.ry.toFixed(2),
                "--cx": (p.x + p.w / 2).toFixed(1), "--pf": PARALLAX[p.depth],
                ...(isFocus ? { "--fx": `${focus!.fx}px`, "--fy": `${focus!.fy}px`, "--fs": focus!.fs } : {}),
              } as CSSProperties;
              return (
                <div key={p.key} className={`wp-pos ${isFocus ? "is-focus" : ""} ${fresh.has(post.id) ? "is-new" : ""}`} style={style}>
                  <div className="wp-tilt">
                    <button type="button" className="wp-hit" aria-label={`Open post: ${wallText(post).slice(0, 80)}`} onClick={(e) => open(p.key, post.id, e.currentTarget, p.w, p.h)}>
                      <WallCard post={post} p={p} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="wp-dim" onClick={cancelFocus} aria-hidden />
          </div>
        </div>
      </div>
      <div className="wp-light" aria-hidden />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-2.5">
        <Link href="/wall" className="pointer-events-auto" aria-label="False Walls, the Wall"><Wordmark size="sm" /></Link>
        <Link href="/search" aria-label="Search" className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-night/70 text-chalk backdrop-blur">
          <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        </Link>
      </header>
      {newCount > 0 && <button type="button" className="wp-pill" onClick={showNew}>{newCount === 1 ? "1 new post" : `${newCount} new posts`}</button>}
      {!posts.length && (
        <div className="absolute inset-x-6 top-1/3 z-20 rounded-2xl bg-night/85 p-5 text-center backdrop-blur">
          <p className="display text-2xl">The wall is bare</p>
          <p className="mt-1 text-sm text-chalk-dim">Be the first to put something up.</p>
          <Link href="/create" className="mt-3 inline-block rounded-xl bg-coral px-4 py-2 font-black text-[#2a0d08]">Create a post</Link>
        </div>
      )}
    </div>
  );
}
