"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabase as createClient } from "@/lib/supabase/browser";
import { compressImage } from "@/lib/client-image";
import { RoomStage } from "@/components/room/RoomStage";
import type { Sel } from "@/components/room/RoomScene";
import { CATALOG, CATEGORIES, CATS, DECOR_KINDS, FRAMES, ROOM_SIZES, THEMES, byKind, footprint, type Cat, type RoomData, type RoomDecor, type RoomItem } from "@/lib/room/catalog";

const WALLS = ["Back", "Right", "Front", "Left"];
const uid = () => crypto.randomUUID();
const btn = "min-h-11 rounded-xl bg-night-3 px-3 text-sm font-bold active:scale-95";
const field = "w-full rounded-xl bg-night-3 px-3 py-2.5 text-base text-chalk";

export function RoomEditor({ initial, userId, username }: { initial: RoomData; userId: string; username: string }) {
  const [data, setData] = useState<RoomData>(initial);
  const [sel, setSel] = useState<Sel>(null);
  const [tab, setTab] = useState<"furniture" | "walls" | "room">("furniture");
  const [cat, setCat] = useState<Cat>("bedroom");
  const [wall, setWall] = useState(0);
  const [kind, setKind] = useState<string>("picture");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dims = ROOM_SIZES[data.size];

  const edit = useCallback((fn: (d: RoomData) => RoomData) => { setData(fn); setDirty(true); setMsg(null); }, []);
  useEffect(() => { if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [dirty]);

  const onItem = useCallback((id: string, p: Partial<RoomItem>) => edit((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })), [edit]);
  const onDecor = useCallback((id: string, p: Partial<RoomDecor>) => edit((d) => ({ ...d, decor: d.decor.map((i) => (i.id === id ? { ...i, ...p } : i)) })), [edit]);

  const selItem = sel?.type === "item" ? data.items.find((i) => i.id === sel.id) : undefined;
  const selDecor = sel?.type === "decor" ? data.decor.find((i) => i.id === sel.id) : undefined;

  const addItem = (k: string) => {
    if (data.items.length >= 60) return setMsg("The room is full. Remove something first.");
    const c = byKind(k)!;
    const base: RoomItem = { id: uid(), kind: k, x: 0, z: 0, rot: 0, scale: 1, link_url: null, note: null };
    const { hx, hz } = footprint(base);
    // Scan the floor for the first spot that is inside the room and not on top of other furniture.
    for (let r = 0; r < 40; r++) for (let a = 0; a < 12; a++) {
      const x = Math.cos((a / 12) * Math.PI * 2) * r * 0.2, z = Math.sin((a / 12) * Math.PI * 2) * r * 0.2;
      if (Math.abs(x) > dims.w / 2 - hx || Math.abs(z) > dims.d / 2 - hz) continue;
      const cand = { ...base, x, z };
      if (c.flat || !data.items.some((o) => !byKind(o.kind)?.flat && Math.abs(o.x - x) < hx + footprint(o).hx && Math.abs(o.z - z) < hz + footprint(o).hz)) {
        edit((d) => ({ ...d, items: [...d.items, cand] })); setSel({ type: "item", id: cand.id }); return;
      }
    }
    setMsg("No free floor space left. Try a bigger room.");
  };

  const addDecor = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    try {
      const sb = createClient();
      for (const f of Array.from(files).slice(0, 6)) {
        if (data.decor.length >= 40) { setMsg("The walls are full."); break; }
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setMsg("Use a JPG, PNG or WebP picture."); continue; }
        const small = await compressImage(f, 1400, 0.82);
        if (small.size > 3 * 1024 * 1024) { setMsg("That picture is too large (3 MB max)."); continue; }
        const bmp = await createImageBitmap(small); const ar = bmp.width / bmp.height; bmp.close?.();
        const path = `${userId}/${uid()}.${small.type === "image/webp" ? "webp" : small.type === "image/png" ? "png" : "jpg"}`;
        const { error } = await sb.storage.from("room-images").upload(path, small, { contentType: small.type });
        if (error) { setMsg("The upload failed. Check your connection and try again."); continue; }
        const w = ar >= 1 ? 1 : Math.max(0.4, 1.1 * ar), h = ar >= 1 ? Math.max(0.4, 1 / ar) : 1.1;
        const nd: RoomDecor = { id: uid(), wall, u: ((Math.random() - 0.5) * 0.8), v: dims.h * 0.55, w, h, rot: 0, frame: "wood", z_index: data.decor.length, image_path: path, kind, title: null, link_url: null, note: null };
        edit((d) => ({ ...d, decor: [...d.decor, nd] })); setSel({ type: "decor", id: nd.id });
      }
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const addBoard = () => {
    const nd: RoomDecor = { id: uid(), wall, u: 0, v: dims.h * 0.55, w: 1.2, h: 0.8, rot: 0, frame: "wood", z_index: data.decor.length, image_path: null, kind: "noticeboard", title: "Noticeboard", link_url: null, note: "Pin a message here." };
    edit((d) => ({ ...d, decor: [...d.decor, nd] })); setSel({ type: "decor", id: nd.id });
  };

  const remove = () => {
    if (selItem) edit((d) => ({ ...d, items: d.items.filter((i) => i.id !== selItem.id) }));
    if (selDecor) edit((d) => ({ ...d, decor: d.decor.filter((i) => i.id !== selDecor.id) }));
    setSel(null);
  };
  const rotate = (by: number) => { if (selItem) onItem(selItem.id, { rot: selItem.rot + by }); if (selDecor) onDecor(selDecor.id, { rot: Math.max(-0.8, Math.min(0.8, selDecor.rot + by)) }); };
  const resize = (f: number) => {
    if (selItem) onItem(selItem.id, { scale: Math.max(0.4, Math.min(2.5, +(selItem.scale * f).toFixed(2))) });
    if (selDecor) onDecor(selDecor.id, { w: Math.max(0.2, Math.min(4, +(selDecor.w * f).toFixed(2))), h: Math.max(0.2, Math.min(4, +(selDecor.h * f).toFixed(2))) });
  };
  const order = (by: number) => selDecor && onDecor(selDecor.id, { z_index: Math.max(0, selDecor.z_index + by) });
  const patch = (p: { link_url?: string | null; note?: string | null; title?: string | null }) => { if (selItem) onItem(selItem.id, p as Partial<RoomItem>); if (selDecor) onDecor(selDecor.id, p); };

  const save = async () => {
    setBusy(true); setMsg(null);
    const { error } = await createClient().rpc("save_room", { p_room: data });
    setBusy(false);
    if (error) return setMsg(/room_full/.test(error.message) ? "Too many objects in this room." : /rate/i.test(error.message) ? "Slow down a little, then save again." : "Couldn’t save. Check the links you added start with https://.");
    setDirty(false); setMsg("Saved");
  };

  const share = async () => {
    const url = `${location.origin}/@${username}`;
    try { if (navigator.share) await navigator.share({ title: data.name, url }); else { await navigator.clipboard.writeText(url); setMsg("Link copied"); } } catch { /* cancelled */ }
  };

  return (
    <div className="flex h-dvh flex-col bg-night pb-[76px]">
      <header className="flex items-center gap-2 px-3 py-2">
        <Link href="/profile" className="grid h-11 w-11 place-items-center rounded-full bg-night-2 text-lg" aria-label="Back">‹</Link>
        <input aria-label="Room name" value={data.name} maxLength={40} onChange={(e) => edit((d) => ({ ...d, name: e.target.value }))} className="min-w-0 flex-1 bg-transparent text-xl font-black" />
        <button type="button" className={btn} onClick={() => setReset((n) => n + 1)} aria-label="Reset camera">⟲</button>
        <button type="button" className={btn} onClick={share}>Share</button>
        <button type="button" disabled={busy || !dirty} onClick={save} className="min-h-11 rounded-xl bg-mustard px-4 text-sm font-black text-[#2c1e02] disabled:opacity-50">{busy ? "…" : dirty ? "Save" : "Saved"}</button>
      </header>
      <div className="relative min-h-0 flex-1">
        <RoomStage data={data} editable sel={sel} onSelect={setSel} onItem={onItem} onDecor={onDecor} resetKey={reset} />
        {msg && <p role="status" className="absolute left-3 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">{msg}</p>}
      </div>

      <section className="max-h-[44dvh] overflow-y-auto rounded-t-3xl bg-night-2 p-3" aria-label="Room tools">
        {(selItem || selDecor) ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2"><strong className="flex-1 text-lg">{selItem ? byKind(selItem.kind)?.name : "Wall decoration"}</strong><button type="button" className={btn} onClick={() => setSel(null)}>Done</button></div>
            <div className="grid grid-cols-5 gap-2">
              <button type="button" className={btn} onClick={() => rotate(-Math.PI / 12)} aria-label="Rotate left">↺</button>
              <button type="button" className={btn} onClick={() => rotate(Math.PI / 12)} aria-label="Rotate right">↻</button>
              <button type="button" className={btn} onClick={() => resize(0.9)} aria-label="Smaller">－</button>
              <button type="button" className={btn} onClick={() => resize(1.1)} aria-label="Larger">＋</button>
              <button type="button" className={`${btn} !bg-[#E51F2B] text-white`} onClick={remove} aria-label="Remove">🗑</button>
            </div>
            {selDecor && (
              <>
                <div className="flex flex-wrap gap-2">
                  {FRAMES.map((f) => <button key={f} type="button" aria-pressed={selDecor.frame === f} onClick={() => onDecor(selDecor.id, { frame: f })} className={`${btn} ${selDecor.frame === f ? "!bg-mustard text-[#2c1e02]" : ""}`}>{f === "none" ? "No frame" : f}</button>)}
                  <button type="button" className={btn} onClick={() => order(1)}>Bring forward</button>
                  <button type="button" className={btn} onClick={() => order(-1)}>Send back</button>
                </div>
                <input aria-label="Title" className={field} placeholder="Title (artist, film, place…)" maxLength={60} value={selDecor.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
              </>
            )}
            <input aria-label="Link" className={field} type="url" inputMode="url" placeholder={(selItem && byKind(selItem.kind)?.hint) || "Link (https://…) visitors can open"} value={(selItem ?? selDecor)?.link_url ?? ""} onChange={(e) => patch({ link_url: e.target.value })} />
            <textarea aria-label="Note" className={field} rows={2} maxLength={240} placeholder="A note visitors see when they tap it" value={(selItem ?? selDecor)?.note ?? ""} onChange={(e) => patch({ note: e.target.value })} />
          </div>
        ) : (
          <>
            <div role="tablist" className="mb-3 grid grid-cols-3 gap-2">
              {([["furniture", "Furniture"], ["walls", "Walls"], ["room", "Room"]] as const).map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`${btn} ${tab === id ? "!bg-mustard text-[#2c1e02]" : ""}`}>{l}</button>)}
            </div>
            {tab === "furniture" && (
              <>
                <div className="mb-2 flex gap-2 overflow-x-auto">{CATS.map((c) => <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} className={`${btn} shrink-0 ${cat === c.id ? "!bg-chalk text-night" : ""}`}>{c.label}</button>)}</div>
                <ul className="grid grid-cols-3 gap-2">
                  {CATALOG.filter((i) => i.cat === cat).map((i) => (
                    <li key={i.kind}><button type="button" onClick={() => addItem(i.kind)} className="flex h-full w-full flex-col items-center gap-1 rounded-2xl bg-night-3 p-2 text-center active:scale-95">
                      <span aria-hidden className="grid h-12 w-12 place-items-center rounded-xl text-3xl" style={{ background: i.parts[0].c + "55" }}>{i.emoji}</span>
                      <span className="text-xs font-bold leading-tight">{i.name}</span><span className="text-[10px] text-chalk-dim">{i.size[0]}×{i.size[2]} m</span>
                    </button></li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-chalk-dim">Tap to add, then drag it across the floor. Wall decorations are in the Walls tab.</p>
              </>
            )}
            {tab === "walls" && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">{WALLS.map((n, i) => <button key={n} type="button" aria-pressed={wall === i} onClick={() => setWall(i)} className={`${btn} ${wall === i ? "!bg-chalk text-night" : ""}`}>{n}</button>)}</div>
                <p className="text-xs text-chalk-dim">Turn the room with one finger to see the {WALLS[wall].toLowerCase()} wall. Pictures go on the wall you pick.</p>
                <select aria-label="What are you adding" value={kind} onChange={(e) => setKind(e.target.value)} className={field}>{DECOR_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addDecor(e.target.files)} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="min-h-12 rounded-xl bg-mustard font-black text-[#2c1e02] disabled:opacity-50">{busy ? "Uploading…" : "＋ Add pictures"}</button>
                  <button type="button" onClick={addBoard} className="min-h-12 rounded-xl bg-night-3 font-bold">＋ Noticeboard</button>
                </div>
                <p className="text-xs text-chalk-dim">Only post pictures you took or have permission to share. {data.decor.length}/40 on your walls.</p>
              </div>
            )}
            {tab === "room" && (
              <div className="space-y-3">
                <div><p className="mb-1 text-sm font-bold">Size</p><div className="grid grid-cols-3 gap-2">{(Object.keys(ROOM_SIZES) as (keyof typeof ROOM_SIZES)[]).map((s) => <button key={s} type="button" aria-pressed={data.size === s} onClick={() => edit((d) => ({ ...d, size: s }))} className={`${btn} ${data.size === s ? "!bg-mustard text-[#2c1e02]" : ""}`}>{ROOM_SIZES[s].label}<span className="block text-[10px] font-normal">{ROOM_SIZES[s].w}×{ROOM_SIZES[s].d} m</span></button>)}</div></div>
                <div><p className="mb-1 text-sm font-bold">Colours</p><div className="flex flex-wrap gap-2">{(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((t) => <button key={t} type="button" aria-pressed={data.theme === t} onClick={() => edit((d) => ({ ...d, theme: t }))} className={`${btn} flex items-center gap-2 ${data.theme === t ? "ring-2 ring-mustard" : ""}`}><span aria-hidden className="h-5 w-5 rounded-full" style={{ background: THEMES[t].wall }} />{THEMES[t].label}</button>)}</div></div>
                <label className="block text-sm font-bold">Main interest<select value={data.category ?? ""} onChange={(e) => edit((d) => ({ ...d, category: e.target.value || null }))} className={`${field} mt-1 capitalize`}><option value="">None</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                <label className="block text-sm font-bold">Who can visit<select value={data.visibility} onChange={(e) => edit((d) => ({ ...d, visibility: e.target.value as RoomData["visibility"] }))} className={`${field} mt-1`}><option value="public">Everyone</option><option value="private">Only me</option></select></label>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
