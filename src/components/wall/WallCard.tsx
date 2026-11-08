import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui";
import { WallIcon, isWallIcon } from "@/components/wall/icons";
import type { WallPost } from "@/lib/data/wall";
import type { Slot } from "@/lib/wall/layout";
import type { WallColor } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

/** The six palette colours; teal and lime (older posts) read as blue and gold. */
export type Tone = "red" | "gold" | "blue" | "purple" | "beige" | "char";
export const TONE: Record<WallColor, Tone> = { coral: "red", mustard: "gold", sky: "blue", teal: "blue", violet: "purple", rose: "beige", slate: "char", lime: "gold" };
const DEFAULT_ICON = { ask_me: "mega", hidden_thought: "eye", false_wall: "ask", prompt_response: "star", picture: "camera" } as const;

export const toneOf = (post: WallPost): Tone => (post.type === "hidden_thought" ? "purple" : TONE[post.wall_color] ?? "red");
export const iconOf = (post: WallPost) => (isWallIcon(post.wall_icon) ? post.wall_icon : DEFAULT_ICON[post.type]);
/** The one to three words a post shows on the wall. */
export const wallText = (post: WallPost) => (post.title ?? "").trim();
export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n));
export const sizeFor = (t: string) => { const w = Math.max(...t.split(/\s+/).map((x) => x.length), 1); return w <= 5 ? 27 : w <= 7 ? 23 : w <= 9 ? 19 : 15; };

/** Hand-drawn flourishes that sit under the words: swooshes, curved arrows, ticks, loops. Each post gets one, chosen from its own text. */
const FLOURISHES: React.ReactNode[] = [
  <path key="0" d="M3 14C20 6 50 4 77 10C52 8 24 11 3 14z" fill="currentColor" strokeWidth="1.6" />,
  <g key="1"><path d="M4 15C24 8 48 6 68 8" /><path d="M60 2l10 6-8 7" /></g>,
  <g key="2"><path d="M4 8C26 3 52 3 76 7" /><path d="M10 15C30 10 54 10 70 13" /></g>,
  <path key="3" d="M3 11c7-8 11 8 18 0s11 8 18 0 11 8 18 0 8 4 14 0" />,
  <path key="4" d="M3 15C22 14 40 14 56 12c10-1 14-8 8-9s-8 8 2 9c4 .4 8-.2 12-1" />,
  <g key="5"><path d="M4 16C24 6 56 6 76 16" /><path d="M18 8 15 2M30 5V-1M42 4V-2M54 5l2-6M66 9l4-5" /></g>,
  <g key="6"><path d="M4 10H72" /><path d="M62 3l11 7-11 7" /></g>,
  <g key="7"><path d="M4 17C20 16 28 8 42 9c10 1 16-3 30-9" /><path d="M58 0h14v13" /></g>,
  <path key="8" d="M4 14 14 4l8 11 10-11 8 11 10-11 8 11 10-8" />,
  <g key="9"><path d="M4 12C26 8 50 8 70 12" /><path d="M73 5v6M70 8h6M10 3v4M8 5h4" /></g>,
  <g key="10"><path d="M4 12C22 4 46 4 74 11" /><path d="M16 15C34 11 52 11 66 14" strokeWidth="1.8" /></g>,
  <g key="11"><path d="M6 15C26 8 54 8 72 3" /><path d="M72 3 62 3M72 3l-2 10" /></g>,
];
export const flourishFor = (key: string) => { let h = 7; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; return h % FLOURISHES.length; };
export function Flourish({ kind, className }: { kind: number; className?: string }) {
  return <svg aria-hidden viewBox="-2 -4 84 26" className={className} fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">{FLOURISHES[kind % FLOURISHES.length]}</svg>;
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
      <Flourish kind={flourishFor(`${post.id}${words}`)} className="wp-flourish" />
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
