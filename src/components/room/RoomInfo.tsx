"use client";
import { byKind, roomImageUrl, type RoomDecor, type RoomItem } from "@/lib/room/catalog";

/** What a visitor sees after tapping an object: the picture, its title, a note and the owner's link. */
export function RoomInfo({ target, onClose }: { target: { type: "item"; v: RoomItem } | { type: "decor"; v: RoomDecor } | null; onClose: () => void }) {
  if (!target) return null;
  const v = target.v;
  const title = target.type === "item" ? byKind(target.v.kind)?.name : target.v.title || "Wall decoration";
  const img = target.type === "decor" ? roomImageUrl(target.v.image_path) : null;
  if (!v.link_url && !v.note && !img) return null;
  return (
    <div role="dialog" aria-label={title} className="absolute inset-x-3 bottom-3 z-20 max-h-[60%] overflow-y-auto rounded-3xl bg-night-2 p-4 shadow-2xl ring-1 ring-white/10">
      <div className="flex items-start gap-2"><h2 className="flex-1 text-xl">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-night-3 font-black">✕</button></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {img && <a href={img} target="_blank" rel="noreferrer"><img src={img} alt={title ?? ""} className="mt-3 max-h-64 w-full rounded-2xl object-contain" /></a>}
      {v.note && <p className="mt-3 whitespace-pre-line text-chalk">{v.note}</p>}
      {v.link_url && <a href={v.link_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-mustard px-5 font-black text-[#2c1e02]">Open link ↗</a>}
    </div>
  );
}
