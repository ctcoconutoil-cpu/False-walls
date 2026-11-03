import type { CSSProperties } from "react";
import { POST_TYPES, WALL_COLORS } from "@/lib/constants";
import type { Post } from "@/lib/types";

function tilt(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 7) - 3) * 1.1;
}

/** A small almond-shaped eye: the False Wall signature. */
export function EyeMark({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 14" width={size} height={size * 0.58} className="fw-eye">
      <path d="M1 7C5 1.5 19 1.5 23 7 19 12.5 5 12.5 1 7Z" fill="#0b0716" stroke={color} strokeWidth="1.4" />
      <circle cx="12" cy="7" r="3.2" fill={color} />
      <circle cx="12" cy="7" r="1.3" fill="#0b0716" />
    </svg>
  );
}

/**
 * What a post looks like pinned in the corridor. Ordinary posts are small paper pieces on a normal wall.
 * A False Wall has no paper at all: it is the wall itself, with a faint glowing crack and a small eye.
 */
export function WallMarker({ post, near }: { post: Post; near: boolean }) {
  const c = WALL_COLORS[post.wall_color] ?? WALL_COLORS.coral;
  if (post.type === "false_wall") return <FalseWall post={post} near={near} />;

  const style: CSSProperties = { transform: `rotate(${tilt(post.id)}deg)` };
  if (post.type === "hidden_thought") {
    return (
      <div className="paper tape relative flex h-full w-full flex-col justify-center gap-1 rounded-[3px] bg-[#FFE98A] p-1.5" style={style}>
        <i className="h-1.5 w-full rounded-sm bg-[#2b2200]" /><i className="h-1.5 w-3/4 rounded-sm bg-[#2b2200]" /><i className="h-1.5 w-5/6 rounded-sm bg-[#2b2200]" />
      </div>
    );
  }
  if (post.type === "picture") {
    const img = post.media[0]?.url;
    return (
      <div className="paper relative h-full w-full rounded-[3px] bg-[#fbf9f2] p-[3px] pb-2.5" style={style}>
        <div className="h-full w-full overflow-hidden rounded-[2px]" style={{ background: `linear-gradient(135deg, ${c.base}, ${c.dark})` }}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <svg aria-hidden viewBox="0 0 40 30" className="h-full w-full opacity-70"><circle cx="12" cy="10" r="4" fill="#fff" /><path d="M0 30 14 16l8 8 6-6 12 12z" fill="#fff" opacity=".7" /></svg>
          )}
        </div>
      </div>
    );
  }
  const glyph = post.type === "prompt_response" ? "“" : POST_TYPES[post.type].icon;
  return (
    <div className="paper relative grid h-full w-full place-items-center rounded-md" style={{ ...style, background: c.base, color: c.ink }}>
      <span className="display text-[34px] leading-none">{glyph}</span>
      <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-black/25" />
    </div>
  );
}

function FalseWall({ post, near }: { post: Post; near: boolean }) {
  const c = WALL_COLORS[post.wall_color] ?? WALL_COLORS.coral;
  const style = post.clue_style ?? "crack";
  return (
    <div className="fw-false relative h-full w-full" data-near={near ? "1" : "0"} style={{ ["--glow" as string]: c.base } as CSSProperties}>
      <svg aria-hidden viewBox="0 0 56 56" className="absolute inset-0 h-full w-full overflow-visible">
        {style === "crack" && (
          <>
            <path className="fw-crack-dark" d="M30 0 25 12 33 22 24 33 34 43 28 56" fill="none" stroke="#0b0716" strokeWidth="3.4" strokeLinejoin="round" />
            <path className="fw-crack" d="M30 0 25 12 33 22 24 33 34 43 28 56" fill="none" stroke={c.base} strokeWidth="1.3" strokeLinejoin="round" />
          </>
        )}
        {style === "glow" && <rect className="fw-crack" x="3" y="3" width="50" height="50" rx="4" fill="none" stroke={c.base} strokeWidth="1.6" />}
        {style === "opening" && <rect className="fw-crack" x="25" y="2" width="6" height="52" rx="2" fill={c.base} opacity=".85" />}
        {style === "handle" && (
          <>
            <rect x="38" y="16" width="7" height="24" rx="3.5" fill="#0b0716" />
            <rect className="fw-crack" x="39.5" y="18" width="4" height="20" rx="2" fill={c.base} />
          </>
        )}
        {style === "texture" && (
          <>
            <rect x="7" y="9" width="42" height="14" rx="1.5" fill={c.dark} opacity=".6" />
            <rect className="fw-crack" x="7" y="9" width="42" height="14" rx="1.5" fill="none" stroke={c.base} strokeWidth="1.4" />
            <rect x="19" y="30" width="30" height="14" rx="1.5" fill={c.dark} opacity=".45" />
          </>
        )}
      </svg>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><EyeMark color={c.base} size={15} /></span>
    </div>
  );
}
