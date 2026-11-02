import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/data/session";
import { UserActions } from "@/components/admin/AdminClient";
import { Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { profile } = await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 20);
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id,username,display_name,avatar_style,avatar_color,avatar_url,role,status,age_group,created_at").order("created_at", { ascending: false }).limit(50);
  if (q) query = query.ilike("username", `%${q}%`);
  if (sp.status === "suspended") query = query.eq("status", "suspended");
  const { data } = await query;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Users</h1>
      <form className="flex gap-2"><input name="q" defaultValue={q} aria-label="Username" placeholder="Search usernames" className="min-h-11 flex-1 rounded-xl border-2 border-night-3 bg-night px-3.5" /><button className="min-h-11 rounded-xl bg-mustard px-4 font-black text-[#2c1e02]">Search</button></form>
      <nav className="flex gap-2"><Link href="/admin/users" className="rounded-full bg-night-3 px-3.5 py-2 text-sm font-bold">All</Link><Link href="/admin/users?status=suspended" className="rounded-full bg-night-3 px-3.5 py-2 text-sm font-bold">Suspended</Link></nav>
      <ul className="space-y-2">{(data ?? []).map((u) => (
        <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-night-2 p-3">
          <span className="flex items-center gap-3"><Avatar user={u} size={40} /><span><span className="block font-bold">@{u.username} {u.age_group === "teen" && <span className="rounded bg-night-3 px-1.5 text-[10px] uppercase">under 18</span>}</span><span className="block text-xs text-chalk-dim">{u.role} · {u.status} · joined {timeAgo(u.created_at)}</span></span></span>
          <UserActions userId={u.id} status={u.status} role={u.role} isAdmin={profile.role === "admin"} self={u.id === profile.id} />
        </li>))}</ul>
    </div>
  );
}
