"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { FlipComposer } from "@/components/private/FlipComposer";
import { OwnerTools } from "@/components/private/OwnerTools";
import { WallItem } from "@/components/maze/WallItem";
import { Avatar } from "@/components/ui";
import { removeCard } from "@/lib/actions/private";
import { brickLook, isPicture, type BrickKey } from "@/lib/constants";
import type { ViewCard, WallOwner } from "@/lib/data/private";

type Mode = "owner" | "visitor";
const SLOTS = 3;
const LINES = ["is taking anonymous messages. Tap a note.", "is sharing their love walls. Tap one to open it.", "is sharing their anime collection. Tap one to open it."];

/** A rotation of one-line invitations for the strip under the header. */
function useLine(on: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 4500);
    return () => clearInterval(t);
  }, [on]);
  return LINES[i];
}

/**
 * A private wall: a brick wall with the owner's notes pinned to it, three to a row, like papers on a fridge.
 * Nothing is centred: a single note sits top left and the empty places show there is room for more.
 */
export function PrivateWallView({ openTools, wallId, tabs = [], canAddWall = false, mode, slug, brick: initialBrick, cards, owner, isActive = true, bg = null }: {
  openTools?: "card"; wallId?: string; tabs?: { id: string; slug: string; n: number }[]; canAddWall?: boolean; bg?: string | null; mode: Mode; slug: string; brick: BrickKey; cards: ViewCard[]; owner: WallOwner; isActive?: boolean;
}) {
  const router = useRouter();
  const [brick, setBrick] = useState(initialBrick);
  const [tools, setTools] = useState<{ open: boolean; tab: "brick" | "card" | "link" }>({ open: !!openTools, tab: openTools ?? "brick" });
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flip, setFlip] = useState<ViewCard | null>(null);
  useEffect(() => setBrick(initialBrick), [initialBrick]);
  const line = useLine(mode === "visitor" && isActive);

  const notes = cards.filter((c) => c.kind === "post" && c.post);
  const slots = Math.max(SLOTS * 3, Math.ceil((notes.length + 1) / SLOTS) * SLOTS) - notes.length;
  const look = brickLook(brick);
  const link = () => `${location.origin}/u/${slug}`;
  const copy = async () => {
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) await navigator.share({ url: link(), title: "Open my wall" });
      else { await navigator.clipboard.writeText(link()); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* cancelled */ }
  };
  const remove = async (id: string) => { await removeCard(id); router.refresh(); };
  const name = owner.display_name || owner.username;
  const style = look ? ({ "--wall": look.wall, "--mortar": look.mortar } as CSSProperties) : brick === "custom" && bg ? ({ "--pic": `url(${bg})` } as CSSProperties) : undefined;

  return (
    <div className="wp-root" data-brick={look ? undefined : brick} data-bk={look ? "" : undefined} data-glow={look?.glow ? "" : undefined} data-pic={isPicture(brick) ? "" : undefined} style={style}>
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
          <span className="pr-2 text-right text-sm font-black leading-tight text-white">My Private Wall</span>
        )}
      </header>

      {mode === "owner" && (tabs.length > 1 || canAddWall) && (
        <nav aria-label="Your private walls" className="pw-strip pw-tools">
          {tabs.map((t) => <Link key={t.id} href={`/private?w=${t.slug}`} aria-current={t.slug === slug ? "page" : undefined} className={t.slug === slug ? "pw-tab-on" : ""}>Wall {t.n}</Link>)}
          {canAddWall && <Link href="/private?new=1">+ New wall</Link>}
        </nav>
      )}
      {mode === "visitor" ? (
        <div className="pw-strip">
          <Avatar user={owner} size={30} />
          <p aria-live="polite"><b>{name}</b> {isActive ? line : "isn't taking visitors right now."}</p>
        </div>
      ) : (
        <div className="pw-strip pw-tools">
          <button type="button" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
          <button type="button" onClick={() => setTools({ open: true, tab: "brick" })}>Customize</button>
          <button type="button" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Remove notes"}</button>
        </div>
      )}

      <div className="wp-scroller" tabIndex={0} role="region" aria-label={mode === "owner" ? "Your private wall" : `${name}'s wall`}>
        <div className="pw-notes">
          {notes.map((card, i) => (
            <div key={card.id} className="pw-note-cell" style={{ "--r": `${((i * 37) % 5 - 2) * 0.9}deg` } as CSSProperties}>
              <i aria-hidden className="pw-pin" />
              {(() => {
                const label = card.post?.title ?? card.post?.clue ?? card.post?.body ?? "wall";
                const face = card.post && <WallItem post={card.post} compact />;
                if (mode === "visitor") return <button type="button" className="pw-open" draggable={false} aria-label={`Send a message to: ${label}`} onClick={() => setFlip(card)}>{face}</button>;
                const n = card.unread || card.total || 0;
                return (
                  <>
                    <Link href={`/private/${card.id}`} draggable={false} aria-label={`Messages for: ${label}${n ? ` (${card.unread ? `${card.unread} new` : `${card.total} total`})` : ""}`}>{face}</Link>
                    {n > 0 && <span className="pw-badge" data-seen={card.unread ? undefined : ""} aria-hidden>{n > 99 ? "99+" : n}</span>}
                  </>
                );
              })()}
              {mode === "owner" && editing && (
                <button type="button" className="pw-remove" aria-label="Remove from your wall" onClick={() => remove(card.id)}>✕</button>
              )}
            </div>
          ))}
          {Array.from({ length: slots }, (_, i) => mode === "owner" && i === 0 && !editing ? (
            <button key={`e${i}`} type="button" className="pw-empty" aria-label="Add a wall" onClick={() => setTools({ open: true, tab: "card" })}>+</button>
          ) : <span key={`e${i}`} aria-hidden className="pw-empty" />)}
        </div>
      </div>
      <div className="wp-light" aria-hidden />
      {flip?.post && <FlipComposer cardId={flip.id} post={flip.post} slug={slug} onClose={() => setFlip(null)} onSent={() => undefined} />}

      {mode === "owner" && wallId && (
        <OwnerTools wallId={wallId} open={tools.open} onClose={() => setTools((t) => ({ ...t, open: false }))} tab={tools.tab} setTab={(tab) => setTools((t) => ({ ...t, tab }))}
          brick={brick} onBrick={setBrick} cards={cards} isActive={isActive} />
      )}
    </div>
  );
}
