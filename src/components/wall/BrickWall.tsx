import type { CSSProperties } from "react";
import { WALL_COLORS, iconFor } from "@/lib/constants";
import type { Post } from "@/lib/types";

/** Eight hand-drawn brick pieces; each wall gets a stable one so a row of walls never looks copy-pasted. */
export const brickFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 8) + 1;
};

/**
 * One wall: the brick piece with its owner's icon pinned in the middle. Picture walls pin the photo instead.
 * A False Wall looks like any other wall, apart from a faint glowing crack.
 */
export function BrickWall({ post, big = false }: { post: Post; big?: boolean }) {
  const c = WALL_COLORS[post.wall_color] ?? WALL_COLORS.coral;
  const photo = post.type === "picture" ? post.media[0]?.url : undefined;
  const isFalse = post.type === "false_wall";
  return (
    <div className="fw-false relative aspect-[377/257] w-full" data-near="0" style={{ ["--glow" as string]: c.base } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/wall/brick-${brickFor(post.id)}.webp`} alt="" draggable={false} decoding="async" className="absolute inset-0 h-full w-full select-none object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,.45)]" />
      {isFalse && (
        <svg aria-hidden viewBox="0 0 100 68" className="absolute inset-0 h-full w-full">
          <path className="fw-crack-dark" d="M54 4 48 18 57 30 47 43 58 56 52 66" fill="none" stroke="#0b0716" strokeWidth="2.6" strokeLinejoin="round" opacity=".55" />
          <path className="fw-crack" d="M54 4 48 18 57 30 47 43 58 56 52 66" fill="none" stroke={c.base} strokeWidth="1" strokeLinejoin="round" />
        </svg>
      )}
      <div className="absolute inset-0 grid place-items-center">
        {photo ? (
          <span className="paper block overflow-hidden rounded-[3px] bg-[#fbf9f2] p-[3px] pb-2 shadow-lg" style={{ width: "40%", transform: "rotate(-3deg)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={post.media[0].alt_text ?? post.title ?? "Picture on the wall"} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
          </span>
        ) : (
          <span aria-hidden className={`grid place-items-center rounded-full bg-[#14112a]/80 leading-none shadow-[0_0_0_2px_rgba(255,255,255,.18)] backdrop-blur-[1px] ${big ? "h-[34%] w-[24%] text-[clamp(26px,9vw,46px)]" : "h-[44%] w-[32%] text-[22px]"}`} style={{ aspectRatio: "1" }}>
            {iconFor(post)}
          </span>
        )}
      </div>
    </div>
  );
}
