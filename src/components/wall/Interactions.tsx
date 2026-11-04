"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Field, Notice, Sheet, inputCls } from "@/components/ui";
import { REACTIONS, REPORT_REASONS, LIMITS } from "@/lib/constants";
import { deletePost, deleteReply, editPost, postReply, recordDiscovery, reportContent, setReaction, toggleSave, deleteMedia } from "@/lib/actions/posts";
import { sendQuestion, setAnswerPublic, deleteAnswer } from "@/lib/actions/social";
import type { ReactionKind } from "@/lib/types";
import { cx } from "@/lib/utils";

export function DiscoveryPing({ kind, id }: { kind: "wall_explored" | "chain_explored"; id: string }) {
  useEffect(() => {
    const key = `fw-d:${kind}:${id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
    void recordDiscovery(kind, id);
  }, [kind, id]);
  return null;
}

export function ReactionBar({ type, id, counts, mine, loggedIn, own }: { type: "post" | "answer" | "reply"; id: string; counts: Partial<Record<ReactionKind, number>>; mine: ReactionKind | null; loggedIn: boolean; own?: boolean }) {
  const [state, setState] = useState({ counts, mine });
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  function press(kind: ReactionKind) {
    if (!loggedIn) { setMsg("Log in to react."); return; }
    if (own) { setMsg("You can't react to your own wall."); return; }
    const prev = state;
    const next = prev.mine === kind ? null : kind;
    const c = { ...prev.counts };
    if (prev.mine) c[prev.mine] = Math.max(0, (c[prev.mine] ?? 1) - 1);
    if (next) c[next] = (c[next] ?? 0) + 1;
    setState({ counts: c, mine: next }); setMsg(null);
    start(async () => { const r = await setReaction(type, id, next); if (!r.ok) { setState(prev); setMsg(r.error); } });
  }
  // The coloured icons beside the buttons show which reactions this wall has received, most popular first. No numbers.
  const used = REACTIONS.filter((r) => (state.counts[r.kind] ?? 0) > 0).sort((x, y) => (state.counts[y.kind] ?? 0) - (state.counts[x.kind] ?? 0));
  return (
    <div>
      <div className="flex items-center gap-1">
        <div role="group" aria-label="React" className="flex items-center">
          {REACTIONS.map((r) => {
            const on = state.mine === r.kind;
            return (
              <button key={r.kind} type="button" aria-pressed={on} aria-label={r.label} title={r.label} onClick={() => press(r.kind)}
                className={cx("grid h-11 w-11 place-items-center bg-transparent text-[24px] leading-none transition-transform active:scale-90", on ? "scale-125" : "opacity-60 grayscale brightness-[1.9]")}>
                <span aria-hidden>{r.glyph}</span>
              </button>
            );
          })}
        </div>
        {used.length > 0 && (
          <span className="ml-2 flex items-center" role="img" aria-label={`Reactions received: ${used.map((r) => r.label).join(", ")}`}>
            {used.slice(0, 5).map((r, i) => <span key={r.kind} aria-hidden className="text-[20px] leading-none" style={{ marginLeft: i ? -6 : 0, zIndex: 10 - i }}>{r.glyph}</span>)}
          </span>
        )}
      </div>
      {msg && <p role="status" className="mt-1 text-xs text-[#ffb4b4]">{msg}</p>}
    </div>
  );
}

export function ReplyBox({ postId, answerId = null, parentId = null, loggedIn, onDone, placeholder = "Add to the conversation", autoFocus }: { postId: string; answerId?: string | null; parentId?: string | null; loggedIn: boolean; onDone?: () => void; placeholder?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!loggedIn) return <p className="text-sm text-chalk-dim"><Link className="font-bold text-mustard underline" href={`/login?next=/post/${postId}`}>Log in</Link> to reply.</p>;
  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault(); setErr(null);
      start(async () => { const r = await postReply(postId, text, answerId, parentId); if (!r.ok) setErr(r.error); else { setText(""); onDone?.(); router.refresh(); } });
    }}>
      <label className="sr-only" htmlFor={`r-${parentId ?? answerId ?? postId}`}>Reply</label>
      <textarea id={`r-${parentId ?? answerId ?? postId}`} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={LIMITS.reply} placeholder={placeholder} autoFocus={autoFocus} className={inputCls} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-chalk-dim">{text.length}/{LIMITS.reply}</span>
        <Button type="submit" size="sm" tone="teal" disabled={pending || !text.trim()}>{pending ? "Sending…" : "Reply"}</Button>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
    </form>
  );
}

export function AskBox({ postId, loggedIn, allowAnonymous, canAsk, reason }: { postId: string; loggedIn: boolean; allowAnonymous: boolean; canAsk: boolean; reason?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(allowAnonymous);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (!canAsk) return <p className="rounded-xl bg-night-3 px-3 py-2 text-sm text-chalk-dim">{reason ?? "Questions are off for this wall."}</p>;
  return (
    <>
      <Button tone="mustard" onClick={() => { if (!loggedIn) { router.push(`/login?next=/post/${postId}`); return; } setDone(false); setOpen(true); }}>Ask a question</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ask a question">
        {done ? (
          <div className="space-y-3"><Notice tone="ok">Sent. The creator decides whether to answer and whether the answer goes public.</Notice><Button tone="ghost" onClick={() => setOpen(false)}>Close</Button></div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setErr(null); start(async () => { const r = await sendQuestion(postId, text, anon && allowAnonymous); if (r.ok) { setDone(true); setText(""); } else setErr(r.error); }); }}>
            <Field label="Your question" counter={`${text.length}/${LIMITS.question}`}><textarea required value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={LIMITS.question} className={inputCls} /></Field>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">Who is asking?</legend>
              <label className={cx("flex items-start gap-3 rounded-xl border-2 p-3", anon && allowAnonymous ? "border-mustard" : "border-night-3", !allowAnonymous && "opacity-50")}>
                <input type="radio" name="who" checked={anon && allowAnonymous} disabled={!allowAnonymous} onChange={() => setAnon(true)} className="mt-1 accent-mustard" />
                <span><span className="block font-bold">Anonymous</span><span className="block text-xs text-chalk-dim">{allowAnonymous ? "Other people won't see who you are. Moderators can review sender details only if a question is reported for abuse." : "This person isn't taking anonymous questions."}</span></span>
              </label>
              <label className={cx("flex items-start gap-3 rounded-xl border-2 p-3", !(anon && allowAnonymous) ? "border-mustard" : "border-night-3")}>
                <input type="radio" name="who" checked={!(anon && allowAnonymous)} onChange={() => setAnon(false)} className="mt-1 accent-mustard" />
                <span><span className="block font-bold">With my profile</span><span className="block text-xs text-chalk-dim">They'll see your username and avatar.</span></span>
              </label>
            </fieldset>
            <p className="text-xs text-chalk-dim">Be kind. Threats, harassment and trying to work out who someone is aren't allowed, and you can be blocked or suspended.</p>
            {err && <Notice tone="error">{err}</Notice>}
            <Button type="submit" disabled={pending || !text.trim()} className="w-full">{pending ? "Sending…" : "Send question"}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}

export function ReportButton({ type, id, label = "Report" }: { type: "user" | "post" | "answer" | "reply" | "question"; id: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("harassment");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<{ ok?: true; err?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => { setState(null); setOpen(true); }} className="min-h-10 rounded-lg px-2 text-sm text-chalk-dim underline">{label}</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Report this">
        {state?.ok ? (
          <div className="space-y-3"><Notice tone="ok">Thanks. A moderator will review it. Reports are private.</Notice><Button tone="ghost" onClick={() => setOpen(false)}>Close</Button></div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await reportContent(type, id, reason, details); setState(r.ok ? { ok: true } : { err: r.error }); }); }}>
            <fieldset className="space-y-1.5"><legend className="mb-1 text-sm font-semibold">What's wrong?</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className={cx("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2", reason === r.value ? "border-mustard" : "border-night-3")}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-mustard" />{r.label}
                </label>
              ))}
            </fieldset>
            <Field label="Anything else? (optional)" counter={`${details.length}/500`}><textarea rows={2} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} className={inputCls} /></Field>
            {state?.err && <Notice tone="error">{state.err}</Notice>}
            <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending…" : "Send report"}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}

export function PostToolbar({ postId, saved, loggedIn, isPublic, owner }: { postId: string; saved: boolean; loggedIn: boolean; isPublic: boolean; owner: boolean }) {
  const [isSaved, setSaved] = useState(saved);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  const flash = (t: string) => { setMsg(t); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), 2400); };
  async function share() {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      if (navigator.share) await navigator.share({ title: "A wall on FALSE WALLS", url });
      else { await navigator.clipboard.writeText(url); flash("Link copied."); }
    } catch { /* cancelled */ }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" tone="ghost" disabled={pending} aria-pressed={isSaved} onClick={() => {
        if (!loggedIn) { flash("Log in to save walls."); return; }
        start(async () => { const r = await toggleSave(postId, !isSaved); if (r.ok) setSaved(!isSaved); else flash(r.error); });
      }}>{isSaved ? "Saved ✓" : "Save"}</Button>
      {isPublic && <Button size="sm" tone="ghost" onClick={share}>Share</Button>}
      {!owner && loggedIn && <ReportButton type="post" id={postId} />}
      {msg && <span role="status" className="text-xs text-mustard">{msg}</span>}
    </div>
  );
}

export function OwnerTools({ post, hiddenText, media }: { post: { id: string; type: string; title: string | null; body: string | null; clue: string | null }; hiddenText: string | null; media: { storage_path: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(false);
  const [f, setF] = useState({ title: post.title ?? "", body: post.body ?? "", clue: post.clue ?? "", hidden: hiddenText ?? "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const concealed = post.type === "hidden_thought" || post.type === "false_wall";
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" tone="ghost" onClick={() => setOpen(true)}>Edit</Button>
      <Button size="sm" tone="danger" onClick={() => setDel(true)}>Delete</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit your wall">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setErr(null); start(async () => { const r = await editPost(post.id, { title: f.title, body: f.body, clue: f.clue, hidden: concealed ? f.hidden : null }); if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error); }); }}>
          {(post.type === "ask_me" || post.type === "picture") && <Field label={post.type === "ask_me" ? "Invitation" : "Question or caption"}><input value={f.title} maxLength={LIMITS.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} /></Field>}
          {post.type !== "false_wall" && <Field label="Text"><textarea rows={3} value={f.body} maxLength={LIMITS.body} onChange={(e) => setF({ ...f, body: e.target.value })} className={inputCls} /></Field>}
          {concealed && <Field label="Clue"><input value={f.clue} maxLength={LIMITS.clue} onChange={(e) => setF({ ...f, clue: e.target.value })} className={inputCls} /></Field>}
          {concealed && <Field label="Hidden part"><textarea rows={4} value={f.hidden} maxLength={LIMITS.hidden} onChange={(e) => setF({ ...f, hidden: e.target.value })} className={inputCls} /></Field>}
          {post.type === "picture" && media.length > 1 && (
            <fieldset><legend className="mb-1 text-sm font-semibold">Pictures</legend>
              {media.map((m, i) => <Button key={m.storage_path} type="button" size="sm" tone="ghost" className="mr-2" onClick={() => start(async () => { const r = await deleteMedia(post.id, m.storage_path); if (r.ok) router.refresh(); else setErr(r.error); })}>Delete picture {i + 1}</Button>)}
            </fieldset>
          )}
          {err && <Notice tone="error">{err}</Notice>}
          <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Save changes"}</Button>
        </form>
      </Sheet>
      <Sheet open={del} onClose={() => setDel(false)} title="Delete this wall?">
        <p className="mb-4 text-chalk-dim">This removes the wall, its pictures, answers and replies for good.</p>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="mt-3 flex gap-2"><Button tone="danger" disabled={pending} onClick={() => start(async () => { const r = await deletePost(post.id); if (r.ok) router.push("/wall"); else setErr(r.error); })}>Delete wall</Button><Button tone="ghost" onClick={() => setDel(false)}>Keep it</Button></div>
      </Sheet>
    </div>
  );
}

export function ReplyActions({ postId, replyId, own, loggedIn }: { postId: string; replyId: string; own: boolean; loggedIn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!loggedIn) return null;
  return own ? (
    <button disabled={pending} className="min-h-9 text-xs text-chalk-dim underline" onClick={() => start(async () => { const r = await deleteReply(postId, replyId); if (r.ok) router.refresh(); })}>Delete</button>
  ) : <ReportButton type="reply" id={replyId} />;
}

export function AnswerActions({ answerId, own, isPublic }: { answerId: string; own: boolean; isPublic: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!own) return <ReportButton type="answer" id={answerId} />;
  return (
    <div className="flex gap-3 text-xs">
      <button disabled={pending} className="min-h-9 underline" onClick={() => start(async () => { await setAnswerPublic(answerId, !isPublic); router.refresh(); })}>{isPublic ? "Make private" : "Make public"}</button>
      <button disabled={pending} className="min-h-9 text-chalk-dim underline" onClick={() => start(async () => { await deleteAnswer(answerId); router.refresh(); })}>Delete</button>
    </div>
  );
}
