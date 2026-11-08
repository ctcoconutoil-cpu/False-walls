"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FlipComposer } from "@/components/private/FlipComposer";
import { OwnerTools } from "@/components/private/OwnerTools";
import { PromptCard } from "@/components/private/PromptCard";
import { Avatar } from "@/components/ui";
import { WallCard, wallText } from "@/components/wall/WallCard";
import { removeCard } from "@/lib/actions/private";
import { isPicture, type BrickKey } from "@/lib/constants";
import type { ViewCard, WallOwner } from "@/lib/data/private";
import type { WallPost } from "@/lib/data/wall";

const MAX_W = 560;
type Mode = "owner" | "visitor";

/**
 * A private wall: the same brick wall as the Main Wall, with the owner's prompt cards (and any public posts they
 * pinned) hanging on it. Visitors tap a prompt to send an anonymous message; the owner taps one to read what arrived.
 */
export function PrivateWallView({ mode, slug, brick: initialBrick, cards, owner, accepting = true, candidates = [], isActive = true, alreadySent = false, bg = null }: {
  bg?: string | null; alreadySent?: boolean; mode: Mode; slug: string; brick: BrickKey; cards: ViewCard[]; owner: WallOwner; accepting?: boolean; candidates?: WallPost[]; isActive?: boolean;
}) {
  const router = useRouter();
  const [brick, setBrick] = useState(initialBrick);
  const [box, setBox] = useState({ w: 390, h: 640 });
  const [composing, setComposing] = useState<ViewCard | null>(null);
  const [sentOnce, setSentOnce] = useState(alreadySent);
  const [stuck, setStuck] = useState<Record<string, number>>({});
  const [tools, setTools] = useState<{ open: boolean; tab: "brick" | "card" | "wall" | "link" }>({ open: false, tab: "brick" });
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => setBrick(initialBrick), [initialBrick]);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure(); const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Two cards to a row, standing straight on a ledge. One card on its own is shown large and centred.
  const GAP = 16;
  const usable = Math.min(box.w, MAX_W) - 36;
  const cw = cards.length === 1 ? Math.min(Math.max(usable * 0.72, 150), 300) : Math.max(110, (usable - GAP) / 2);
  const rows = useMemo(() => { const r: ViewCard[][] = []; for (let i = 0; i < cards.length; i += 2) r.push(cards.slice(i, i + 2)); return r; }, [cards]);
  const link = () => `${location.origin}/u/${slug}`;
  const copy = async () => {
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) await navigator.share({ url: link(), title: "Send me anonymous messages" });
      else { await navigator.clipboard.writeText(link()); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* cancelled */ }
  };
  const remove = async (id: string) => { await removeCard(id); router.refresh(); };
  const name = owner.display_name || owner.username;
  const unreadTotal = cards.reduce((n, c) => n + (c.unread ?? 0), 0);

  return (
    <div className="wp-root" data-brick={brick} data-pic={isPicture(brick) ? "" : undefined} style={brick === "custom" && bg ? ({ "--pic": `url(${bg})` } as CSSProperties) : undefined}>
      <header className="wp-header">
        {mode === "owner" ? (
          <Link href="/wall" aria-label="Back to the Wall" className="grid h-11 w-11 place-items-center rounded-full text-white active:bg-white/10">
            <svg aria-hidden viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m14.5 5-7 7 7 7" /></svg>
          </Link>
        ) : null}
        <Link href={mode === "owner" ? "/wall" : "/"} aria-label="False Walls" className="wp-logo">
          <svg aria-hidden viewBox="0 0 40 18" className="wp-logo-eye"><path d="M2 12C8 3 32 3 38 12C32 20 8 20 2 12z" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" /><circle cx="20" cy="11" r="4.4" fill="#fff" /></svg>
          <span className="wp-logo-text">False<br />Walls</span>
        </Link>
        <span className="flex-1" />
        {mode === "visitor" ? (
          <Link href="/signup" className="rounded-full bg-[#F9A719] px-4 py-2 text-sm font-black text-[#2a1a05]">Make your own</Link>
        ) : (
          <span className="pr-2 text-right text-sm font-black leading-tight text-white">My Private Wall{unreadTotal > 0 && <span className="block text-[11px] font-bold text-[#F9A719]">{unreadTotal} new</span>}</span>
        )}
      </header>

      {mode === "visitor" ? (
        <div className="pw-strip">
          <Avatar user={owner} size={30} />
          <p><b>{name}</b> {sentOnce ? "got your message. Thanks for sending it." : isActive && accepting ? "is taking anonymous messages. Tap a card." : "isn't taking messages right now."}</p>
        </div>
      ) : (
        <div className="pw-strip pw-tools">
          <button type="button" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
          <button type="button" onClick={() => setTools({ open: true, tab: "brick" })}>Customize</button>
          <button type="button" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Remove cards"}</button>
        </div>
      )}

      <div ref={scroller} className="wp-scroller" tabIndex={0} role="region" aria-label={mode === "owner" ? "Your private wall" : `${name}'s wall`}>
        {cards.length === 0 ? (
          <div className="pw-blank">
            <p className="pw-blank-title">{mode === "owner" ? "Your wall is empty" : "Nothing on this wall yet"}</p>
            <p>{mode === "owner" ? "Add a card so people have something to tap." : "Check back soon."}</p>
            {mode === "owner" && <button type="button" onClick={() => setTools({ open: true, tab: "card" })}>Add your first card</button>}
          </div>
        ) : (
          <div className={`pw-wall ${cards.length === 1 ? "pw-one" : ""}`}>
            {rows.map((row, ri) => (
              <div key={ri} className="pw-row" style={{ gap: GAP }}>
                {row.map((card) => {
                  const prompt = card.kind === "prompt";
                  const canSend = mode === "visitor" && prompt && accepting && isActive && !sentOnce;
                  const inner = prompt ? <PromptCard card={card} mode={mode} seed={0.3} /> : <WallCard post={card.post as WallPost} p={{ variant: 0, seed: 0.2 }} />;
                  const label = prompt ? (mode === "owner" ? `${card.title}: ${card.total ?? 0} messages${card.unread ? `, ${card.unread} new` : ""}` : `Send a message: ${card.title}`) : `Open post: ${wallText(card.post as WallPost)}`;
                  return (
                    <div key={card.id} className="pw-cell" style={{ width: cw, height: cw * 1.5 }}>
                      <div className="wp-pos pw-unit" style={{ transform: `scale(${cw / 100})` }}>
                        <div className={`wp-tilt ${canSend ? "pw-glow" : ""}`}>
                          {prompt && mode === "owner" && !editing ? (
                            <Link href={`/private/${card.id}`} className="wp-hit" aria-label={label} draggable={false}>{inner}</Link>
                          ) : prompt ? (
                            <button type="button" className="wp-hit" aria-label={label} disabled={mode === "visitor" ? !canSend : editing} onClick={() => canSend && setComposing(card)}>{inner}</button>
                          ) : (
                            <Link href={`/post/${card.post_id}`} className="wp-hit" aria-label={label} draggable={false}>{inner}</Link>
                          )}
                          {Array.from({ length: Math.min(stuck[card.id] ?? 0, 3) }, (_, i) => (
                            <i key={i} aria-hidden className="pw-note" style={{ "--n": i } as CSSProperties} />
                          ))}
                          {mode === "owner" && editing && (
                            <button type="button" className="pw-remove" aria-label={`Remove ${prompt ? card.title : "post"} from your wall`} onClick={() => remove(card.id)}>✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="wp-light" aria-hidden />

      {composing && <FlipComposer card={composing} slug={slug} onClose={() => setComposing(null)} onSent={(id) => { setSentOnce(true); setStuck((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 })); }} />}
      {mode === "owner" && (
        <OwnerTools open={tools.open} onClose={() => setTools((t) => ({ ...t, open: false }))} tab={tools.tab} setTab={(tab) => setTools((t) => ({ ...t, tab }))}
          brick={brick} onBrick={setBrick} cards={cards} candidates={candidates} isActive={isActive} />
      )}
    </div>
  );
}
