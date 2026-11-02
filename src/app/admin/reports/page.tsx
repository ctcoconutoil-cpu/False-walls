import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/data/session";
import { ReportActions } from "@/components/admin/AdminClient";
import { Empty } from "@/components/ui";
import { REPORT_REASONS } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

type Report = { id: string; reporter_id: string | null; source: string; target_type: string; target_id: string; reason: string; details: string | null; priority: number; status: string; created_at: string };

export default async function Reports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const status = sp.status === "actioned" || sp.status === "dismissed" ? sp.status : "open";
  const supabase = await createClient();
  const { data } = await supabase.from("reports").select("*").eq("status", status).order("priority", { ascending: false }).order("created_at", { ascending: true }).limit(50);
  const reports = (data ?? []) as Report[];

  async function preview(r: Report): Promise<{ text: string; author: string | null; authorName?: string; postId?: string; removed: boolean; link?: string }> {
    if (r.target_type === "post") {
      const { data: p } = await supabase.from("posts").select("id,title,body,clue,author_id,status,author:profiles!posts_author_id_fkey(username)").eq("id", r.target_id).maybeSingle();
      if (!p) return { text: "(deleted)", author: null, removed: false };
      return { text: [p.title, p.body, p.clue].filter(Boolean).join(" · "), author: p.author_id, authorName: (p.author as unknown as { username: string } | null)?.username, postId: p.id, removed: p.status !== "active", link: `/post/${p.id}` };
    }
    if (r.target_type === "answer") {
      const { data: a } = await supabase.from("answers").select("id,body,question_text,author_id,status,post_id").eq("id", r.target_id).maybeSingle();
      return a ? { text: `Q: ${a.question_text} · A: ${a.body}`, author: a.author_id, removed: a.status !== "active", link: `/post/${a.post_id}` } : { text: "(deleted)", author: null, removed: false };
    }
    if (r.target_type === "reply") {
      const { data: a } = await supabase.from("replies").select("id,body,author_id,status,post_id").eq("id", r.target_id).maybeSingle();
      return a ? { text: a.body, author: a.author_id, removed: a.status !== "active", link: `/post/${a.post_id}` } : { text: "(deleted)", author: null, removed: false };
    }
    if (r.target_type === "question") {
      const { data: q } = await supabase.from("questions").select("id,body,status").eq("id", r.target_id).maybeSingle();
      return q ? { text: q.body, author: null, removed: q.status === "deleted" } : { text: "(not available)", author: null, removed: false };
    }
    const { data: u } = await supabase.from("profiles").select("id,username,status").eq("id", r.target_id).maybeSingle();
    return u ? { text: `@${u.username} (${u.status})`, author: null, removed: u.status !== "active" } : { text: "(deleted)", author: null, removed: false };
  }
  const previews = await Promise.all(reports.map(preview));

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Reports</h1>
      <nav className="flex gap-2">{(["open", "actioned", "dismissed"] as const).map((s) => <Link key={s} href={`/admin/reports?status=${s}`} className={`rounded-full px-3.5 py-2 text-sm font-bold capitalize ${status === s ? "bg-chalk text-night" : "bg-night-3"}`}>{s}</Link>)}</nav>
      {reports.length === 0 ? <Empty title="The queue is clear" /> : (
        <ul className="space-y-3">{reports.map((r, i) => {
          const pv = previews[i];
          return (
            <li key={r.id} className="space-y-3 rounded-2xl bg-night-2 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 font-bold ${r.priority >= 3 ? "bg-danger text-[#3a0808]" : r.priority === 2 ? "bg-mustard text-[#2c1e02]" : "bg-night-3"}`}>Priority {r.priority}</span>
                <span className="rounded bg-night-3 px-2 py-0.5 font-bold uppercase">{r.target_type}</span>
                <span>{REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason}</span>
                <span className="text-chalk-dim">{r.source === "auto" ? "Flagged automatically" : "Reported by a member"} · {timeAgo(r.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap rounded-xl bg-night p-3">{pv.text || "(no text)"}</p>
              {pv.authorName && <p className="text-xs text-chalk-dim">Author: @{pv.authorName}</p>}
              {r.details && <p className="text-sm text-chalk-dim">Reporter note: {r.details}</p>}
              {pv.link && <Link href={pv.link} className="text-sm text-mustard underline">View in context</Link>}
              {status === "open" && <ReportActions reportId={r.id} targetType={r.target_type} targetId={r.target_id} authorId={pv.author} postId={pv.postId} canRestore={pv.removed && r.target_type !== "question" && r.target_type !== "user"} canTrend={r.target_type === "post"} />}
            </li>);
        })}</ul>
      )}
    </div>
  );
}
