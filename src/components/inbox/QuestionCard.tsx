"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar, Button, Field, Notice, Sheet, inputCls } from "@/components/ui";
import { ReportButton } from "@/components/wall/Interactions";
import { ShareSheet } from "@/components/share/ShareSheet";
import { shareQuestion } from "@/lib/actions/share";
import { answerQuestion, blockQuestionSender, deleteQuestion, rejectQuestion, markNotificationsRead } from "@/lib/actions/social";
import { LIMITS } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

export type QuestionRow = {
  id: string; body: string; is_anonymous: boolean; created_at: string; status: string;
  post: { id: string; title: string | null; clue: string | null; body: string | null; type: string } | null;
  asker: { username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null } | null;
};

export function QuestionCard({ q }: { q: QuestionRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pub, setPub] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const share = () => { setErr(null); if (shareToken) { setShareOpen(true); return; } start(async () => { const r = await shareQuestion(q.id); if (r.ok) { setShareToken(r.token); setShareOpen(true); } else setErr(r.error); }); };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) setErr(r.error ?? "Something went wrong."); else router.refresh(); });
  const about = q.post ? q.post.title ?? q.post.clue ?? q.post.body ?? "a wall" : "a wall";
  return (
    <article className="space-y-3 rounded-2xl bg-night-2 p-4">
      <div className="flex items-center gap-2 text-sm">
        {q.asker ? <Link href={`/profile/${q.asker.username}`} className="flex items-center gap-2 font-bold"><Avatar user={q.asker} size={28} />{q.asker.display_name || q.asker.username}</Link>
          : <span className="flex items-center gap-2 font-bold"><span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-night-3">?</span>Anonymous</span>}
        <span className="text-chalk-dim">· {timeAgo(q.created_at)}</span>
      </div>
      <p className="display text-xl leading-snug">{q.body}</p>
      {q.post && <p className="text-xs text-chalk-dim">On <Link href={`/post/${q.post.id}`} className="underline">{about}</Link></p>}
      {err && <Notice tone="error">{err}</Notice>}
      {q.status === "pending" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" tone="mustard" onClick={() => setOpen(true)}>Answer</Button>
          <Button size="sm" tone="ghost" disabled={pending} onClick={() => run(() => rejectQuestion(q.id))}>Reject</Button>
          <Button size="sm" tone="ghost" disabled={pending} onClick={() => run(() => deleteQuestion(q.id))}>Delete</Button>
          <Button size="sm" tone="danger" disabled={pending} onClick={() => { if (confirm("Block this sender? They won't see your walls or be able to contact you. You still won't learn who they are.")) run(() => blockQuestionSender(q.id)); }}>Block sender</Button>
          <ReportButton type="question" id={q.id} />
        </div>
      ) : <p className="text-xs font-bold uppercase tracking-wide text-chalk-dim">{q.status}</p>}
      {q.is_anonymous && (q.status === "pending" || q.status === "answered") && (
        <div><Button size="sm" tone="ghost" disabled={pending} onClick={share}>↗ Share this question</Button></div>
      )}
      {shareToken && <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} path={`/q/${shareToken}`} imagePath={`/q/${shareToken}/card`} title="Share this question" text="Send me anonymous questions too" />}
      <Sheet open={open} onClose={() => setOpen(false)} title="Answer this question">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setErr(null); start(async () => { const r = await answerQuestion(q.id, text, pub); if (!r.ok) setErr(r.error); else { setOpen(false); router.refresh(); } }); }}>
          <p className="rounded-xl bg-night-3 p-3">{q.body}</p>
          <Field label="Your answer" counter={`${text.length}/${LIMITS.answer}`}><textarea required rows={5} maxLength={LIMITS.answer} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} /></Field>
          <label className="flex items-start gap-3"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} className="mt-1 h-5 w-5 accent-mustard" />
            <span><span className="block font-semibold">Show this answer on the wall</span><span className="block text-xs text-chalk-dim">If you leave this off, only the person who asked sees it. The question and answer appear without revealing an anonymous asker.</span></span></label>
          {err && <Notice tone="error">{err}</Notice>}
          <Button type="submit" disabled={pending || !text.trim()} className="w-full">{pending ? "Sending…" : pub ? "Answer publicly" : "Answer privately"}</Button>
        </form>
      </Sheet>
    </article>
  );
}

export function MarkRead() {
  const router = useRouter();
  useEffect(() => { const t = window.setTimeout(() => { void markNotificationsRead().then(() => router.refresh()); }, 1800); return () => window.clearTimeout(t); }, [router]);
  return null;
}
