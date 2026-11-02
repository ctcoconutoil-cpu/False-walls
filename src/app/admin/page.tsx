import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/data/session";

export default async function Overview() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_stats");
  const s = (data ?? {}) as Record<string, number>;
  const rows: [string, string][] = [["users", "Registered users"], ["new_users_7d", "New users (7 days)"], ["suspended", "Suspended accounts"], ["posts", "Member walls (excludes samples)"], ["posts_7d", "Walls this week"], ["questions", "Questions sent"], ["answers", "Answers written"], ["chains", "Wall Chains"], ["open_reports", "Open reports"]];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Overview</h1>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">{rows.map(([k, l]) => <div key={k} className={`rounded-2xl p-4 ${k === "open_reports" && s[k] > 0 ? "bg-coral text-[#2a0d08]" : "bg-night-2"}`}><dd className="display text-4xl">{s[k] ?? 0}</dd><dt className="text-sm opacity-80">{l}</dt></div>)}</dl>
    </div>
  );
}
