"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FlipComposer } from "@/components/private/FlipComposer";
import { OwnerTools } from "@/components/private/OwnerTools";
import { PromptCard } from "@/components/private/PromptCard";
import { Avatar } from "@/components/ui";
import { WallBackdrop } from "@/components/wall/WallBackdrop";
import { WallCard, wallText } from "@/components/wall/WallCard";
import { removeCard } from "@/lib/actions/private";
import type { BrickKey } from "@/lib/constants";
import type { ViewCard, WallOwner } from "@/lib/data/private";
import type { WallPost } from "@/lib/data/wall";
import { BAYH, DW, PER_BAY, layoutBay } from "@/lib/wall/layout";

const MAX_W = 560;
type Mode = "owner" | "visitor";

/**
 * A private wall: the same brick wall as the Main Wall, with the owner's prompt cards (and any public posts they
 * pinned) hanging on it. Visitors tap a prompt to send an anonymous message; the owner taps one to read what arrived.
 */
export function PrivateWallView({ mode, slug, brick: initialBrick, cards, owner, accepting = true, candidates = [], isActive = true }: {
  mode: Mode; slug: string; brick: BrickKey; cards: ViewCard[]; owner: WallOwner; accepting?: boolean; candidates?: WallPost[]; isActive?: boolean;
}) {
  const router = useRouter();
  const [brick, setBrick] = useState(initialBrick);
  const [box, setBox] = useState({ w: 390, h: 640 });
  const [composing, setComposing] = useState<ViewCard | null>(null);
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

  const s = Math.min(box.w, MAX_W) / DW;
  const bays = Math.max(1, Math.ceil(cards.length / PER_BAY));
  const empties = mode === "owner" || cards.length < PER_BAY ? bays * PER_BAY - cards.length : 0;
  const items = useMemo(() => [...cards.map((c) => c.id), ...Array.from({ length: empties }, (_, i) => `empty-${i}`)], [cards, empties]);
  const slots = useMemo(() => {
    const lp = items.map((id) => ({ id, type: "ask_me" as const, hasImage: false }));
    return Array.from({ length: Math.max(1, Math.ceil(items.length / PER_BAY)) }, (_, b) => layoutBay(b, lp, false)).flat();
  }, [items]);
  const total = Math.max(1, Math.ceil(items.length / PER_BAY)) * BAYH + 40;
  const byId = new Map(cards.map((c) => [c.id, c]));
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
    <div className="wp-root" data-brick={brick}>
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
          <p><b>{name}</b> {isActive && accepting ? "is taking anonymous messages. Tap a card." : "isn't taking messages right now."}</p>
        </div>
      ) : (
        <div className="pw-strip pw-tools">
          <button type="button" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
          <button type="button" onClick={() => setTools({ open: true, tab: "brick" })}>Customize</button>
          <button type="button" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Remove cards"}</button>
        </div>
      )}

      <div ref={scroller} className="wp-scroller" tabIndex={0} role="region" aria-label={mode === "owner" ? "Your private wall" : `${name}'s wall`}>
        <div className="wp-track" style={{ width: DW * s, height: total * s }}>
          <div className="wp-stage" style={{ width: DW, height: total, transform: `scale(${s})` } as CSSProperties}>
            {Array.from({ length: Math.ceil(items.length / PER_BAY) || 1 }, (_, b) => <WallBackdrop key={b} bay={b} />)}
            {slots.map((p) => {
              const card = byId.get(items[p.postIndex]);
              const style = { left: p.x, top: p.y, width: p.w, height: p.h, "--z": 1 + p.depth, "--rot": p.rot.toFixed(2), "--ry": p.ry.toFixed(2) } as CSSProperties;
              if (!card) {
                return (
                  <div key={p.key} className="wp-pos" style={style}>
                    <div className="wp-tilt">
                      {mode === "owner" ? (
                        <button type="button" className="wp-hit pw-empty" onClick={() => setTools({ open: true, tab: "card" })} aria-label="Add a card here"><span aria-hidden>+</span></button>
                      ) : <span className="wp-hit pw-empty pw-empty-quiet" aria-hidden />}
                    </div>
                  </div>
                );
              }
              const prompt = card.kind === "prompt";
              const canSend = mode === "visitor" && prompt && accepting && isActive;
              const inner = prompt ? <PromptCard card={card} mode={mode} seed={p.seed} /> : <WallCard post={card.post as WallPost} p={p} />;
              const label = prompt ? (mode === "owner" ? `${card.title}: ${card.total ?? 0} messages${card.unread ? `, ${card.unread} new` : ""}` : `Send a message: ${card.title}`) : `Open post: ${wallText(card.post as WallPost)}`;
              return (
                <div key={p.key} className="wp-pos" style={style}>
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
              );
            })}
          </div>
        </div>
      </div>
      <div className="wp-light" aria-hidden />

      {composing && <FlipComposer card={composing} onClose={() => setComposing(null)} onSent={(id) => setStuck((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }))} />}
      {mode === "owner" && (
        <OwnerTools open={tools.open} onClose={() => setTools((t) => ({ ...t, open: false }))} tab={tools.tab} setTab={(tab) => setTools((t) => ({ ...t, tab }))}
          brick={brick} onBrick={setBrick} cards={cards} candidates={candidates} isActive={isActive} />
      )}
    </div>
  );
}
