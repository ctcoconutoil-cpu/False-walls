import { memo } from "react";
import { adventureImage } from "@/lib/adventure/image";
import { TILE, type Point } from "@/lib/maze/layout";
import type { Placed } from "@/lib/maze/adventure";

/** Collectibles standing in the maze: a small plinth, a pulsing ring and the object floating above it. They never take clicks. */
export const AdventureLayer = memo(function AdventureLayer({ placed, gone, pos, color }: { placed: Placed[]; gone: Set<string>; pos: Point; color: string }) {
  return (
    <>
      {placed.filter((o) => !gone.has(o.id)).map((o) => {
        const dist = Math.max(Math.abs(o.tile.x - pos.x), Math.abs(o.tile.y - pos.y));
        const hiddenFar = o.visibility === "hidden" && dist > 3;
        const rare = o.rarity === "rare";
        const img = adventureImage(o.image_path);
        return (
          <div key={o.id} data-collectible={o.id} aria-hidden className="pointer-events-none absolute z-[15] grid place-items-center"
            style={{ left: o.tile.x * TILE, top: o.tile.y * TILE, width: TILE, height: TILE }}>
            {hiddenFar ? (
              <span className="fw-twinkle block h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px 3px ${color}` }} />
            ) : (
              <>
                <span className="fw-ring absolute rounded-full" style={{ width: TILE * 0.82, height: TILE * 0.82, border: `2px solid ${rare ? "#7DF9FF" : color}`, boxShadow: `0 0 18px 4px ${rare ? "#7DF9FF88" : color + "88"}, inset 0 0 12px ${color}55` }} />
                <span className="absolute bottom-[14px] block rounded-[50%] bg-black/45" style={{ width: TILE * 0.5, height: 9 }} />
                <span className="fw-float relative grid place-items-center leading-none" style={{ fontSize: 34, filter: `drop-shadow(0 0 7px ${rare ? "#7DF9FF" : color})` }}>
                  {img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" width={38} height={38} draggable={false} /> : o.emoji}
                </span>
                {rare && <span className="fw-twinkle absolute right-2 top-2 text-[13px]">✦</span>}
              </>
            )}
          </div>
        );
      })}
    </>
  );
});
