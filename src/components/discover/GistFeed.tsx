"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Notice, inputCls } from "@/components/ui";
import { addGistComment, deleteGist, deleteGistComment, loadGistComments, postGist, reactToGist } from "@/lib/actions/discover";
import { GIST_MAX } from "@/lib/constants";
import { GIST_REACTIONS, type Gist, type GistComment, type GistReaction } from "@/lib/gist";
import { timeAgo } from "@/lib/utils";

export function GistComposer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-2 rounded-2xl bg-night-2 p-3" onSubmit={(e) => { e.preventDefault(); setErr(null); start(async () => { const r = await postGist(text); if (r.ok) { setText(""); router.refresh(); } else setErr(r.error); }); }}>
      <label className="sr-only" htmlFor="gist-text">Share something on Walls Gist</label>
      <textarea id="gist-text" className={`${inputCls} min-h-20 resize-none`} maxLength={GIST_MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share something on Walls Gist" />
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-chalk-dim">{text.length}/{GIST_MAX}</span>
        <button type="submit" disabled={pending || !text.trim()} className="btn-press rounded-xl bg-[#E51F2B] px-5 py-2.5 font-extrabold text-white disabled:opacity-50">Post</button>
      </div>
    </form>
  );
}

/** One Walls Gist post: text, reactions, comments and share. */
export function GistCard({ g, startOpen = false }: { g: Gist; startOpen?: boolean }) {
  const [my, setMy] = useState<GistReaction | null>(g.my);
  const [counts, setCounts] = useState(g.reactions);
  const [open, setOpen] = useState(startOpen);
  const [comments, setComments] = useState<GistComment[] | null>(null);
  const [total, setTotal] = useState(g.comments);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const refresh = () => loadGistComments(g.id).then((c) => { setComments(c); setTotal(c.length); });
  useEffect(() => { if (open && comments === null) refresh(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (gone) return null;

  const react = (kind: GistReaction) => start(async () => {
    setErr(null);
    const r = await reactToGist(g.id, kind);
    if (!r.ok) { setErr(r.error); return; }
    setCounts((c) => {
      const n = { ...c };
      if (my) n[my] = Math.max(0, (n[my] ?? 1) - 1);
      if (r.my) n[r.my as GistReaction] = (n[r.my as GistReaction] ?? 0) + 1;
      return n;
    });
    setMy((r.my as GistReaction | null) ?? null);
  });
  const share = async () => {
    const url = `${location.origin}/gist/${g.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Walls Gist", text: g.body.slice(0, 100), url });
      else { await navigator.clipboard.writeText(url); setNote("Link copied"); setTimeout(() => setNote(null), 1800); }
    } catch { /* cancelled */ }
  };
  const send = (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    start(async () => { const r = await addGistComment(g.id, text); if (r.ok) { setText(""); await refresh(); } else setErr(r.error); });
  };
  const round = "grid min-h-11 min-w-11 place-items-center rounded-full border-2 border-night-3 px-3 text-sm font-bold text-chalk-dim";

  return (
    <li className="space-y-3 rounded-2xl bg-night-2 p-4">
      <div className="flex items-center gap-2.5">
        <Avatar user={g.author} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={`/profile/${g.author.username}`} className="block truncate font-bold">{g.author.display_name || g.author.username}</Link>
          <span className="text-xs text-chalk-dim">{timeAgo(g.created_at)}</span>
        </div>
        {g.mine && <button type="button" disabled={pending} className="text-xs font-bold text-chalk-dim underline" onClick={() => { if (confirm("Delete this post?")) start(async () => { const r = await deleteGist(g.id); if (r.ok) setGone(true); }); }}>Delete</button>}
      </div>
      <p className="whitespace-pre-line break-words border-l-4 border-night-3 pl-3 text-[17px] leading-snug">{g.body}</p>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Reactions">
        {GIST_REACTIONS.map(([k, emoji, label]) => {
          const n = counts[k] ?? 0; const on = my === k;
          return (
            <button key={k} type="button" aria-pressed={on} aria-label={`${label}${n ? `, ${n}` : ""}`} disabled={pending} onClick={() => react(k)}
              className={`flex min-h-11 items-center gap-1 rounded-full border-2 px-2.5 text-base ${on ? "border-mustard bg-mustard/15" : "border-night-3"}`}>
              <span aria-hidden>{emoji}</span>{n > 0 && <span className="text-sm font-bold">{n}</span>}
            </button>
          );
        })}
        <span className="flex-1" />
        <button type="button" aria-expanded={open} aria-label={`Comments, ${total}`} onClick={() => setOpen((o) => !o)} className={round}>💬 {total > 0 ? total : ""}</button>
        <button type="button" aria-label="Share" onClick={share} className={round}>{note ?? "↗ Share"}</button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-night-3 pt-3">
          {comments === null ? <p className="text-sm text-chalk-dim">Loading…</p> : comments.length === 0 ? <p className="text-sm text-chalk-dim">No comments yet. Be the first.</p> : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar user={c.author} size={30} />
                  <div className="min-w-0 flex-1 rounded-2xl bg-night px-3 py-2">
                    <p className="flex items-center gap-2 text-xs text-chalk-dim"><Link href={`/profile/${c.author.username}`} className="font-bold text-chalk">{c.author.display_name || c.author.username}</Link>{timeAgo(c.created_at)}
                      {c.mine && <button type="button" className="ml-auto underline" onClick={() => start(async () => { const r = await deleteGistComment(c.id); if (r.ok) refresh(); })}>Delete</button>}</p>
                    <p className="whitespace-pre-line break-words">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={send} className="flex gap-2">
            <label className="sr-only" htmlFor={`c-${g.id}`}>Leave a comment</label>
            <input id={`c-${g.id}`} className={inputCls} value={text} maxLength={280} onChange={(e) => setText(e.target.value)} placeholder="Leave a comment" autoComplete="off" />
            <button type="submit" disabled={pending || !text.trim()} className="btn-press shrink-0 rounded-xl bg-[#E51F2B] px-4 font-extrabold text-white disabled:opacity-50">Post</button>
          </form>
        </div>
      )}
      {err && <Notice tone="error">{err}</Notice>}
    </li>
  );
}
export function GistList({ gists }: { gists: Gist[] }) {
  return <ul className="space-y-3">{gists.map((g) => <GistCard key={g.id} g={g} />)}</ul>;
}
