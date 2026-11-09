"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { WallItem } from "@/components/maze/WallItem";
import { WallIcon, isWallIcon } from "@/components/wall/icons";
import { TONE, iconOf } from "@/components/wall/WallCard";
import { PICK_MARK } from "@/lib/constants";
import { sendToCard } from "@/lib/actions/private";
import type { WallPost } from "@/lib/data/wall";

const MAX = 500;

/**
 * The card lifts off the wall, turns over, and its back is a note to write on. Sending sticks the note to the wall.
 * No account is needed and nothing identifies the sender.
 */
export function FlipComposer({ cardId, post, slug, onClose, onSent }: { cardId: string; post: WallPost; slug: string; onClose: () => void; onSent: (cardId: string) => void }) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<0 | 1 | 2>(reduce ? 2 : 0);
  const [k, setK] = useState(3);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const tone = TONE[post.wall_color] ?? "red";
  const pick = !!post.body?.startsWith(PICK_MARK);
  // Only what matters about the note: its title (or clue), and for Ask Me the line under it.
  const heading = (pick ? post.title || "Pick a number" : post.type === "hidden_thought" || post.type === "false_wall" ? post.clue : post.title ?? post.clue ?? post.body) ?? "Say something";
  const sub = post.type === "ask_me" && !pick && post.body ? post.body : post.type === "prompt_response" ? null : null;
  const icon = pick ? "star" : iconOf(post);
  void isWallIcon;

  useEffect(() => {
    const size = () => setK(Math.max(2.2, Math.min(3.3, (window.innerWidth * 0.82) / 100, (window.innerHeight * 0.74) / 150)));
    size(); window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, []);
  useEffect(() => {
    if (reduce) return;
    const a = requestAnimationFrame(() => setStage(1));
    const b = setTimeout(() => setStage(2), 520);
    return () => { cancelAnimationFrame(a); clearTimeout(b); };
  }, [reduce]);
  useEffect(() => { if (stage === 2 && !sent) { const t = setTimeout(() => area.current?.focus(), reduce ? 0 : 700); return () => clearTimeout(t); } }, [stage, sent, reduce]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !pending) onClose(); };
    document.addEventListener("keydown", esc);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = o; };
  }, [onClose, pending]);

  const send = (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const body = text.trim(); if (!body) return;
    start(async () => {
      const r = await sendToCard(cardId, body, slug);
      if (r.ok) { setSent(body); onSent(cardId); } else setErr(r.error);
    });
  };

  return (
    <div className="pw-overlay" role="dialog" aria-modal="true" aria-label={`Send a message: ${heading}`} onClick={() => { if (!pending) onClose(); }}>
      <div className="pw-scene" style={{ "--k": k } as CSSProperties} onClick={(e) => e.stopPropagation()}>
        <div className="pw-flip" data-stage={stage}>
          <div className={`pw-face pw-front wp-t-${tone}`} aria-hidden={stage === 2}>
            <div className="pw-scale"><div className="h-[125px] w-[100px]"><WallItem post={post} compact /></div></div>
          </div>
          <div className={`pw-face pw-back wp-board wp-t-${tone}`} aria-hidden={stage !== 2}>
            <span aria-hidden className="wp-bricktex" />
            <div className="pw-back-head">
              <span className="pw-back-icon"><WallIcon name={icon} size={26} /></span>
              <span className="pw-back-title">{heading}</span>
              <button type="button" onClick={onClose} disabled={pending} aria-label="Close" className="pw-x">✕</button>
            </div>
            {sub && <p className="pw-back-sub">{sub}</p>}
            {sent === null ? (
              <form onSubmit={send} className="pw-form">
                <label className="sr-only" htmlFor="pw-msg">Your anonymous message</label>
                <textarea id="pw-msg" ref={area} className="pw-paper" value={text} maxLength={MAX} rows={6} onChange={(e) => setText(e.target.value)} placeholder="Write anything. Nobody will know it was you." />
                <div className="pw-meta"><span>{text.length}/{MAX}</span><span>100% anonymous</span></div>
                {err && <p role="alert" className="pw-err">{err}</p>}
                <button type="submit" className="pw-send" disabled={pending || !text.trim()}>{pending ? "Sticking it up…" : "Send"}</button>
              </form>
            ) : (
              <div className="pw-form pw-done">
                <p className="pw-paper pw-stuck-note">{sent}</p>
                <p className="pw-done-title">Stuck to the wall!</p>
                <p className="pw-meta"><span>Thanks. You can send one message to each wall.</span></p>
                <div className="pw-done-actions">
                  <button type="button" className="pw-send" onClick={onClose}>Done</button>
                </div>
                <Link href="/signup" className="pw-own">Want your own wall? Make one</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
