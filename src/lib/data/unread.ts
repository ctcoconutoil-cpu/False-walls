import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Unread notifications plus pending questions: the number on the Inbox tab and in the Wall's header. */
export async function unreadCount(userId: string) {
  const supabase = await createClient();
  const [n, q, m] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("recipient_id", userId).eq("status", "pending"),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("owner_id", userId).is("read_at", null),
  ]);
  return (n.count ?? 0) + (q.count ?? 0) + (m.count ?? 0);
}
