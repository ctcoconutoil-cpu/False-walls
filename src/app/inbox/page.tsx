import Link from "next/link";
import { requireMember } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui";
import { MarkRead } from "@/components/inbox/QuestionCard";
import { cx, timeAgo } from "@/lib/utils";

export const metadata = { title: "Inbox" };
type Notif = { id: string; kind: string; data: Record<string, unknown>; read_at: string | null; created_at: string; post_id: string | null; actor: { username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null } | null };

function describe(n: Notif): { text: string; href: string } {
  const who = n.actor ? n.actor.display_name || n.actor.username : "Someone";
  const post = n.post_id ? `/post/${n.post_id}` : "/inbox";
  switch (n.kind) {
    case "question": return { text: n.data.anonymous ? "You have a new anonymous question." : `${who} sent you a question.`, href: "/inbox" };
    case "answer": return { text: `${who} answered your question.`, href: "/inbox?tab=sent" };
    case "reply": return { text: `${who} replied in a conversation you're part of.`, href: post };
    case "reaction": return { text: `${who} reacted to your wall.`, href: post };
    case "follow": return { text: `${who} followed you.`, href: n.actor ? `/profile/${n.actor.username}` : "/inbox" };
    case "chain": return { text: `${who} built a related wall from yours.`, href: post };
    case "badge": return { text: `You earned a badge: ${String(n.data.name ?? "")}.`, href: "/profile/me" };
    default: return { text: "Something new on the walls.", href: post };
  }
}

type Person = { username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null };
type Activity = {
  convos: { id: string; body: string; created_at: string; post_id: string; post_title: string | null; author: Person }[];
  gist: { id: string; body: string; created_at: string; gist_id: string; gist_body: string; author: Person }[];
};

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section aria-labelledby={title.replace(/\W/g, "")} className="mt-7">
      <h2 id={title.replace(/\W/g, "")} className="text-xl">{title}</h2>
      {children.length === 0 ? <p className="mt-2 rounded-2xl bg-night-2 p-4 text-sm text-chalk-dim">{empty}</p> : <ul className="mt-3 space-y-2">{children}</ul>}
    </section>
  );
}

export default async function Inbox() {
  const { user } = await requireMember("/inbox");
  const supabase = await createClient();
  const [act, notes] = await Promise.all([
    supabase.rpc("inbox_activity"),
    supabase.from("notifications").select("id, kind, data, read_at, created_at, post_id, actor:profiles!notifications_actor_id_fkey(username,display_name,avatar_style,avatar_color,avatar_url)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const a = (act.data ?? { convos: [], gist: [] }) as Activity;
  const rows = (notes.data ?? []) as unknown as Notif[];
  const unread = rows.filter((n) => !n.read_at).length;
  const who = (p: Person) => p.display_name || p.username;
  const card = "flex items-start gap-3 rounded-2xl bg-night-2 p-3";

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-3xl">Inbox</h1>
      <Section title="Wall conversations" empty="When someone replies on one of your Discover walls, it shows up here.">
        {a.convos.map((c) => (
          <li key={c.id}><Link href={`/post/${c.post_id}`} className={card}>
            <Avatar user={c.author} size={36} />
            <span className="min-w-0 flex-1"><span className="block text-xs text-chalk-dim">{who(c.author)} on “{c.post_title ?? "your wall"}” · {timeAgo(c.created_at)}</span><span className="line-clamp-3 block">{c.body}</span></span>
          </Link></li>
        ))}
      </Section>
      <Section title="Walls Gist comments" empty="Comments on your Walls Gist posts show up here.">
        {a.gist.map((c) => (
          <li key={c.id}><Link href={`/gist/${c.gist_id}`} className={card}>
            <Avatar user={c.author} size={36} />
            <span className="min-w-0 flex-1"><span className="block text-xs text-chalk-dim">{who(c.author)} on “{c.gist_body.slice(0, 40)}{c.gist_body.length > 40 ? "…" : ""}” · {timeAgo(c.created_at)}</span><span className="line-clamp-3 block">{c.body}</span></span>
          </Link></li>
        ))}
      </Section>
      {rows.length > 0 && (
        <Section title="Activity" empty="">
          {rows.map((n) => { const d = describe(n); return (
            <li key={n.id}><Link href={d.href} className={cx("flex items-center gap-3 rounded-2xl p-3", n.read_at ? "bg-night-2" : "bg-night-3 ring-2 ring-mustard/60")}>
              {n.actor ? <Avatar user={n.actor} size={36} /> : <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-night text-lg">★</span>}
              <span className="min-w-0 flex-1"><span className="block">{d.text}</span><span className="block text-xs text-chalk-dim">{timeAgo(n.created_at)}</span></span>
            </Link></li>); })}
        </Section>
      )}
      {unread > 0 && <MarkRead />}
    </main>
  );
}
