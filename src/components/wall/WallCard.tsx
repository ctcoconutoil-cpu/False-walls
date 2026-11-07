import type { CSSProperties } from "react";
import { WALL_COLORS } from "@/lib/constants";
import type { WallPost } from "@/lib/data/wall";
import type { Placed } from "@/lib/wall/layout";

const Heart = () => <svg aria-hidden viewBox="0 0 24 24" width="9" height="9" fill="currentColor"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z" /></svg>;
const Bubble = () => <svg aria-hidden viewBox="0 0 24 24" width="9" height="9" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H11l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /></svg>;
const Megaphone = () => <svg aria-hidden viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M3 10v4a1 1 0 0 0 1 1h2l3 5h2.5l-2-5H11l8 4V5l-8 4H4a1 1 0 0 0-1 1zm17-.5v5a2.5 2.5 0 0 0 0-5z" /></svg>;
const Screws = () => <><i className="wp-screw" style={{ left: 5, top: 5 }} /><i className="wp-screw" style={{ right: 5, top: 5 }} /><i className="wp-screw" style={{ left: 5, bottom: 5 }} /><i className="wp-screw" style={{ right: 5, bottom: 5 }} /></>;
const Counts = ({ post }: { post: WallPost }) => (
  <span className="wp-counts"><span><Heart />{post.likes}</span><span><Bubble />{post.comments}</span></span>
);

/** The words a post shows on the wall. Concealed content never appears here, only its clue. */
export function wallText(post: WallPost): string {
  return (post.type === "false_wall" ? post.clue : post.type === "ask_me" ? post.title : post.type === "picture" ? post.title ?? post.body : post.body ?? post.title) ?? "Something on the wall";
}

/** One post as a physical object hanging on the wall. Purely presentational. */
export function WallCard({ post, p }: { post: WallPost; p: Placed }) {
  const c = WALL_COLORS[post.wall_color] ?? WALL_COLORS.coral;
  const img = post.media[0]?.url;
  const tint = { "--c": c.base, "--cd": c.dark, "--ci": c.ink } as CSSProperties;
  const words = wallText(post);
  const framed = p.style === "frame" && img;
  const posterly = p.style === "poster" && img;
  return (
    <span className={`wp-body wp-${framed ? "frame" : posterly ? "poster" : p.style === "frame" || p.style === "poster" ? "board" : p.style} wp-v${p.variant}`} style={{ ...tint, animationDelay: `${-p.seed * 6}s` }}>
      {framed || posterly ? (
        <>
          <span className="wp-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={post.media[0].alt_text ?? post.title ?? "Picture on the wall"} loading="lazy" decoding="async" draggable={false} />
          </span>
          {posterly && <><i className="wp-tape" style={{ left: "12%" }} /><i className="wp-tape" style={{ right: "12%" }} /></>}
          {post.title && <span className="wp-cap">{post.title}</span>}
        </>
      ) : p.style === "notice" ? (
        <>
          <span className="wp-tag"><Megaphone />Ask me</span>
          <span className="wp-text wp-big">{words}</span>
        </>
      ) : p.style === "question" ? (
        <>
          <span className="wp-q" aria-hidden>?</span>
          <span className="wp-text">{words}</span>
        </>
      ) : p.style === "hidden" ? (
        <>
          <span className="wp-text wp-note">{post.body || "A thought"}</span>
          <span aria-hidden className="wp-redact"><i /><i /></span>
          {post.clue && <span className="wp-text wp-note wp-small">{post.clue}</span>}
        </>
      ) : p.style === "plaque" ? (
        <span className="wp-text wp-caps">{words}</span>
      ) : (
        <>
          {post.type === "prompt_response" && <span aria-hidden className="wp-quote">“</span>}
          <span className="wp-text">{words}</span>
        </>
      )}
      {(p.style === "board" || p.style === "panel" || p.style === "question" || p.style === "plaque" || (p.style === "frame" && !img) || (p.style === "poster" && !img)) && <Screws />}
      <Counts post={post} />
      <i aria-hidden className="wp-sheen" />
    </span>
  );
}
