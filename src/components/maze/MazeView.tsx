"use client";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, useMotionValue, motion, useReducedMotion } from "framer-motion";
import { AREAS, AREA_ORDER, POST_TYPES, TYPE_TO_ROUTE } from "@/lib/constants";
import { SIZE, TILE, buildSection, findPath, standingTile, step, type Dir, type MazeSection, type Point } from "@/lib/maze/layout";
import type { AreaSlug, AuthorLite, Post } from "@/lib/types";
import { Avatar, AvatarArt, Button, SampleTag, Sheet } from "@/components/ui";
import { WallItem } from "./WallItem";
import { RevealPanel } from "@/components/wall/RevealPanel";
import { useCurtainNav } from "./Curtain";
import { recordDiscovery } from "@/lib/actions/posts";
import { cx, timeAgo } from "@/lib/utils";

type Item = { slot: number; post: Post };
type Props = {
  area: AreaSlug; section: number; sectionCount: number; items: Item[]; tab: "trending" | "newest";
  loggedIn: boolean; me: AuthorLite | null;
};

const textureFor = (a: AreaSlug) => (a === "picture" ? "wall-tile" : a === "hidden" || a === "trending" ? "wall-slab" : "wall-brick");

const Walls = memo(function Walls({ m, byFace, areaSlug, onItem, onDoor }: {
  m: MazeSection; byFace: Map<string, Item>; areaSlug: AreaSlug; onItem: (i: Item) => void; onDoor: () => void;
}) {
  const A = AREAS[areaSlug];
  const door = m.doors[0];
  const out: React.ReactNode[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!m.walls[y][x]) continue;
    const item = byFace.get(`${x},${y}`);
    const isDoor = door && door.x === x && door.y === y;
    out.push(
      <div key={`${x},${y}`} className={cx("wall wall-tile3d absolute", textureFor(areaSlug))}
        style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE, ["--wall" as string]: A.wall, ["--mortar" as string]: A.mortar, ["--face" as string]: `color-mix(in srgb, ${A.wall} 60%, #000)` }}>
        {item && (
          <button data-wall type="button" onClick={() => onItem(item)} className="absolute inset-[9px] z-10 block text-left" aria-label={`${POST_TYPES[item.post.type].label}: ${item.post.title ?? item.post.clue ?? item.post.body ?? "wall"}${item.post.is_sample ? " (sample)" : ""}`}>
            <WallItem post={item.post} />
            {item.post.is_sample && <span className="absolute -bottom-1 -right-1 z-20"><SampleTag /></span>}
          </button>
        )}
        {isDoor && (
          <button data-wall type="button" onClick={onDoor} className="absolute inset-[10px] z-10 grid place-items-center rounded-t-[40px] rounded-b-md" aria-label="A strange seam in the wall. Tap to look closer." style={{ background: "linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.55))", boxShadow: `inset 0 0 0 2px ${A.accent}55` }}>
            <span aria-hidden className="absolute right-3 top-1/2 h-2.5 w-2.5 rounded-full" style={{ background: A.accent, boxShadow: `0 0 12px 3px ${A.accent}` }} />
          </button>
        )}
      </div>,
    );
  }
  return <>{out}</>;
});

export function MazeView({ area, section, sectionCount, items, tab, loggedIn, me }: Props) {
  const reduce = useReducedMotion();
  const A = AREAS[area];
  const m = useMemo(() => buildSection(area, section), [area, section]);
  const byFace = useMemo(() => {
    const map = new Map<string, Item>();
    items.forEach((it) => { const f = m.faces[it.slot % m.faces.length]; if (f) map.set(`${f.x},${f.y}`, it); });
    return map;
  }, [items, m]);
  const faceOf = useMemo(() => {
    const map = new Map<string, { x: number; y: number; dir: Dir }>();
    m.faces.forEach((f) => map.set(`${f.x},${f.y}`, f));
    m.doors.forEach((d) => map.set(`${d.x},${d.y}`, d));
    return map;
  }, [m]);

  const viewport = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 360, h: 640 });
  const zoom = vp.w < 480 ? 0.8 : 1;
  const [pos, setPos] = useState<Point>(m.start);
  const posRef = useRef(pos);
  const [flip, setFlip] = useState(false);
  const [moving, setMoving] = useState(false);
  const [detached, setDetached] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);
  const [listMode, setListMode] = useState(false);
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const dragged = useRef(false);
  const walkId = useRef(0);
  const { go, overlay } = useCurtainNav();

  useEffect(() => { try { setListMode(localStorage.getItem("fw-list-mode") === "1"); } catch { /* ignore */ } }, []);
  useEffect(() => {
    const el = viewport.current; if (!el) return;
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setVp({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [listMode]);
  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { setPos(m.start); setDetached(false); setSelected(null); walkId.current++; }, [m]);

  // First visit to an area counts toward the Explorer badge.
  useEffect(() => { if (loggedIn) void recordDiscovery("area_visited", area); }, [area, loggedIn]);

  const W = SIZE * TILE * zoom;
  const clamp = useCallback((cx_: number, cy_: number) => ({
    x: W <= vp.w ? (vp.w - W) / 2 : Math.min(60, Math.max(vp.w - W - 60, cx_)),
    y: W <= vp.h ? (vp.h - W) / 2 : Math.min(90, Math.max(vp.h - W - 90, cy_)),
  }), [W, vp.w, vp.h]);
  const follow = useCallback((p: Point, instant = false) => {
    const c = clamp(vp.w / 2 - (p.x + 0.5) * TILE * zoom, vp.h * 0.46 - (p.y + 0.5) * TILE * zoom);
    if (instant || reduce) { x.set(c.x); y.set(c.y); }
    else { animate(x, c.x, { duration: 0.2, ease: "linear" }); animate(y, c.y, { duration: 0.2, ease: "linear" }); }
  }, [clamp, vp.w, vp.h, zoom, reduce, x, y]);
  useEffect(() => { if (!detached) follow(pos); }, [pos, detached, follow]);
  useEffect(() => { follow(m.start, true); }, [m, vp.w, vp.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((t: string) => { setToast(t); window.setTimeout(() => setToast(null), 2600); }, []);

  const walk = useCallback((path: Point[], then?: () => void) => {
    const id = ++walkId.current;
    if (!path.length) { then?.(); return; }
    setDetached(false); setMoving(true);
    let i = 0;
    const tick = () => {
      if (id !== walkId.current) return;
      if (i >= path.length) { setMoving(false); then?.(); return; }
      const p = path[i++];
      setFlip(p.x < posRef.current.x ? true : p.x > posRef.current.x ? false : false);
      setPos(p); posRef.current = p;
      window.setTimeout(tick, reduce ? 50 : 130);
    };
    tick();
  }, [reduce]);

  const adjacentItems = useMemo(() => {
    const out: Item[] = [];
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const it = byFace.get(`${pos.x + dx},${pos.y + dy}`); if (it) out.push(it); }
    return out;
  }, [pos, byFace]);

  const openItem = useCallback((it: Item) => { setSelected(it); }, []);
  const onItem = useCallback((it: Item) => {
    if (dragged.current) return;
    const f = faceOf.get(`${m.faces[it.slot % m.faces.length].x},${m.faces[it.slot % m.faces.length].y}`)!;
    const stand = standingTile(m, f);
    const p = findPath(m, posRef.current, stand);
    if (!p) { openItem(it); return; }
    walk(p, () => openItem(it));
  }, [faceOf, m, walk, openItem]);

  const onDoor = useCallback(() => {
    if (dragged.current) return;
    const d = m.doors[0]; if (!d) return;
    const p = findPath(m, posRef.current, standingTile(m, d));
    const arrive = async () => {
      if (loggedIn) await recordDiscovery("door_found", d.key);
      showToast(`You found a hidden door. It leads to the ${AREAS[d.to].name}.`);
      window.setTimeout(() => go(`/maze/${d.to}`), 900);
    };
    if (!p) void arrive(); else walk(p, () => void arrive());
  }, [m, walk, loggedIn, showToast, go]);

  // Drag to look around. Taps (movement under 6px) walk the avatar instead.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragged.current = false;
    const sx = e.clientX, sy = e.clientY, ox = x.get(), oy = y.get();
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!dragged.current && Math.hypot(dx, dy) < 6) return;
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
    const n = step(m, posRef.current, dir);
    const names = { n: "north", e: "east", s: "south", w: "west" };
    if (!n) {
      const it = byFace.get(`${posRef.current.x + (dir === "e" ? 1 : dir === "w" ? -1 : 0)},${posRef.current.y + (dir === "s" ? 1 : dir === "n" ? -1 : 0)}`);
      setStatus(it ? `A wall to the ${names[dir]} has something on it: ${it.post.title ?? it.post.clue ?? "a note"}.` : `A blank wall to the ${names[dir]}.`);
      return;
    }
    if (dir === "w") setFlip(true); if (dir === "e") setFlip(false);
    setDetached(false); setPos(n); posRef.current = n;
    setStatus(`Walked ${names[dir]}.`);
  }, [m, byFace]);

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, Dir> = { ArrowUp: "n", ArrowDown: "s", ArrowLeft: "w", ArrowRight: "e", w: "n", s: "s", a: "w", d: "e" };
    if (e.key in map) { e.preventDefault(); move1(map[e.key]); }
    if ((e.key === "Enter" || e.key === " ") && adjacentItems[0] && e.target === e.currentTarget) { e.preventDefault(); openItem(adjacentItems[0]); }
  };

  const setList = (v: boolean) => { setListMode(v); try { localStorage.setItem("fw-list-mode", v ? "1" : "0"); } catch { /* ignore */ } };
  const avatarUser = me ?? { username: "guest", display_name: null, avatar_style: "blob", avatar_color: "#F2573F", avatar_url: null };
  const base = `/maze/${area}`;
  const qs = (s: number, t = tab) => `${base}?section=${s}${area === "trending" ? `&tab=${t}` : ""}`;

  return (
    <div className="relative flex h-[calc(100dvh-var(--dock))] flex-col overflow-hidden" style={{ background: A.floor }}>
      {overlay}
      <header className="relative z-40 shrink-0 bg-night/92 px-3 pb-2 pt-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-2xl" style={{ color: A.accent }}>{A.name}</h1>
            <p className="truncate text-xs text-chalk-dim">{A.blurb}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Link href="/search" aria-label="Search" className="grid h-11 w-11 place-items-center rounded-xl bg-night-3 text-lg">⌕</Link>
            <button onClick={() => setList(!listMode)} aria-pressed={listMode} className="min-h-11 rounded-xl bg-night-3 px-3 text-sm font-bold">{listMode ? "Maze view" : "List view"}</button>
          </div>
        </div>
        <nav aria-label="Maze areas" className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto px-3">
          {AREA_ORDER.map((a) => (
            <Link key={a} href={`/maze/${a}`} aria-current={a === area ? "page" : undefined} className={cx("display shrink-0 rounded-full px-3.5 py-2 text-sm font-black", a === area ? "text-[#1a1200]" : "bg-night-3 text-chalk")} style={a === area ? { background: AREAS[a].accent } : undefined}>{AREAS[a].name}</Link>
          ))}
        </nav>
        {area === "trending" && (
          <div role="tablist" aria-label="Trending or newest" className="mt-2 flex gap-1.5">
            {(["trending", "newest"] as const).map((t) => (
              <Link key={t} role="tab" aria-selected={tab === t} href={`${base}?tab=${t}`} className={cx("rounded-lg px-3 py-1.5 text-sm font-bold", tab === t ? "bg-chalk text-night" : "bg-night-3")}>{t === "trending" ? "Trending" : "Newest"}</Link>
            ))}
          </div>
        )}
      </header>

      {listMode ? (
        <ListView items={items} area={area} door={m.doors[0]} onItem={openItem} onDoor={onDoor} tab={tab} />
      ) : (
        <div ref={viewport} className="relative min-h-0 flex-1 touch-none select-none overflow-hidden outline-none" role="group" aria-label={`${A.name} maze. Use the arrow keys or the on-screen arrows to walk. Tap a wall to open it.`} tabIndex={0} onKeyDown={onKey} onPointerDown={onPointerDown}>
          <motion.div className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ x, y, width: SIZE * TILE, height: SIZE * TILE, scale: zoom }} onClick={onWorldClick}>
            <div className="floor absolute inset-0" style={{ ["--floor" as string]: A.floor }} />
            <Walls m={m} byFace={byFace} areaSlug={area} onItem={onItem} onDoor={onDoor} />
            <div aria-hidden className="pointer-events-none absolute z-30" style={{ left: pos.x * TILE, top: pos.y * TILE, width: TILE, height: TILE, transition: reduce ? "none" : "left .13s linear, top .13s linear" }}>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(-50%, -50%) scaleX(${flip ? -1 : 1})` }}>
                <motion.div animate={moving && !reduce ? { y: [0, -6, 0] } : { y: 0 }} transition={{ repeat: moving ? Infinity : 0, duration: 0.26 }} className="overflow-hidden rounded-full shadow-[0_6px_0_rgba(0,0,0,.35)]" style={{ width: 56, height: 56, outline: "3px solid #f3f2fb" }}>
                  {me ? <Avatar user={me} size={56} /> : <AvatarArt style="blob" color="#F2573F" size={56} />}
                </motion.div>
              </div>
            </div>
          </motion.div>

          {items.length === 0 && (
            <div className="pointer-events-none absolute inset-x-4 top-4 z-30 rounded-2xl bg-night/90 p-4 text-center">
              <p className="display text-lg">{area === "trending" && tab === "trending" ? "Nothing is trending yet" : "This wall is blank"}</p>
              <p className="mt-1 text-sm text-chalk-dim">{area === "trending" && tab === "trending" ? "Walls rise here when several different people react and reply. Check Newest, or start a conversation." : "Be the first to put something here."}</p>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex items-end justify-between px-3">
            <div className="pointer-events-auto grid grid-cols-3 gap-1" role="group" aria-label="Walk">
              <span /><Pad label="Walk north" glyph="▲" onPress={() => move1("n")} /><span />
              <Pad label="Walk west" glyph="◀" onPress={() => move1("w")} /><Pad label="Walk south" glyph="▼" onPress={() => move1("s")} /><Pad label="Walk east" glyph="▶" onPress={() => move1("e")} />
            </div>
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              {detached && <Button tone="ghost" size="sm" onClick={() => { setDetached(false); follow(posRef.current); }}>Recenter</Button>}
              {adjacentItems[0] && !selected && <Button tone="mustard" size="sm" onClick={() => openItem(adjacentItems[0])}>Open this wall</Button>}
            </div>
          </div>
        </div>
      )}

      <footer className="relative z-40 flex shrink-0 items-center justify-center gap-2 bg-night/92 px-3 py-2 text-sm">
        <Link aria-disabled={section === 0} tabIndex={section === 0 ? -1 : 0} href={qs(Math.max(0, section - 1))} className={cx("min-h-11 rounded-xl bg-night-3 px-4 py-2.5 font-bold", section === 0 && "pointer-events-none opacity-40")}>‹ Earlier</Link>
        <span className="min-w-28 text-center text-chalk-dim" aria-live="polite">Section {section + 1} of {sectionCount}</span>
        <Link aria-disabled={section + 1 >= sectionCount} tabIndex={section + 1 >= sectionCount ? -1 : 0} href={qs(section + 1)} className={cx("min-h-11 rounded-xl bg-night-3 px-4 py-2.5 font-bold", section + 1 >= sectionCount && "pointer-events-none opacity-40")}>Newer ›</Link>
      </footer>

      <p className="sr-only" aria-live="polite">{status}</p>
      {toast && <p role="status" className="fixed inset-x-4 top-24 z-[70] mx-auto max-w-sm rounded-xl bg-mustard px-4 py-3 text-center font-bold text-[#2c1e02]">{toast}</p>}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? POST_TYPES[selected.post.type].label : ""}>
        {selected && <Peek item={selected} loggedIn={loggedIn} go={(h) => { setSelected(null); go(h); }} />}
      </Sheet>
    </div>
  );
}

function Pad({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return <button type="button" aria-label={label} onClick={onPress} className="grid h-12 w-12 place-items-center rounded-xl bg-night/85 text-lg text-chalk shadow-[0_3px_0_#0d0b1f] active:translate-y-0.5">{glyph}</button>;
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

function ListView({ items, area, door, onItem, onDoor, tab }: { items: Item[]; area: AreaSlug; door?: { to: AreaSlug }; onItem: (i: Item) => void; onDoor: () => void; tab: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-night px-3 py-3">
      <p className="mb-3 text-sm text-chalk-dim">Every wall in this section, as a plain list. Choose one to open it.</p>
      {items.length === 0 && <p className="rounded-xl border-2 border-dashed border-night-3 p-6 text-center text-chalk-dim">{area === "trending" && tab === "trending" ? "Nothing is trending yet. Try the Newest tab." : "No walls in this section yet."}</p>}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.post.id}>
            <button onClick={() => onItem(it)} className="flex w-full items-center gap-3 rounded-2xl bg-night-2 p-3 text-left">
              <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl font-black text-[#1a1200]" style={{ background: AREAS[area].accent }}>{POST_TYPES[it.post.type].icon}</span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wide text-chalk-dim">{POST_TYPES[it.post.type].label}{it.post.is_sample ? " · sample" : ""}</span>
                <span className="block truncate font-semibold">{it.post.title ?? it.post.clue ?? it.post.body}</span>
              </span>
            </button>
          </li>
        ))}
        {door && (
          <li><button onClick={onDoor} className="w-full rounded-2xl border-2 border-dashed border-night-3 p-3 text-left text-chalk-dim">A strange seam in the wall. Look closer.</button></li>
        )}
      </ul>
      <p className="mt-4 text-center text-xs text-chalk-dim"><Link href={`/create`} className="underline">Put something on the wall</Link></p>
    </div>
  );
}

export { TYPE_TO_ROUTE };
