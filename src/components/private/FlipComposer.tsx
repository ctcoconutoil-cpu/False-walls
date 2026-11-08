"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { PromptCard } from "@/components/private/PromptCard";
import { WallIcon, isWallIcon } from "@/components/wall/icons";
import { TONE } from "@/components/wall/WallCard";
import { sendToCard } from "@/lib/actions/private";
import type { ViewCard } from "@/lib/data/private";

const MAX = 500;

/**
 * The card lifts off the wall, turns over, and its back is a note to write on. Sending sticks the note to the wall.
 * No account is needed and nothing identifies the sender.
 */
export function FlipComposer({ card, onClose, onSent }: { card: ViewCard; onClose: () => void; onSent: (cardId: string) => void }) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<0 | 1 | 2>(reduce ? 2 : 0);
  const [k, setK] = useState(3);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const tone = TONE[card.color] ?? "red";
  const icon = isWallIcon(card.icon) ? card.icon : "star";

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
      const r = await sendToCard(card.id, body);
      if (r.ok) { setSent(body); onSent(card.id); } else setErr(r.error);
    });
  };
  const again = () => { setSent(null); setText(""); setErr(null); setTimeout(() => area.current?.focus(), 50); };

  return (
    <div className="pw-overlay" role="dialog" aria-modal="true" aria-label={`Send a message: ${card.title}`} onClick={() => { if (!pending) onClose(); }}>
      <div className="pw-scene" style={{ "--k": k } as CSSProperties} onClick={(e) => e.stopPropagation()}>
        <div className="pw-flip" data-stage={stage}>
          <div className={`pw-face pw-front wp-t-${tone}`} aria-hidden={stage === 2}>
            <div className="pw-scale"><PromptCard card={card} mode="visitor" /></div>
          </div>
          <div className={`pw-face pw-back wp-board wp-t-${tone}`} aria-hidden={stage !== 2}>
            <span aria-hidden className="wp-bricktex" />
            <div className="pw-back-head">
              <span className="pw-back-icon"><WallIcon name={icon} size={26} /></span>
              <span className="pw-back-title">{card.title}</span>
              <button type="button" onClick={onClose} disabled={pending} aria-label="Close" className="pw-x">✕</button>
            </div>
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
                <div className="pw-done-actions">
                  <button type="button" className="pw-send" onClick={again}>Send another</button>
                  <button type="button" className="pw-ghost" onClick={onClose}>Done</button>
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
