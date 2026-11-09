"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { deleteGuestReply, guestReact, guestReply, loadGuest, type GuestState } from "@/lib/actions/guest";
import { REACTIONS } from "@/lib/constants";
import { Button, Notice, inputCls } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import type { ReactionKind } from "@/lib/types";

/** A random id kept in the visitor's own browser. It only stops repeat reactions; it says nothing about who they are. */
function guestKey(): string {
  try {
    let k = localStorage.getItem("fw_guest");
    if (!k) { k = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""); localStorage.setItem("fw_guest", k); }
    return k;
  } catch { return "session-" + Math.random().toString(16).slice(2).padEnd(24, "0"); }
}

/**
 * Reactions, numbered questions (for a Pick a number wall) and replies for a private-wall post.
 * No account is needed.
 */
export function GuestEngage({ postId, owner, questions }: { postId: string; owner: boolean; questions?: string[] | null }) {
  const [key, setKey] = useState("");
  const [state, setState] = useState<GuestState | null>(null);
  const [text, setText] = useState("");
  const [pick, setPick] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const refresh = useCallback(async (k: string) => { const s = await loadGuest(postId, k); if (s) setState(s); }, [postId]);
  useEffect(() => { const k = guestKey(); setKey(k); refresh(k); }, [refresh]);

  const react = (kind: ReactionKind) => start(async () => { setErr(null); const r = await guestReact(postId, kind, key); if (!r.ok) setErr(r.error); await refresh(key); });
  const send = () => start(async () => {
    setErr(null);
    const body = pick !== null ? `Q${pick + 1}: ${text.trim()}` : text.trim();
    if (!text.trim()) return;
    const r = await guestReply(postId, body, key);
    if (!r.ok) { setErr(r.error); return; }
    setText(""); setPick(null); await refresh(key);
  });
  const replies = state?.replies ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reactions">
        {REACTIONS.map((r) => {
          const n = state?.counts[r.kind] ?? 0; const on = state?.mine === r.kind;
          return (
            <button key={r.kind} type="button" aria-pressed={on} aria-label={`${r.label}${n ? `, ${n}` : ""}`} disabled={pending || !key} onClick={() => react(r.kind)}
              className="flex min-h-11 items-center gap-1 rounded-full border-2 px-2.5 text-base transition-transform active:scale-90" style={{ borderColor: on ? r.color : "#2c2748", background: on ? `${r.color}26` : "transparent" }}>
              <span aria-hidden>{r.glyph}</span>{n > 0 && <span className="text-sm font-bold tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>

      {questions && (
        <section aria-labelledby="pick-h" className="space-y-2">
          <h2 id="pick-h" className="text-2xl">Pick a number</h2>
          <ol className="space-y-2">
            {questions.map((q, i) => (
              <li key={i}>
                <button type="button" aria-pressed={pick === i} onClick={() => { setPick(pick === i ? null : i); setErr(null); }}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left ${pick === i ? "border-mustard bg-night-2" : "border-night-3"}`}>
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mustard font-black text-[#2c1e02]">{i + 1}</span>
                  <span className="font-semibold">{q}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="voices" className="space-y-3">
        <h2 id="voices" className="text-2xl">{questions ? (pick !== null ? `Answer question ${pick + 1}` : "Answers") : "The conversation"}</h2>
        {(!questions || pick !== null) && (
          <div className="space-y-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={480} aria-label="Your reply" className={inputCls} placeholder={pick !== null ? "Your answer" : "Leave reply"} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-chalk-dim">{text.length}/480 · No account needed</span>
              <Button type="button" size="sm" disabled={pending || !text.trim() || !key} onClick={send}>{pending ? "Sending…" : "Leave reply"}</Button>
            </div>
          </div>
        )}
        {err && <Notice tone="error">{err}</Notice>}
        {replies.length === 0 && state && <p className="rounded-2xl border-2 border-dashed border-night-3 p-4 text-center text-chalk-dim">Nobody has spoken yet. Be the first.</p>}
        <ol className="space-y-3">
          {replies.slice().reverse().map((r) => (
            <li key={r.id} className="rounded-2xl bg-night-2 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-chalk-dim"><span className="font-bold text-chalk">{r.mine ? "You" : "Visitor"}</span><span>· {timeAgo(r.created_at)}</span>
                {owner && <button type="button" className="ml-auto underline" onClick={() => start(async () => { await deleteGuestReply(r.id); await refresh(key); })}>Delete</button>}
              </div>
              <p className="whitespace-pre-wrap break-words">{r.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
