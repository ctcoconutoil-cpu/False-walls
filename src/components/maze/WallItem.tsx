import { parsePick } from "@/lib/constants";
import type { CSSProperties } from "react";
import { WALL_COLORS, POST_TYPES } from "@/lib/constants";
import type { Post } from "@/lib/types";

function rot(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.9;
}

/** What a wall panel looks like from the corridor. Purely presentational so it is cheap to render. */
export function WallItem({ post, compact = false }: { post: Post; compact?: boolean }) {
  const c = WALL_COLORS[post.wall_color] ?? WALL_COLORS.coral;
  const tilt = compact ? 0 : rot(post.id);
  const base: CSSProperties = { transform: `rotate(${tilt}deg)` };

  if (post.type === "false_wall") return <FalseWallFace post={post} compact={compact} />;

  if (post.type === "hidden_thought") {
    return (
      <div className={`paper tape relative flex h-full w-full flex-col justify-between rounded-sm bg-[#FFE98A] p-2.5 text-[#2b2200] ${compact ? "min-h-40" : ""}`} style={base}>
        <p className="note line-clamp-2 text-[13px] leading-tight">{post.body || "A thought"}</p>
        <div aria-hidden className="space-y-1">
          <div className="h-2 w-full rounded-sm bg-[#2b2200]" /><div className="h-2 w-4/5 rounded-sm bg-[#2b2200]" />
        </div>
        <p className="note line-clamp-2 text-[12px] font-bold leading-tight">{post.clue}</p>
      </div>
    );
  }

  if (post.type === "picture") {
    const img = post.media[0]?.url;
    return (
      <div className="paper relative flex h-full w-full flex-col rounded-[3px] bg-[#fbf9f2] p-1.5 pb-2 text-[#1c1830]" style={base}>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[2px]" style={{ background: `linear-gradient(135deg, ${c.base}, ${c.dark})` }}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={post.media[0].alt_text ?? post.title ?? "Picture on the wall"} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <svg aria-hidden viewBox="0 0 40 30" className="h-full w-full opacity-60"><circle cx="12" cy="10" r="4" fill="#fff" /><path d="M0 30 14 16l8 8 6-6 12 12z" fill="#fff" opacity=".7" /></svg>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-tight">{post.title}</p>
      </div>
    );
  }

  if (post.type === "prompt_response") {
    return (
      <div className="paper flex h-full w-full flex-col justify-between rounded-2xl p-2.5" style={{ ...base, background: c.base, color: c.ink }}>
        <span aria-hidden className="display text-3xl leading-none opacity-70">“</span>
        <p className="line-clamp-4 text-[12px] font-semibold leading-snug">{post.body}</p>
      </div>
    );
  }

  // ask_me poster (a "Pick a number" wall is an Ask Me wall with numbered questions)
  const pick = parsePick(post.body);
  return (
    <div className="paper relative flex h-full w-full flex-col justify-between rounded-md p-2.5" style={{ ...base, background: c.base, color: c.ink }}>
      <span className="display flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
        <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-black/20 text-[10px]">{pick ? "#" : POST_TYPES.ask_me.icon}</span>{pick ? "Pick a number" : "Ask me"}
      </span>
      <p className="display line-clamp-3 text-[15px] leading-[1.05]">{post.title}</p>
      {pick && <span className="flex flex-wrap gap-1" aria-label={`${pick.length} questions`}>{pick.slice(0, 6).map((_, i) => <span key={i} aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-black/25 text-[10px] font-black">{i + 1}</span>)}</span>}
    </div>
  );
}

function FalseWallFace({ post, compact }: { post: Post; compact: boolean }) {
  const c = WALL_COLORS[post.wall_color] ?? WALL_COLORS.coral;
  const style = post.clue_style ?? "crack";
  const glow = { "--glow": c.base } as CSSProperties;
  return (
    <div
      className={`wall ${style === "texture" ? "wall-oddbrick" : "wall-slab"} relative grid h-full w-full place-items-center overflow-hidden rounded-md p-2 ${style === "glow" ? "clue-glow" : ""} ${compact ? "min-h-40" : ""}`}
      style={{ ...glow, ["--wall" as string]: c.dark, ["--mortar" as string]: c.base, boxShadow: style === "glow" ? undefined : `inset 0 0 0 3px ${c.base}55` }}
    >
      {style === "crack" && (
        <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          <path d="M52 0 46 18 58 30 44 46 60 60 50 76 58 100" fill="none" stroke="#0b0716" strokeWidth="4" strokeLinejoin="round" />
          <path d="M52 0 46 18 58 30 44 46 60 60 50 76 58 100" fill="none" stroke={c.base} strokeWidth="1.2" opacity=".9" />
        </svg>
      )}
      {style === "handle" && (
        <span aria-hidden className="absolute right-3 top-1/2 h-9 w-3.5 -translate-y-1/2 rounded-full" style={{ background: `linear-gradient(90deg, #f5f2ff, ${c.base})`, boxShadow: "0 3px 0 rgba(0,0,0,.4)" }} />
      )}
      {style === "opening" && (
        <span aria-hidden className="absolute inset-y-2 left-1/2 w-3 -translate-x-1/2 rounded-sm" style={{ background: `linear-gradient(180deg, #fff6c9, ${c.base})`, boxShadow: `0 0 18px 4px ${c.base}` }} />
      )}
      <p className="relative z-10 line-clamp-4 max-w-[88%] rounded bg-black/55 px-1.5 py-1 text-center text-[11px] font-black uppercase leading-tight tracking-wide text-chalk">{post.clue}</p>
    </div>
  );
}
