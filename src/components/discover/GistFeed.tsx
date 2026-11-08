"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Notice, inputCls } from "@/components/ui";
import { deleteGist, postGist, toggleGistLike } from "@/lib/actions/discover";
import { GIST_MAX } from "@/lib/constants";
import type { Gist } from "@/lib/data/discover";
import { timeAgo } from "@/lib/utils";

export function GistComposer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-2 rounded-2xl bg-night-2 p-3" onSubmit={(e) => { e.preventDefault(); setErr(null); start(async () => { const r = await postGist(text); if (r.ok) { setText(""); router.refresh(); } else setErr(r.error); }); }}>
      <label className="sr-only" htmlFor="gist-text">Share some gist</label>
      <textarea id="gist-text" className={`${inputCls} min-h-20 resize-none`} maxLength={GIST_MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share some gist with the people you follow" />
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-chalk-dim">{text.length}/{GIST_MAX}</span>
        <button type="submit" disabled={pending || !text.trim()} className="btn-press rounded-xl bg-[#E51F2B] px-5 py-2.5 font-extrabold text-white disabled:opacity-50">Post gist</button>
      </div>
    </form>
  );
}

function Row({ g }: { g: Gist }) {
  const [liked, setLiked] = useState(g.liked);
  const [likes, setLikes] = useState(g.likes);
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;
  return (
    <li className="space-y-2 rounded-2xl bg-night-2 p-4">
      <div className="flex items-center gap-2.5">
        <Avatar user={g.author} size={36} />
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={`/profile/${g.author.username}`} className="block truncate font-bold">{g.author.display_name || g.author.username}</Link>
          <span className="text-xs text-chalk-dim">{timeAgo(g.created_at)}</span>
        </div>
        {g.mine && <button type="button" disabled={pending} className="text-xs font-bold text-chalk-dim underline" onClick={() => { if (confirm("Delete this gist?")) start(async () => { const r = await deleteGist(g.id); if (r.ok) setGone(true); }); }}>Delete</button>}
      </div>
      <p className="whitespace-pre-line break-words text-[17px] leading-snug">{g.body}</p>
      <button type="button" aria-pressed={liked} disabled={pending} className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold ${liked ? "border-[#E51F2B] text-[#ff7b84]" : "border-night-3 text-chalk-dim"}`}
        onClick={() => start(async () => { const r = await toggleGistLike(g.id); if (r.ok) { setLiked(r.liked); setLikes((n) => n + (r.liked ? 1 : -1)); } })}>
        <span aria-hidden>{liked ? "♥" : "♡"}</span> {likes > 0 ? likes : "Like"}
      </button>
    </li>
  );
}
export function GistList({ gists }: { gists: Gist[] }) {
  return <ul className="space-y-3">{gists.map((g) => <Row key={g.id} g={g} />)}</ul>;
}
