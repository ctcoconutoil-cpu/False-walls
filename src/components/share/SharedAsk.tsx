"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Notice, inputCls } from "@/components/ui";
import { sendGuestQuestion, sendQuestionViaLink } from "@/lib/actions/share";
import { LIMITS } from "@/lib/constants";
import { cx } from "@/lib/utils";

type Props = { token: string; template: "pick_number" | null; options: string[]; allowAnonymous: boolean; loggedIn: boolean; accent: string; ink: string };

/** The part of a shared wall that visitors use: pick a number, or type a question. */
export function SharedAsk({ token, template, options, allowAnonymous, loggedIn, accent, ink }: Props) {
  const [pick, setPick] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(allowAnonymous);
  const canSend = loggedIn || allowAnonymous; // visitors without an account can only send anonymously
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const next = encodeURIComponent(`/w/${token}`);

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <Notice tone="ok">Sent. They'll see it in their inbox{anon && allowAnonymous ? ", without your name" : ""}.</Notice>
        <Button tone="ghost" onClick={() => { setDone(false); setPick(null); setText(""); }}>Send another</Button>
        <p className="text-sm text-chalk-dim">Want your own wall people can send questions to? <Link href="/create/private" className="font-bold text-mustard underline">Make one</Link></p>
      </div>
    );
  }

  const body = template === "pick_number" ? (pick ? `Pick ${pick}: ${options[pick - 1]}` : "") : text.trim();
  const send = (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    start(async () => { const r = loggedIn ? await sendQuestionViaLink(token, body, anon && allowAnonymous) : await sendGuestQuestion(token, body); if (r.ok) setDone(true); else setErr(r.error); });
  };

  return (
    <form onSubmit={send} className="space-y-4">
      {template === "pick_number" && (
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Pick a number">
          {options.map((o, i) => {
            const n = i + 1, on = pick === n;
            return (
              <li key={n}>
                <button type="button" aria-pressed={on} onClick={() => setPick(on ? null : n)}
                  className={cx("flex min-h-14 w-full items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors", on ? "text-night" : "border-night-3 bg-[#ece7de] text-[#1b1730]")}
                  style={on ? { background: accent, borderColor: accent, color: ink } : undefined}>
                  <span aria-hidden className="display grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/10 text-lg">{n}</span>
                  <span className="pt-1 text-sm font-semibold leading-snug">{o}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {template !== "pick_number" && (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Your question</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={LIMITS.question} required className={inputCls} placeholder="Ask anything" />
        </label>
      )}
      {loggedIn && (template !== "pick_number" || pick) && (
        <label className={cx("flex items-start gap-3 rounded-xl border-2 p-3", anon && allowAnonymous ? "border-mustard" : "border-night-3", !allowAnonymous && "opacity-60")}>
          <input type="checkbox" checked={anon && allowAnonymous} disabled={!allowAnonymous} onChange={(e) => setAnon(e.target.checked)} className="mt-1 h-5 w-5 accent-mustard" />
          <span><span className="block font-bold">Send anonymously</span><span className="block text-xs text-chalk-dim">{allowAnonymous ? "They won't see your name." : "This wall only takes questions with your name on them."}</span></span>
        </label>
      )}
      {err && <Notice tone="error">{err}</Notice>}
      {canSend ? (
        (template !== "pick_number" || pick) && (
          <>
            {!loggedIn && <p className="text-center text-sm text-chalk-dim">No account needed. Your message is sent anonymously.</p>}
            <Button type="submit" className="w-full" disabled={pending || !body}>{pending ? "Sending…" : "Send"}</Button>
          </>
        )
      ) : (
        <div className="space-y-2 rounded-xl bg-night-2 p-3 text-center">
          <p className="text-sm text-chalk-dim">This wall only takes messages with your name on them. Log in to send one.</p>
          <div className="flex justify-center gap-2"><Link href={`/signup?next=${next}`} className="rounded-xl bg-mustard px-4 py-2.5 font-bold text-[#2c1e02]">Join</Link><Link href={`/login?next=${next}`} className="rounded-xl bg-night-3 px-4 py-2.5 font-bold">Log in</Link></div>
        </div>
      )}
    </form>
  );
}
