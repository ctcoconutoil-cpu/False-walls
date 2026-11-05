import { memo } from "react";
import { adventureImage } from "@/lib/adventure/image";
import { TILE, type Point } from "@/lib/maze/layout";
import type { Placed } from "@/lib/maze/adventure";

/**
 * Two kinds of collectible. Easy ones stand on the floor with a glowing ring. Hard ones are hidden INSIDE a wall: from afar that wall tile is the
 * same colour as its neighbours, just a shade lighter; walk close and it shimmers and the object shows through; right beside it, it glows.
 * Neither kind takes clicks or sits on a post, so nothing is blocked.
 */
export const AdventureLayer = memo(function AdventureLayer({ placed, gone, pos, color }: { placed: Placed[]; gone: Set<string>; pos: Point; color: string }) {
  return (
    <>
      {placed.filter((o) => !gone.has(o.id)).map((o) => {
        const dist = Math.max(Math.abs(o.tile.x - pos.x), Math.abs(o.tile.y - pos.y));
        const rare = o.rarity === "rare";
        const glow = rare ? "#7DF9FF" : color;
        const img = adventureImage(o.image_path);
        const art = (size: number) => (img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" width={size} height={size} draggable={false} /> : o.emoji);
        if (!o.inWall) {
          return (
            <div key={o.id} data-collectible={o.id} aria-hidden className="pointer-events-none absolute z-[15] grid place-items-center" style={{ left: o.tile.x * TILE, top: o.tile.y * TILE, width: TILE, height: TILE }}>
              <span className="fw-ring absolute rounded-full" style={{ width: TILE * 0.82, height: TILE * 0.82, border: `2px solid ${glow}`, boxShadow: `0 0 18px 4px ${glow}88, inset 0 0 12px ${color}55` }} />
              <span className="absolute bottom-[14px] block rounded-[50%] bg-black/45" style={{ width: TILE * 0.5, height: 9 }} />
              <span className="fw-float relative grid place-items-center leading-none" style={{ fontSize: 34, filter: `drop-shadow(0 0 7px ${glow})` }}>{art(38)}</span>
              {rare && <span className="fw-twinkle absolute right-2 top-2 text-[13px]">✦</span>}
            </div>
          );
        }
        const near = dist <= 1, close = dist <= 3;
        return (
          <div key={o.id} data-collectible={o.id} data-in-wall aria-hidden className="pointer-events-none absolute z-[15] grid place-items-center overflow-hidden rounded-[3px]"
            style={{
              left: o.tile.x * TILE, top: o.tile.y * TILE, width: TILE, height: TILE,
              background: `rgba(255,255,255,${near ? 0.2 : close ? 0.14 : 0.08})`,
              boxShadow: near ? `inset 0 0 14px 3px ${glow}aa, 0 0 16px 3px ${glow}66` : "inset 0 0 0 1px rgba(255,255,255,0.08)",
              transition: "background .3s, box-shadow .3s",
            }}>
            {close && (
              <span className={near ? "fw-float relative grid place-items-center leading-none" : "relative grid place-items-center leading-none"}
                style={{ fontSize: near ? 30 : 24, opacity: near ? 0.95 : 0.4, filter: near ? `drop-shadow(0 0 7px ${glow})` : "grayscale(1) brightness(1.4)" }}>{art(near ? 34 : 26)}</span>
            )}
            {close && <span className="fw-twinkle absolute left-1 top-1 block h-1.5 w-1.5 rounded-full" style={{ background: glow, boxShadow: `0 0 8px 2px ${glow}` }} />}
            {rare && near && <span className="fw-twinkle absolute right-1 top-0.5 text-[12px]">✦</span>}
          </div>
        );
      })}
    </>
  );
});
