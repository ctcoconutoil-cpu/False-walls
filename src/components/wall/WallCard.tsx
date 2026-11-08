import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui";
import { WallIcon, isWallIcon } from "@/components/wall/icons";
import type { WallPost } from "@/lib/data/wall";
import type { Slot } from "@/lib/wall/layout";
import type { WallColor } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

/** The six palette colours; teal and lime (older posts) read as blue and gold. */
export type Tone = "red" | "gold" | "blue" | "purple" | "beige" | "char";
const TONE: Record<WallColor, Tone> = { coral: "red", mustard: "gold", sky: "blue", teal: "blue", violet: "purple", rose: "beige", slate: "char", lime: "gold" };
const DEFAULT_ICON = { ask_me: "mega", hidden_thought: "eye", false_wall: "ask", prompt_response: "star", picture: "camera" } as const;

export const toneOf = (post: WallPost): Tone => (post.type === "hidden_thought" ? "purple" : TONE[post.wall_color] ?? "red");
export const iconOf = (post: WallPost) => (isWallIcon(post.wall_icon) ? post.wall_icon : DEFAULT_ICON[post.type]);
/** The one to three words a post shows on the wall. */
export const wallText = (post: WallPost) => (post.title ?? "").trim();
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n));
const sizeFor = (t: string) => { const w = Math.max(...t.split(/\s+/).map((x) => x.length), 1); return w <= 5 ? 27 : w <= 7 ? 23 : w <= 9 ? 19 : 15; };

/** Hand-drawn flourishes that sit under the words. */
export function Flourish({ kind, className }: { kind: number; className?: string }) {
  const p = [
    <path key="a" d="M4 12C20 5 44 4 76 9" />,
    <path key="b" d="M4 9c8-6 12 6 20 0s12 6 20 0 12 6 20 0 8 2 12 0" />,
    <g key="c"><path d="M4 13C24 12 44 10 64 4" /><path d="M54 3 65 4 61 14" /></g>,
    <g key="d"><path d="M6 11C24 6 40 6 70 9" /><path d="M20 3v4M40 1v5M60 3v4" /></g>,
  ];
  return <svg aria-hidden viewBox="0 0 80 16" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{p[kind % p.length]}</svg>;
}

export function Who({ post }: { post: WallPost }) {
  const anon = post.type === "hidden_thought";
  const name = anon ? "Anonymous" : post.author ? post.author.display_name || post.author.username : "False Walls";
  return (
    <span className="wp-who">
      {anon || !post.author ? <span className="wp-ava" aria-hidden><WallIcon name={anon ? "ghost" : "star"} size={11} /></span> : <Avatar user={post.author} size={15} />}
      <span className="wp-name">{name}</span>
      <time className="wp-time" suppressHydrationWarning>{timeAgo(post.created_at)}</time>
    </span>
  );
}
const Count = ({ post }: { post: WallPost }) => {
  const chat = post.comments > post.likes;
  return <span className="wp-count" aria-label={chat ? `${post.comments} comments` : `${post.likes} likes`}>
    {chat ? <svg aria-hidden viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M4 4h16v12H11l-5 4v-4H4z" strokeLinejoin="round" /></svg> : <svg aria-hidden viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 21S3 15.5 3 9a4.8 4.8 0 0 1 9-2.3A4.8 4.8 0 0 1 21 9c0 6.5-9 12-9 12z" strokeLinejoin="round" /></svg>}
    {compact(chat ? post.comments : post.likes)}
  </span>;
};

/** One post as a physical object hanging on the wall. Purely presentational. */
export function WallCard({ post, p }: { post: WallPost; p: Pick<Slot, "variant" | "seed"> }) {
  const tone = toneOf(post);
  const img = post.media[0]?.url;
  const words = wallText(post);
  const style = { animationDelay: `${-p.seed * 6}s` } as CSSProperties;
  if (img) {
    return (
      <span className={`wp-body wp-photo wp-f${p.variant}`} style={style}>
        <span className="wp-pic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt={post.media[0].alt_text ?? (words || "Picture on the wall")} loading="lazy" decoding="async" draggable={false} />
          <span className="wp-top"><Who post={post} /></span>
          <span className="wp-bot">{words && <span className="wp-cap">{words}</span>}<Count post={post} /></span>
        </span>
        <i aria-hidden className="wp-sheen" />
      </span>
    );
  }
  const ic = iconOf(post);
  return (
    <span className={`wp-body wp-board wp-t-${tone}`} style={style}>
      <span aria-hidden className="wp-bricktex" />
      <span className={`wp-icon ${ic === "ask" ? "wp-icon-disc" : ""}`}><WallIcon name={ic} size={ic === "ask" ? 30 : 34} /></span>
      <span className="wp-words" style={{ fontSize: sizeFor(words) }}>{words}</span>
      <Flourish kind={Math.floor(p.seed * 4)} className="wp-flourish" />
      <span className="wp-foot"><Who post={post} /><Count post={post} /></span>
      <i aria-hidden className="wp-sheen" />
    </span>
  );
}

/** The decorative "Trending right now" sign: part of the wall, not a post. */
export function SignCard({ seed }: { seed: number }) {
  return (
    <span className="wp-body wp-board wp-t-red wp-sign" style={{ animationDelay: `${-seed * 6}s` }}>
      <span aria-hidden className="wp-bricktex" />
      <span className="wp-icon"><WallIcon name="flame" size={36} /></span>
      <span className="wp-words" style={{ fontSize: 21 }}>Trending Right Now</span>
      <svg aria-hidden viewBox="0 0 80 40" className="wp-flourish wp-chart" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 34 24 18l12 8L70 6" /><path d="M54 5h17v16" /></svg>
      <i aria-hidden className="wp-sheen" />
    </span>
  );
}
