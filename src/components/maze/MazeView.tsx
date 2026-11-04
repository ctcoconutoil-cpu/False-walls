"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { AREAS, AREA_ORDER, POST_TYPES } from "@/lib/constants";
import { FACE, SIZE, TILE, hash, rng, buildSection, findPath, standingTile, step, type Dir, type Point } from "@/lib/maze/layout";
import type { AreaSlug, AuthorLite, Post } from "@/lib/types";
import { Button, SampleTag, Sheet } from "@/components/ui";
import { MazeWorld } from "./MazeWorld";
import { PlayerMarker } from "./PlayerMarker";
import { EyeMark, WallMarker } from "./WallMarker";
import { RevealPanel } from "@/components/wall/RevealPanel";
import { useCurtainNav } from "./Curtain";
import { recordDiscovery } from "@/lib/actions/posts";
import { cx, timeAgo } from "@/lib/utils";

type Item = { slot: number; post: Post };
type Props = {
  area: AreaSlug; section: number; sectionCount: number; items: Item[]; tab: "trending" | "newest";
  loggedIn: boolean; me: AuthorLite | null;
};

const STEP = 140; // ms per tile; the marker and camera glide at the same speed
const NAMES = { n: "north", e: "east", s: "south", w: "west" } as const;
const label = (p: Post) => p.title ?? p.clue ?? p.body ?? "wall";

export function MazeView({ area, section, sectionCount, items: rawItems, tab, loggedIn, me }: Props) {
  const reduce = useReducedMotion();
  const A = AREAS[area];
  const m = useMemo(() => buildSection(area, section), [area, section]);
  // Walls are shuffled onto the maze so it never looks the same twice. The shuffle is steady within a visit
  // (so coming back lands you next to the same wall) and the telescope menu can shuffle again.
  const [shuffleKey, setShuffleKey] = useState<string | null>(null);
  const items = useMemo(() => {
    if (!shuffleKey) return rawItems;
    const r = rng(hash(`${area}:${section}:${shuffleKey}`)), a = [...rawItems];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.map((it, i) => ({ ...it, slot: i }));
  }, [rawItems, shuffleKey, area, section]);
  const byFace = useMemo(() => {
    const map = new Map<string, Item>();
    items.forEach((it) => { const f = m.faces[it.slot % m.faces.length]; if (f) map.set(`${f.x},${f.y}`, it); });
    return map;
  }, [items, m]);
  const faceOf = useCallback((it: Item) => m.faces[it.slot % m.faces.length], [m]);

  const viewport = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 360, h: 560 });
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const zoom = userZoom ?? (vp.w < 480 ? 1.3 : 1.5);
  const zoomRef = useRef(zoom);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const instant = useRef(false); // set while restoring a saved spot, so the eye and camera appear there instead of gliding from the start
  const who = me?.id ?? "guest"; // saved spots belong to whoever is signed in on this device
  const [zoomOpen, setZoomOpen] = useState(false);
  const [pos, setPos] = useState<Point>(m.start);
  const posRef = useRef(pos);
  const [look, setLook] = useState<Dir>("s");
  const [moving, setMoving] = useState(false);
  const [bump, setBump] = useState(0);
  const [detached, setDetached] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [revealing, setRevealing] = useState<Item | null>(null);
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const px = useMotionValue(m.start.x * TILE), py = useMotionValue(m.start.y * TILE);
  const dragged = useRef(false);
  const walkId = useRef(0);
  const { go, overlay } = useCurtainNav();

  useEffect(() => {
    const el = viewport.current; if (!el) return;
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setVp({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    try {
      let k = sessionStorage.getItem("fw-shuffle");
      if (!k) { k = Math.random().toString(36).slice(2); sessionStorage.setItem("fw-shuffle", k); }
      setShuffleKey(k);
    } catch { setShuffleKey(Math.random().toString(36).slice(2)); }
  }, []);
  useEffect(() => { posRef.current = pos; zoomRef.current = zoom; }, [pos, zoom]);

  // Come back to the last wall you were at, not the start: restore the section and tile from this device.
  useEffect(() => {
    try {
      const z = parseFloat(localStorage.getItem("fw-zoom") ?? "");
      if (z >= 0.55 && z <= 2) setUserZoom(z);
      const v = JSON.parse(localStorage.getItem(`fw-last:${who}:${area}`) ?? "null") as { s: number; x: number; y: number } | null;
      const explicit = new URLSearchParams(window.location.search).has("section");
      if (v && !explicit && typeof v.s === "number" && v.s !== section && v.s > 0 && v.s < sectionCount) {
        router.replace(`/wall/${area}?section=${v.s}${area === "trending" ? `&tab=${tab}` : ""}`);
        return;
      }
      if (v && v.s === section && Number.isInteger(v.x) && Number.isInteger(v.y) && m.walls[v.y]?.[v.x] === false) {
        const p = { x: v.x, y: v.y };
        instant.current = true; setPos(p); posRef.current = p; px.set(p.x * TILE); py.set(p.y * TILE);
      } else localStorage.setItem(`fw-last:${who}:${area}`, JSON.stringify({ s: section, x: m.start.x, y: m.start.y }));
    } catch { /* storage may be unavailable */ }
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(`fw-last:${who}:${area}`, JSON.stringify({ s: section, x: pos.x, y: pos.y })); } catch { /* ignore */ }
  }, [pos, area, section, ready, who]);

  // First visit to an area counts toward the Explorer badge.
  useEffect(() => { if (loggedIn) void recordDiscovery("area_visited", area); }, [area, loggedIn]);

  const W = SIZE * TILE * zoom;
  const clamp = useCallback((cx_: number, cy_: number) => ({
    x: W <= vp.w ? (vp.w - W) / 2 : Math.min(0, Math.max(vp.w - W, cx_)),
    y: W <= vp.h ? (vp.h - W) / 2 : Math.min(0, Math.max(vp.h - W - FACE * zoom, cy_)),
  }), [W, vp.w, vp.h, zoom]);
  const follow = useCallback((p: Point, instant = false) => {
    const c = clamp(vp.w / 2 - (p.x + 0.5) * TILE * zoom, vp.h * 0.46 - (p.y + 0.5) * TILE * zoom);
    if (instant || reduce) { x.set(c.x); y.set(c.y); }
    else { animate(x, c.x, { duration: STEP / 1000, ease: "linear" }); animate(y, c.y, { duration: STEP / 1000, ease: "linear" }); }
  }, [clamp, vp.w, vp.h, zoom, reduce, x, y]);

  // Zoom in or out. The view stays on the player, or on the middle of the screen if you have dragged away.
  const zoomTo = useCallback((next: number) => {
    const z = Math.min(2, Math.max(0.55, Math.round(next * 100) / 100)), old = zoomRef.current;
    if (z === old) return;
    const k = z / old, cx = vp.w / 2, cy = vp.h / 2;
    x.set(cx - (cx - x.get()) * k); y.set(cy - (cy - y.get()) * k);
    zoomRef.current = z; setUserZoom(z);
    try { localStorage.setItem("fw-zoom", String(z)); } catch { /* ignore */ }
  }, [vp.w, vp.h, x, y]);
  useEffect(() => { if (detached) { const c = clamp(x.get(), y.get()); x.set(c.x); y.set(c.y); } }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!zoomOpen) return;
    const close = (e: Event) => { if (!(e.target as HTMLElement).closest("[data-testid=telescope],[aria-label=Zoom]")) setZoomOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomOpen(false); };
    window.addEventListener("pointerdown", close); window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); };
  }, [zoomOpen]);

  // Pinch with two fingers, or Ctrl + wheel, to zoom.
  const pinching = useRef(false);
  useEffect(() => {
    const el = viewport.current; if (!el) return;
    let d0 = 0, z0 = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const ts = (e: TouchEvent) => { if (e.touches.length === 2) { pinching.current = true; dragged.current = true; d0 = dist(e.touches); z0 = zoomRef.current; } };
    const tm = (e: TouchEvent) => { if (e.touches.length === 2 && d0) { e.preventDefault(); zoomTo(z0 * (dist(e.touches) / d0)); } };
    const te = (e: TouchEvent) => { if (e.touches.length < 2) { d0 = 0; window.setTimeout(() => { pinching.current = false; dragged.current = false; }, 150); } };
    const wh = (e: WheelEvent) => { if (e.ctrlKey) { e.preventDefault(); zoomTo(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); } };
    el.addEventListener("touchstart", ts, { passive: true }); el.addEventListener("touchmove", tm, { passive: false });
    el.addEventListener("touchend", te); el.addEventListener("wheel", wh, { passive: false });
    return () => { el.removeEventListener("touchstart", ts); el.removeEventListener("touchmove", tm); el.removeEventListener("touchend", te); el.removeEventListener("wheel", wh); };
  }, [zoomTo]);

  // The marker glides to each new tile; the camera follows unless the person has dragged away.
  useEffect(() => {
    const d = reduce || instant.current ? 0 : STEP / 1000;
    if (d) { animate(px, pos.x * TILE, { duration: d, ease: "linear" }); animate(py, pos.y * TILE, { duration: d, ease: "linear" }); }
    else { px.set(pos.x * TILE); py.set(pos.y * TILE); }
  }, [pos, reduce, px, py]);
  useEffect(() => { if (!detached) follow(pos, instant.current); instant.current = false; }, [pos, detached, follow]);
  useEffect(() => { follow(posRef.current, true); }, [m, vp.w, vp.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2600); }, []);

  const walk = useCallback((path: Point[], then?: () => void) => {
    const id = ++walkId.current;
    if (!path.length) { then?.(); return; }
    setDetached(false); setMoving(true);
    let i = 0;
    const tick = () => {
      if (id !== walkId.current) return;
      if (i >= path.length) { setMoving(false); then?.(); return; }
      const p = path[i++], from = posRef.current;
      setLook(p.x > from.x ? "e" : p.x < from.x ? "w" : p.y > from.y ? "s" : "n");
      setPos(p); posRef.current = p;
      window.setTimeout(tick, reduce ? 40 : STEP);
    };
    tick();
  }, [reduce]);

  const adjacentItems = useMemo(() => {
    const out: Item[] = [];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const it = byFace.get(`${pos.x + dx},${pos.y + dy}`); if (it) out.push(it); }
    return out;
  }, [pos, byFace]);
  // False Walls glow a little brighter when you are close enough to have noticed them.
  const nearIds = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => { const f = faceOf(it); if (f && Math.abs(f.x - pos.x) <= 2 && Math.abs(f.y - pos.y) <= 2) s.add(it.post.id); });
    return s;
  }, [items, pos, faceOf]);

  const openItem = useCallback((it: Item) => { setSelected(it); }, []);
  // A False Wall splits open, then the existing Behind the Wall screen takes over.
  const revealFalseWall = useCallback((it: Item) => {
    if (reduce) { go(`/post/${it.post.id}`); return; }
    setRevealing(it); setStatus("The wall splits open.");
    window.setTimeout(() => go(`/post/${it.post.id}`), 650);
    window.setTimeout(() => setRevealing(null), 1500);
  }, [reduce, go]);
  const activate = useCallback((it: Item) => { if (it.post.type === "false_wall") revealFalseWall(it); else openItem(it); }, [openItem, revealFalseWall]);

  const onItem = useCallback((it: Item) => {
    if (dragged.current) return;
    const p = findPath(m, posRef.current, standingTile(m, faceOf(it)));
    if (!p) { activate(it); return; }
    walk(p, () => activate(it));
  }, [faceOf, m, walk, activate]);

  const onDoor = useCallback(() => {
    if (dragged.current) return;
    const d = m.doors[0]; if (!d) return;
    const p = findPath(m, posRef.current, standingTile(m, d));
    const arrive = async () => {
      if (loggedIn) await recordDiscovery("door_found", d.key);
      showToast(`You found a hidden door. It leads to the ${AREAS[d.to].name}.`);
      window.setTimeout(() => go(`/wall/${d.to}`), 900);
    };
    if (!p) void arrive(); else walk(p, () => void arrive());
  }, [m, walk, loggedIn, showToast, go]);

  // Drag to look around. Taps (movement under 6px) walk the marker instead.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragged.current = false;
    const sx = e.clientX, sy = e.clientY, ox = x.get(), oy = y.get();
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (pinching.current || (!dragged.current && Math.hypot(dx, dy) < 6)) return;
      dragged.current = true; setDetached(true);
      const c = clamp(ox + dx, oy + dy); x.set(c.x); y.set(c.y);
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); window.setTimeout(() => { dragged.current = false; }, 0); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
  const onWorldClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragged.current) return;
    if ((e.target as HTMLElement).closest("[data-wall]")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - r.left) / r.width) * SIZE), ty = Math.floor(((e.clientY - r.top) / r.height) * SIZE);
    const p = findPath(m, posRef.current, { x: tx, y: ty });
    if (p) walk(p);
  };

  const move1 = useCallback((dir: Dir) => {
    walkId.current++; setMoving(false);
    setLook(dir);
    const n = step(m, posRef.current, dir);
    if (!n) {
      const it = byFace.get(`${posRef.current.x + (dir === "e" ? 1 : dir === "w" ? -1 : 0)},${posRef.current.y + (dir === "s" ? 1 : dir === "n" ? -1 : 0)}`);
      setBump((b) => b + 1);
      // Bumping into a False Wall cracks it open.
      if (it && it.post.type === "false_wall") { revealFalseWall(it); return; }
      setStatus(it ? `A wall to the ${NAMES[dir]} has something on it: ${label(it.post)}.` : `A solid wall to the ${NAMES[dir]}. You cannot go that way.`);
      return;
    }
    setDetached(false); setPos(n); posRef.current = n;
    setStatus(`Walked ${NAMES[dir]}.`);
  }, [m, byFace, revealFalseWall]);

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, Dir> = { ArrowUp: "n", ArrowDown: "s", ArrowLeft: "w", ArrowRight: "e", w: "n", s: "s", a: "w", d: "e" };
    if (e.key in map) { e.preventDefault(); move1(map[e.key]); }
    if (e.key === "+" || e.key === "=") zoomTo(zoom * 1.2);
    if (e.key === "-" || e.key === "_") zoomTo(zoom / 1.2);
    if ((e.key === "Enter" || e.key === " ") && adjacentItems[0] && e.target === e.currentTarget) { e.preventDefault(); activate(adjacentItems[0]); }
  };

  const recenter = () => { setDetached(false); follow(posRef.current); };
  const base = `/wall/${area}`;
  const qs = (s: number, t = tab) => `${base}?section=${s}${area === "trending" ? `&tab=${t}` : ""}`;
  const door = m.doors[0];
  const rf = revealing ? faceOf(revealing) : null;

  return (
    <div className="relative flex h-[calc(100dvh-var(--dock))] flex-col overflow-hidden bg-[#0c0919]">
      {overlay}
      <header className="relative z-40 shrink-0 bg-night/95 px-3 pb-1.5 pt-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-xl leading-tight" style={{ color: A.accent }}>{A.name}</h1>
            <p className="hidden truncate text-xs text-chalk-dim sm:block">{A.blurb}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Link href="/search" aria-label="Search" className="grid h-10 w-10 place-items-center rounded-xl bg-night-3 text-lg">⌕</Link>
            <div className="relative">
              <button type="button" data-testid="telescope" onClick={() => setZoomOpen((o) => !o)} aria-expanded={zoomOpen} aria-haspopup="true" aria-label="Zoom" className={cx("grid h-10 w-10 place-items-center rounded-xl text-xl", zoomOpen ? "bg-mustard" : "bg-night-3")}><span aria-hidden>🔭</span></button>
              {zoomOpen && (
                <div role="group" aria-label="Zoom" className="absolute right-0 top-12 z-50 w-44 rounded-2xl bg-night-2 p-2 shadow-[0_8px_24px_rgba(0,0,0,.5)] ring-1 ring-night-3">
                  <button type="button" data-testid="zoom-in" onClick={() => zoomTo(zoom * 1.2)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-bold active:bg-night-3"><span aria-hidden className="w-5 text-center text-xl">+</span>Zoom in</button>
                  <button type="button" data-testid="zoom-out" onClick={() => zoomTo(zoom / 1.2)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-bold active:bg-night-3"><span aria-hidden className="w-5 text-center text-xl">−</span>Zoom out</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <nav aria-label="Wall areas" className="scrollbar-none -mx-3 mt-1.5 flex gap-1.5 overflow-x-auto px-3">
          {AREA_ORDER.map((a) => (
            <Link key={a} href={`/wall/${a}`} aria-current={a === area ? "page" : undefined} className={cx("display shrink-0 rounded-full px-3 py-1.5 text-[13px] font-black", a === area ? "text-[#1a1200]" : "bg-night-3 text-chalk")} style={a === area ? { background: AREAS[a].accent } : undefined}>{AREAS[a].name}</Link>
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

        <div ref={viewport} data-testid="wall-viewport" className={cx("relative min-h-0 flex-1 touch-none select-none overflow-hidden outline-none", !ready && "opacity-0")} role="group" aria-label={`${A.name}. Use the arrow keys or the on-screen arrows to walk. Tap a wall to open it. Drag to look around.`} tabIndex={0} onKeyDown={onKey} onPointerDown={onPointerDown}>
          <motion.div data-testid="wall-world" className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ x, y, width: SIZE * TILE, height: SIZE * TILE, scale: zoom }} onClick={onWorldClick}>
            <MazeWorld m={m} area={area} />

            {/* posts and the hidden door, pinned to wall tiles */}
            {items.map((it) => {
              const f = faceOf(it); if (!f) return null;
              const isFalse = it.post.type === "false_wall";
              return (
                <button key={it.post.id} data-wall data-post={it.post.id} data-type={it.post.type} type="button" onClick={() => onItem(it)}
                  className="absolute z-10 block text-left" style={{ left: f.x * TILE, top: f.y * TILE, width: TILE, height: TILE, padding: isFalse ? 8 : 5 }}
                  aria-label={`${POST_TYPES[it.post.type].label}: ${label(it.post)}${it.post.is_sample ? " (sample)" : ""}`}>
                  <WallMarker post={it.post} near={nearIds.has(it.post.id)} />
                  {it.post.is_sample && <span className="absolute -bottom-1 -right-1 z-20 scale-75"><SampleTag /></span>}
                </button>
              );
            })}
            {door && (
              <button data-wall data-door type="button" onClick={onDoor} aria-label="A strange seam in the wall. Tap to look closer."
                className="fw-door absolute z-10 grid place-items-center rounded-t-[26px] rounded-b-sm" style={{ left: door.x * TILE + 12, top: door.y * TILE + 6, width: TILE - 24, height: TILE - 6, background: "linear-gradient(180deg, rgba(8,4,20,.7), rgba(8,4,20,.9))", ["--glow" as string]: A.accent }}>
                <EyeMark color={A.accent} size={13} />
              </button>
            )}

            <PlayerMarker px={px} py={py} color={me?.avatar_color ?? "#F2573F"} look={look} moving={moving} bump={bump} tile={pos} />

            {rf && revealing && (
              <div aria-hidden className="pointer-events-none absolute z-40" style={{ left: rf.x * TILE, top: rf.y * TILE, width: TILE, height: TILE }}>
                <motion.span className="absolute left-1/2 top-1/2 block h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, #fff 0%, #ffe9b0 25%, transparent 70%)" }} initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 9, opacity: 0 }} transition={{ duration: 0.75, ease: "easeOut" }} />
                <motion.span className="absolute inset-0 block rounded-sm" style={{ boxShadow: "inset 0 0 0 3px #fff" }} initial={{ scale: 1, opacity: 1 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.6 }} />
              </div>
            )}

          </motion.div>

          {items.length === 0 && (
            <div className="pointer-events-none absolute inset-x-4 top-3 z-30 rounded-2xl bg-night/90 p-3 text-center">
              <p className="display text-base">{area === "trending" && tab === "trending" ? "Nothing is trending yet" : "This wall is blank"}</p>
              <p className="mt-0.5 text-sm text-chalk-dim">{area === "trending" && tab === "trending" ? "Walls rise here when several different people react and reply. Check Newest, or start a conversation." : "Be the first to put something here."}</p>
            </div>
          )}

          {sectionCount > 1 && (
            <div className="pointer-events-auto absolute right-2 top-2 z-40 flex items-center gap-1 rounded-full bg-night/85 p-1 text-xs backdrop-blur">
              <Link aria-label="Earlier section" aria-disabled={section === 0} tabIndex={section === 0 ? -1 : 0} href={qs(Math.max(0, section - 1))} className={cx("grid h-8 w-8 place-items-center rounded-full bg-night-3 font-bold", section === 0 && "pointer-events-none opacity-40")}>‹</Link>
              <span className="px-1 text-chalk-dim" aria-live="polite">Section {section + 1}/{sectionCount}</span>
              <Link aria-label="Newer section" aria-disabled={section + 1 >= sectionCount} tabIndex={section + 1 >= sectionCount ? -1 : 0} href={qs(section + 1)} className={cx("grid h-8 w-8 place-items-center rounded-full bg-night-3 font-bold", section + 1 >= sectionCount && "pointer-events-none opacity-40")}>›</Link>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-40 flex items-end justify-between px-2.5">
            <div className="pointer-events-auto grid grid-cols-3 gap-[3px] opacity-90" role="group" aria-label="Walk">
              <span /><Pad label="Walk north" glyph="▲" onPress={() => move1("n")} /><span />
              <Pad label="Walk west" glyph="◀" onPress={() => move1("w")} /><Pad label="Walk south" glyph="▼" onPress={() => move1("s")} /><Pad label="Walk east" glyph="▶" onPress={() => move1("e")} />
            </div>
            <div className="pointer-events-auto flex flex-col items-end gap-1.5">
              {adjacentItems[0] && !selected && <Button tone="mustard" size="sm" onClick={() => activate(adjacentItems[0])}>{adjacentItems[0].post.type === "false_wall" ? "Look closer" : "Open this wall"}</Button>}
              <button type="button" data-testid="recenter" onClick={recenter} aria-label="Recenter on your position" className={cx("flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold shadow-[0_3px_0_#0d0b1f]", detached ? "bg-mustard text-[#2c1e02]" : "bg-night/85 text-chalk")}>
                <span aria-hidden>◎</span>Recenter
              </button>
            </div>
          </div>
        </div>

      <p className="sr-only" aria-live="polite">{status}</p>
      {toast && <p role="status" className="fixed inset-x-4 top-24 z-[70] mx-auto max-w-sm rounded-xl bg-mustard px-4 py-3 text-center font-bold text-[#2c1e02]">{toast}</p>}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? POST_TYPES[selected.post.type].label : ""}>
        {selected && <Peek item={selected} loggedIn={loggedIn} go={(h) => { setSelected(null); go(h); }} />}
      </Sheet>
    </div>
  );
}

function Pad({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return <button type="button" aria-label={label} onClick={onPress} className="grid h-10 w-10 place-items-center rounded-xl bg-night/80 text-base text-chalk shadow-[0_3px_0_#0d0b1f] backdrop-blur active:translate-y-0.5">{glyph}</button>;
}

function Peek({ item, loggedIn, go }: { item: Item; loggedIn: boolean; go: (href: string) => void }) {
  const p = item.post;
  const concealed = p.type === "false_wall" || p.type === "hidden_thought";
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
