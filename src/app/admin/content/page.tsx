import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/data/session";
import { ContentActions } from "@/components/admin/AdminClient";
import { POST_TYPES } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

export default async function Content({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const status = ["active", "hidden", "removed"].includes(sp.status ?? "") ? sp.status! : "active";
  const supabase = await createClient();
  const [{ data }, { data: over }] = await Promise.all([
    supabase.from("posts").select("id,type,title,body,clue,status,created_at,is_sample,author:profiles!posts_author_id_fkey(username)").eq("status", status).eq("is_sample", false).order("created_at", { ascending: false }).limit(50),
    supabase.from("trending_overrides").select("post_id"),
  ]);
  const suppressed = new Set((over ?? []).map((o) => o.post_id as string));
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Content</h1>
      <nav className="flex gap-2">{["active", "hidden", "removed"].map((s) => <Link key={s} href={`/admin/content?status=${s}`} className={`rounded-full px-3.5 py-2 text-sm font-bold capitalize ${status === s ? "bg-chalk text-night" : "bg-night-3"}`}>{s}</Link>)}</nav>
      <ul className="space-y-2">{(data ?? []).map((p) => (
        <li key={p.id} className="space-y-2 rounded-2xl bg-night-2 p-3">
          <p className="text-xs text-chalk-dim">{POST_TYPES[p.type as keyof typeof POST_TYPES].label} · @{(p.author as unknown as { username: string } | null)?.username} · {timeAgo(p.created_at)}{suppressed.has(p.id) ? " · hidden from trending" : ""}</p>
          <p>{[p.title, p.body, p.clue].filter(Boolean).join(" · ")}</p>
          <Link href={`/post/${p.id}`} className="text-sm text-mustard underline">View</Link>
          <ContentActions id={p.id} status={p.status} suppressed={suppressed.has(p.id)} />
        </li>))}
        {(data ?? []).length === 0 && <li className="text-chalk-dim">Nothing here.</li>}
      </ul>
    </div>
  );
}
