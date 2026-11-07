import Link from "next/link";
import { requireMember } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Empty } from "@/components/ui";
import { MarkRead, QuestionCard, type QuestionRow } from "@/components/inbox/QuestionCard";
import { AnswerActions } from "@/components/wall/Interactions";
import { cx, timeAgo } from "@/lib/utils";

export const metadata = { title: "Inbox" };
const QSEL = "id, body, is_anonymous, created_at, status, post:posts(id,title,clue,body,type), asker:profiles!questions_asker_id_fkey(username,display_name,avatar_style,avatar_color,avatar_url)";
const TABS = [["questions", "Questions"], ["answered", "Answered"], ["sent", "Sent"], ["activity", "Activity"]] as const;

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

export default async function Inbox({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string }> }) {
  const { user, profile } = await requireMember("/inbox");
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? (sp.tab as (typeof TABS)[number][0]) : "questions";
  const filter = sp.filter === "anonymous" || sp.filter === "identified" ? sp.filter : "all";
  const supabase = await createClient();

  const [pendingC, unreadC] = await Promise.all([
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).eq("status", "pending"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
  ]);

  let content: React.ReactNode = null;
  if (tab === "questions") {
    let q = supabase.from("questions").select(QSEL).eq("recipient_id", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(100);
    if (filter === "anonymous") q = q.eq("is_anonymous", true);
    if (filter === "identified") q = q.eq("is_anonymous", false);
    const rows = ((await q).data ?? []) as unknown as QuestionRow[];
    content = (
      <>
        <div role="group" aria-label="Filter questions" className="mb-4 flex gap-2">
          {(["all", "anonymous", "identified"] as const).map((f) => <Link key={f} href={`/inbox?tab=questions&filter=${f}`} aria-current={filter === f} className={cx("rounded-full px-3.5 py-2 text-sm font-bold capitalize", filter === f ? "bg-chalk text-night" : "bg-night-3")}>{f}</Link>)}
        </div>
        {rows.length === 0 ? <Empty title="No pending questions" action={<Link href="/create/ask-me" className="font-bold text-mustard underline">Create an Ask Me wall</Link>}>When someone asks you something, it lands here. You decide what to answer.</Empty>
          : <div className="space-y-3">{rows.map((r) => <QuestionCard key={r.id} q={r} />)}</div>}

      </>
    );
  } else if (tab === "answered") {
    const { data } = await supabase.from("answers").select("id, question_text, body, is_public, created_at, post_id").eq("author_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(100);
    const rows = data ?? [];
    content = rows.length === 0 ? <Empty title="Nothing answered yet">Answers you write show up here, where you can make them public or private any time.</Empty> : (
      <div className="space-y-3">{rows.map((a) => (
        <article key={a.id} className="space-y-2 rounded-2xl bg-night-2 p-4">
          <p className="text-sm text-chalk-dim">{a.question_text}</p><p className="font-semibold">{a.body}</p>
          <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase text-chalk-dim">{a.is_public ? "Public" : "Private"} · {timeAgo(a.created_at)}</span><AnswerActions answerId={a.id} own isPublic={a.is_public} /></div>
          <Link href={`/post/${a.post_id}`} className="text-xs text-mustard underline">View the wall</Link>
        </article>))}</div>
    );
  } else if (tab === "sent") {
    const { data: sent } = await supabase.from("questions").select(QSEL).neq("recipient_id", user.id).order("created_at", { ascending: false }).limit(100);
    const rows = (sent ?? []) as unknown as QuestionRow[];
    const ids = rows.map((r) => r.id);
    const { data: answers } = ids.length ? await supabase.from("answers").select("id, question_id, body, is_public, post_id").in("question_id", ids) : { data: [] };
    const byQ = new Map((answers ?? []).map((a) => [a.question_id as string, a]));
    content = rows.length === 0 ? <Empty title="You haven't asked anything yet">Open a wall and use Ask a question. Answers come back here.</Empty> : (
      <div className="space-y-3">{rows.map((r) => {
        const a = byQ.get(r.id);
        return (
          <article key={r.id} className="space-y-2 rounded-2xl bg-night-2 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-chalk-dim">{r.is_anonymous ? "Sent anonymously" : "Sent with your profile"} · {timeAgo(r.created_at)}</p>
            <p className="font-semibold">{r.body}</p>
            {a ? <div className="rounded-xl bg-mustard p-3 text-[#2c1e02]"><p className="font-semibold">{a.body}</p><p className="mt-1 text-xs opacity-75">{a.is_public ? "Shown on the wall" : "Only you can see this answer"}</p></div>
              : <p className="text-xs text-chalk-dim">{r.status === "pending" ? "Waiting for an answer. The creator may not answer every question." : "Not answered."}</p>}
          </article>);
      })}</div>
    );
  } else {
    const { data } = await supabase.from("notifications").select("id, kind, data, read_at, created_at, post_id, actor:profiles!notifications_actor_id_fkey(username,display_name,avatar_style,avatar_color,avatar_url)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60);
    const rows = (data ?? []) as unknown as Notif[];
    content = rows.length === 0 ? <Empty title="All quiet">Reactions, replies, follows and badges appear here. You can choose which ones in settings.</Empty> : (
      <>
        {(unreadC.count ?? 0) > 0 && <MarkRead />}
        <ul className="space-y-2">{rows.map((n) => { const d = describe(n); return (
          <li key={n.id}><Link href={d.href} className={cx("flex items-center gap-3 rounded-2xl p-3", n.read_at ? "bg-night-2" : "bg-night-3 ring-2 ring-mustard/60")}>
            {n.actor ? <Avatar user={n.actor} size={36} /> : <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-night text-lg">{n.kind === "badge" ? "★" :  "?"}</span>}
            <span className="min-w-0 flex-1"><span className="block">{d.text}</span><span className="block text-xs text-chalk-dim">{timeAgo(n.created_at)}</span></span>
            {!n.read_at && <span className="sr-only">Unread</span>}
          </Link></li>); })}</ul>
      </>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-3xl">Inbox</h1>
      <nav aria-label="Inbox sections" className="scrollbar-none mt-4 flex gap-2 overflow-x-auto">
        {TABS.map(([t, label]) => {
          const n = t === "questions" ? pendingC.count ?? 0 : t === "activity" ? unreadC.count ?? 0 : 0;
          return <Link key={t} href={`/inbox?tab=${t}`} aria-current={tab === t ? "page" : undefined} className={cx("display flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 font-black", tab === t ? "bg-mustard text-[#2c1e02]" : "bg-night-3")}>{label}{n > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-xs text-[#2a0d08]">{n}</span>}</Link>;
        })}
      </nav>
      <div className="mt-5">{content}</div>
    </main>
  );
}
