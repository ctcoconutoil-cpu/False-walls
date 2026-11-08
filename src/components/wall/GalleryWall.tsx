"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { SignCard, WallCard, wallText } from "@/components/wall/WallCard";
import { WallBackdrop } from "@/components/wall/WallBackdrop";
import { WallHeader } from "@/components/wall/WallHeader";
import { loadWallPage, newerOnWall } from "@/lib/actions/wall";
import type { WallPost } from "@/lib/data/wall";
import { BAYH, DW, baysFor, layoutBay, type LayoutPost } from "@/lib/wall/layout";

const MAX_W = 560; // the wall is never wider than this; on a desktop the brick simply carries on either side
type Focus = { key: string; fx: number; fy: number; fs: number };

/**
 * The Main Wall: one long brick wall you scroll down, nine posts to a screen in three columns. Posts hang on it as
 * physical objects; tapping one brings it forward and opens it. The wall stays mounted underneath the post (see the
 * @modal route), so closing it leaves you exactly where you were.
 */
export function GalleryWall({ initial, next: initialNext, unread }: { initial: WallPost[]; next: number | null; unread: number }) {
  const router = useRouter();
  const path = usePathname();
  const reduce = useReducedMotion();
  const [posts, setPosts] = useState(initial);
  const [next, setNext] = useState(initialNext);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [box, setBox] = useState({ w: 390, h: 640 });
  const [view, setView] = useState({ t: 0, b: 760 });
  const [started, setStarted] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const dragged = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const s = Math.min(box.w, MAX_W) / DW; // design units to screen pixels

  const lp = useMemo<LayoutPost[]>(() => posts.map((p) => ({ id: p.id, type: p.type, hasImage: !!p.media[0]?.url })), [posts]);
  const loop = false; // the wall ends where the posts end
  const firstBay = Math.max(0, Math.floor((view.t - 300) / BAYH)), lastBay = Math.floor((view.b + 300) / BAYH);
  const slots = useMemo(() => {
    const out = [];
    for (let b = firstBay; b <= lastBay; b++) out.push(...layoutBay(b, lp, loop));
    return out;
  }, [firstBay, lastBay, lp, loop]);
  const total = Math.max(1, baysFor(posts.length)) * BAYH + 150;

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    try { const y = Number(sessionStorage.getItem("fw-wall-y")); if (y > 0) el.scrollTop = y; } catch {}
    return () => { try { sessionStorage.setItem("fw-wall-y", String(el.scrollTop)); } catch {} };
  }, []);

  const sync = useCallback(() => {
    const el = scroller.current, st = stage.current; if (!el || !st) return;
    setStarted(el.scrollTop > 40);
    setView((v) => {
      const t = Math.floor(el.scrollTop / s / 100) * 100, b = Math.ceil((el.scrollTop + el.clientHeight) / s / 100) * 100;
      return v.t === t && v.b === b ? v : { t, b };
    });
  }, [s]);
  const raf = useRef(0);
  const onScroll = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; sync(); }); }, [sync]);
  useEffect(() => { sync(); }, [sync, box]);

  // Load further posts as you near the bottom of what is on the wall.
  useEffect(() => {
    if (next === null || loading.current || view.b + 2 * BAYH < baysFor(posts.length) * BAYH) return;
    loading.current = true;
    loadWallPage(next).then((r) => {
      setPosts((cur) => { const seen = new Set(cur.map((p) => p.id)); return [...cur, ...r.posts.filter((p) => !seen.has(p.id))]; });
      setNext(r.next);
    }).catch(() => setNext(null)).finally(() => { loading.current = false; });
  }, [view.b, next, posts.length]);

  // New posts never shift the wall under your hands: offer them, and bring them in when asked.
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
    setPosts(r.posts); setNext(r.next); setNewCount(0);
    scroller.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const toTop = () => scroller.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });

  // Closing a post (the URL returns to /wall) sends it back to its place; the scroll position was never touched.
  useEffect(() => { if (path === "/wall") setFocus(null); }, [path]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const open = (key: string, id: string, el: HTMLElement, w: number, h: number) => {
    if (dragged.current || focus) return;
    const sc = scroller.current; if (!sc) return;
    const sr = sc.getBoundingClientRect(), er = el.getBoundingClientRect();
    const tw = Math.min(sr.width * 0.74, 300);
    const fs = Math.min(tw / (w * s), (sr.height * 0.62) / (h * s));
    setFocus({ key, fx: (sr.left + sr.width / 2 - (er.left + er.width / 2)) / s, fy: (sr.top + sr.height * 0.47 - (er.top + er.height / 2)) / s, fs });
    router.prefetch(`/post/${id}`);
    timer.current = setTimeout(() => router.push(`/post/${id}`, { scroll: false }), reduce ? 0 : 420);
  };
  const cancelFocus = () => { if (timer.current) clearTimeout(timer.current); if (path === "/wall") setFocus(null); };

  // Mouse: drag the wall with a little momentum. Touch uses the browser's own swipe.
  const drag = useRef<{ y: number; t0: number; v: number; t: number; id: number } | null>(null);
  const glide = useRef(0);
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || focus) return;
    cancelAnimationFrame(glide.current);
    drag.current = { y: e.clientY, t0: scroller.current!.scrollTop, v: 0, t: performance.now(), id: e.pointerId };
    dragged.current = false;
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current, el = scroller.current; if (!d || !el) return;
    const dy = e.clientY - d.y;
    if (!dragged.current && Math.abs(dy) > 6) { dragged.current = true; el.classList.add("is-dragging"); el.setPointerCapture(d.id); }
    if (!dragged.current) return;
    const now = performance.now(), nt = d.t0 - dy;
    d.v = (nt - el.scrollTop) / Math.max(1, now - d.t) * 0.8 + d.v * 0.2; d.t = now;
    el.scrollTop = nt;
  };
  const onUp = () => {
    const d = drag.current, el = scroller.current; drag.current = null; if (!d || !el) return;
    el.classList.remove("is-dragging");
    let v = reduce ? 0 : d.v * 16;
    const step = () => { if (Math.abs(v) < 0.4) return; el.scrollTop += v; v *= 0.94; glide.current = requestAnimationFrame(step); };
    step();
    setTimeout(() => { dragged.current = false; }, 0);
  };

  const shown = slots.filter((p) => p.bay >= firstBay || p.key === focus?.key);
  const stageStyle = { width: DW, height: total, transform: `scale(${s})` } as CSSProperties;
  const bays = Array.from({ length: lastBay - firstBay + 1 }, (_, i) => firstBay + i);

  return (
    <div className="wp-root">
      <WallHeader unread={unread} onHome={toTop} />
      <div ref={scroller} className={`wp-scroller ${focus ? "has-focus" : ""}`} onScroll={onScroll}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        tabIndex={0} role="region" aria-label="The Wall. Scroll down to explore.">
        <div className="wp-track" style={{ width: DW * s, height: total * s }}>
          <div ref={stage} className="wp-stage" style={stageStyle}>
            {bays.map((b) => <WallBackdrop key={b} bay={b} />)}
            {shown.map((p) => {
              const post = p.special ? null : posts[p.postIndex];
              if (!p.special && !post) return null;
              const isFocus = focus?.key === p.key;
              const style = {
                left: p.x, top: p.y, width: p.w, height: p.h, "--z": 1 + p.depth, "--rot": p.rot.toFixed(2), "--ry": p.ry.toFixed(2),
               
                ...(isFocus ? { "--fx": `${focus!.fx}px`, "--fy": `${focus!.fy}px`, "--fs": focus!.fs } : {}),
              } as CSSProperties;
              return (
                <div key={p.key} className={`wp-pos ${isFocus ? "is-focus" : ""} ${post && fresh.has(post.id) ? "is-new" : ""}`} style={style}>
                  <div className="wp-tilt">
                    {post ? (
                      <button type="button" className="wp-hit" aria-label={`Open post: ${wallText(post)}`} onClick={(e) => open(p.key, post.id, e.currentTarget, p.w, p.h)}>
                        <WallCard post={post} p={p} />
                      </button>
                    ) : (
                      <Link href="/discover" className="wp-hit" aria-label="Trending right now. See what is popular." draggable={false}><SignCard seed={p.seed} /></Link>
                    )}
                  </div>
                </div>
              );
            })}
            {next === null && posts.length > 0 && <p className="wp-end"><span>That is the whole wall.</span> No more posts.</p>}
            <div className="wp-dim" onClick={cancelFocus} aria-hidden />
          </div>
        </div>
      </div>
      <div className="wp-light" aria-hidden />
      {!started && !focus && posts.length > 0 && (
        <div className="wp-hint" aria-hidden><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 9 7 7 7-7" /></svg><span>Scroll Down</span></div>
      )}
      {newCount > 0 && <button type="button" className="wp-pill" onClick={showNew}>{newCount === 1 ? "1 new post" : `${newCount} new posts`}</button>}
      {!posts.length && (
        <div className="absolute inset-x-6 top-1/3 z-20 rounded-2xl bg-night/85 p-5 text-center backdrop-blur">
          <p className="display text-2xl">The wall is bare</p>
          <p className="mt-1 text-sm text-chalk-dim">Be the first to put something up.</p>
          <Link href="/create" className="mt-3 inline-block rounded-xl bg-coral px-4 py-2 font-black text-white">Create a post</Link>
        </div>
      )}
    </div>
  );
}
