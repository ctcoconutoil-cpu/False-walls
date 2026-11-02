import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/data/session";
import { timeAgo } from "@/lib/utils";

export default async function Log() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("moderation_actions").select("id,action,target_type,target_id,note,created_at,moderator:profiles!moderation_actions_moderator_id_fkey(username)").order("created_at", { ascending: false }).limit(100);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Moderation log</h1>
      <ul className="space-y-2">{(data ?? []).map((a) => (
        <li key={a.id} className="rounded-xl bg-night-2 p-3 text-sm"><strong>{a.action.replaceAll("_", " ")}</strong> on {a.target_type} <code className="text-xs text-chalk-dim">{a.target_id.slice(0, 8)}</code> by @{(a.moderator as unknown as { username: string } | null)?.username ?? "unknown"} · {timeAgo(a.created_at)}{a.note ? <span className="block text-chalk-dim">{a.note}</span> : null}</li>))}
        {(data ?? []).length === 0 && <li className="text-chalk-dim">No actions yet.</li>}
      </ul>
    </div>
  );
}
