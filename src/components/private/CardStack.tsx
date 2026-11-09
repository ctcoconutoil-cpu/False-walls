"use client";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { WallIcon, isWallIcon } from "@/components/wall/icons";
import { deleteMessage, markCardRead, replyToMessage } from "@/lib/actions/private";
import type { InboxNote, Message } from "@/lib/data/private";
import { WALL_COLORS } from "@/lib/constants";
import type { WallColor } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

// The page takes on the colour of the card it belongs to: the header and every accent button follow it.
const ACCENT: Record<WallColor, { bg: string; ink: string }> = {
  coral: { bg: "#E51F2B", ink: "#fff" }, mustard: { bg: "#F9A719", ink: "#2A1A05" }, teal: { bg: "#1879D2", ink: "#fff" }, sky: { bg: "#1879D2", ink: "#fff" },
  violet: { bg: "#8B4CC4", ink: "#fff" }, lime: { bg: "#F9A719", ink: "#2A1A05" }, rose: { bg: "#D5B5A5", ink: "#3A1D14" }, slate: { bg: "#F6EFE4", ink: "#29252A" },
};
const size = (t: string) => (t.length <= 50 ? 44 : t.length <= 120 ? 34 : t.length <= 240 ? 27 : 22);

/** The owner's inbox for one prompt: messages as paper notes in a stack you swipe through. */
const KIND_ICON = { ask_me: "mega", hidden_thought: "eye", picture: "camera", prompt_response: "star", false_wall: "ask", prompt: "star" } as const;

export function CardStack({ note, messages: initial }: { note: InboxNote; messages: Message[] }) {
  const card = { ...note.card, title: note.heading }, slug = note.slug;
  const canReply = note.kind === "ask_me";
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState(initial);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState<"share" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const c = WALL_COLORS[card.color] ?? WALL_COLORS.coral, a = ACCENT[card.color] ?? ACCENT.coral;
  const icon = isWallIcon(KIND_ICON[note.kind]) ? KIND_ICON[note.kind] : "star";
  const m = messages[i];
  useEffect(() => { setDraft(m?.reply ?? ""); }, [m?.id, m?.reply]);
  const newCount = initial.filter((x) => x.isNew).length;

  useEffect(() => { if (initial.some((x) => x.isNew)) void markCardRead(card.id); }, [card.id, initial]);
  const go = useCallback((d: 1 | -1) => { setConfirm(false); setDir(d); setI((n) => Math.max(0, Math.min(messages.length - 1, n + d))); }, [messages.length]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [go]);

  const share = async () => {
    if (!m) return; setBusy("share"); setMsg(null);
    try {
      const res = await fetch(`/private/${card.id}/story?m=${m.id}`);
      if (!res.ok) throw new Error("image");
      const blob = await res.blob();
      const file = new File([blob], "false-walls-story.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `Send me anonymous messages: ${location.origin}/u/${slug}` });
      else { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "false-walls-story.png"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); setMsg("Story image saved. Post it to your story."); }
    } catch (e) { if ((e as Error).name !== "AbortError") setMsg("Couldn't make the image. Try again."); }
    setBusy(null);
  };
  const saveReply = async () => {
    if (!m) return; setSaving(true); setMsg(null);
    const r = await replyToMessage(m.id, draft);
    if (r.ok) { const v = draft.trim() || null; setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, reply: v } : x))); setMsg(v ? "Reply saved. It will show on your Share Story." : "Reply removed."); }
    else setMsg(r.error);
    setSaving(false);
  };
  const del = async () => {
    if (!m) return;
    if (!confirm) { setConfirm(true); return; }
    setBusy("delete");
    const r = await deleteMessage(m.id);
    if (r.ok) { setMessages((l) => l.filter((x) => x.id !== m.id)); setI((n) => Math.max(0, Math.min(n, messages.length - 2))); }
    setConfirm(false); setBusy(null);
  };
  const btn = "rounded-2xl px-5 py-3 text-base font-black disabled:opacity-60";

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: `linear-gradient(180deg, ${c.dark} 0%, #14112a 55%)` }}>
      <header className="rounded-b-[28px] px-3 pb-4 shadow-[0_8px_24px_rgba(0,0,0,.5)]" style={{ background: c.base, color: c.ink, paddingTop: "max(env(safe-area-inset-top), 10px)" }}>
        <div className="flex items-center gap-2">
          <Link href="/private" aria-label="Back to my wall" className="grid h-11 w-11 place-items-center rounded-full active:bg-black/10">
            <svg aria-hidden viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14.5 5-7 7 7 7" /></svg>
          </Link>
          <WallIcon name={icon} size={34} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl leading-none" style={{ fontFamily: '"Caveat Brush", var(--font-display), cursive', fontWeight: 400 }}>{card.title}</h1>
            <p className="mt-0.5 text-xs font-bold opacity-80">{messages.length === 0 ? "No messages yet" : `${messages.length} message${messages.length === 1 ? "" : "s"}${newCount ? ` · ${newCount} new` : ""}`}</p>
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center px-5 pt-8">
        {!m ? (
          <div className="mt-10 max-w-xs text-center">
            <WallIcon name={icon} size={64} className="mx-auto opacity-60" />
            <p className="mt-4 text-xl font-black">Nothing here yet</p>
            <p className="mt-1 text-chalk-dim">Share your link. Messages land here as paper notes you can swipe through.</p>
            <button type="button" className={`${btn} mt-5`} style={{ background: a.bg, color: a.ink }} onClick={() => navigator.clipboard?.writeText(`${location.origin}/u/${slug}`).then(() => setMsg("Link copied"))}>Copy my link</button>
          </div>
        ) : (
          <>
            <div className="relative h-[52dvh] max-h-[440px] min-h-[300px] w-full max-w-[340px]" aria-live="polite">
              {[2, 1].map((o) => messages[i + o] && (
                <div key={messages[i + o].id} aria-hidden className="pw-msg absolute inset-0" style={{ transform: `translateY(${o * 12}px) scale(${1 - o * 0.05}) rotate(${o % 2 ? 2.2 : -2.4}deg)`, opacity: 1 - o * 0.25 }} />
              ))}
              <AnimatePresence custom={dir} mode="popLayout">
                <motion.article key={m.id} custom={dir} className="pw-msg absolute inset-0" drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7}
                  onDragEnd={(_, info) => { if (info.offset.x < -90 || info.velocity.x < -500) go(1); else if (info.offset.x > 90 || info.velocity.x > 500) go(-1); }}
                  variants={{ enter: { opacity: 0, scale: 0.92, y: 20 }, show: { opacity: 1, scale: 1, y: 0, x: 0, rotate: -1.2 }, exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -380, rotate: d * -12 }) }}
                  initial={reduce ? "show" : "enter"} animate="show" exit="exit" transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                  <i aria-hidden className="pw-tape" style={{ left: "18%" }} /><i aria-hidden className="pw-tape" style={{ right: "18%" }} />
                  <p className="pw-msg-text" style={{ fontSize: size(m.body) }}>{m.body}</p>
                  {m.reply && <p className="pw-msg-reply" aria-label="Your reply"><b>You:</b> {m.reply}</p>}
                  <p className="pw-msg-meta"><span>Anonymous · {timeAgo(m.created_at)}</span>{m.isNew && <b style={{ background: a.bg, color: a.ink }}>NEW</b>}</p>
                </motion.article>
              </AnimatePresence>
            </div>
            <div className="mt-5 flex items-center gap-4" role="group" aria-label="Browse messages">
              <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous message" className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/25 text-white disabled:opacity-30">‹</button>
              <span className="min-w-16 text-center text-sm font-bold text-chalk-dim">{i + 1} of {messages.length}</span>
              <button type="button" onClick={() => go(1)} disabled={i >= messages.length - 1} aria-label="Next message" className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/25 text-white disabled:opacity-30">›</button>
            </div>
            {canReply && (
              <div className="mt-4 w-full max-w-[340px]">
                <label htmlFor="pw-reply" className="mb-1 block text-xs font-bold text-chalk-dim">Your reply (optional). It shows under the message on your Share Story.</label>
                <div className="flex gap-2">
                  <input id="pw-reply" value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} placeholder="Write a reply…" className="min-w-0 flex-1 rounded-xl bg-night-3 px-3 py-2.5 text-base text-chalk" />
                  <button type="button" onClick={saveReply} disabled={saving || draft.trim() === (m.reply ?? "")} className="rounded-xl px-4 text-sm font-black disabled:opacity-40" style={{ background: a.bg, color: a.ink }}>{saving ? "…" : "Save"}</button>
                </div>
              </div>
            )}
            <div className="mt-5 flex w-full max-w-[340px] gap-3 pb-8">
              <button type="button" onClick={share} disabled={busy !== null} className={`${btn} flex-1`} style={{ background: a.bg, color: a.ink, boxShadow: "0 5px 0 rgba(0,0,0,.35)" }}>{busy === "share" ? "Making image…" : "📤 Share Story"}</button>
              <button type="button" onClick={del} disabled={busy !== null} className={`${btn} border-2`} style={{ borderColor: confirm ? "#E51F2B" : "rgba(255,255,255,.25)", color: confirm ? "#ff6b73" : "#fff" }}>{confirm ? "Tap to confirm" : "Delete"}</button>
            </div>
          </>
        )}
        {msg && <p role="status" className="pb-6 text-center text-sm font-bold text-chalk-dim">{msg}</p>}
      </main>
    </div>
  );
}
