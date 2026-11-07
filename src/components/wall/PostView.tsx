import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data/session";
import { getPostById, getThread } from "@/lib/data/posts";
import { Avatar, Empty, Notice, SampleTag } from "@/components/ui";
import { ShareButton } from "@/components/share/ShareSheet";
import { WallItem } from "@/components/maze/WallItem";
import { RevealPanel } from "@/components/wall/RevealPanel";
import { ChainStrip } from "@/components/wall/ChainStrip";
import { AnswerActions, AskBox, DiscoveryPing, OwnerTools, PostToolbar, ReactionBar, ReplyActions, ReplyBox } from "@/components/wall/Interactions";
import { CurtainOpen } from "@/components/maze/Curtain";
import { POST_TYPES } from "@/lib/constants";
import { isUuid, timeAgo } from "@/lib/utils";
import type { Revealed } from "@/lib/actions/posts";


type Reply = { id: string; answer_id: string | null; parent_reply_id: string | null; body: string; created_at: string; author_id: string; author: { username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null } | null };

/** Everything about one post: the concealed content, reactions and the conversation. Shown as its own page, and inside the Wall as a sheet. */
export async function PostView({ id, modal = false }: { id: string; modal?: boolean }) {
  if (!isUuid(id)) notFound();
  const [post, viewer] = await Promise.all([getPostById(id), getViewer()]);
  if (!post) notFound();
  const me = viewer.profile;
  const loggedIn = !!me;
  const owner = !!me && post.author_id === me.id;
  const supabase = await createClient();
  const thread = await getThread(id, me?.id ?? null);

  // Concealed content: owners see it directly, others who already opened it get it re-loaded.
  const concealed = post.type === "false_wall" || post.type === "hidden_thought";
  let ownerData: Revealed | null = null;
  let alreadyOpen = false;
  if (concealed && me) {
    if (owner) {
      const [{ data: sec }, { data: hm }] = await Promise.all([
        supabase.from("post_secrets").select("hidden_text,payload").eq("post_id", id).maybeSingle(),
        supabase.from("post_media").select("id,storage_path,width,height,alt_text").eq("post_id", id).eq("is_hidden", true),
      ]);
      const paths = (hm ?? []).map((m) => m.storage_path as string);
      const signed = paths.length ? (await supabase.storage.from("post-media").createSignedUrls(paths, 3600)).data : [];
      ownerData = {
        hidden_text: (sec?.hidden_text as string | null) ?? null, payload: (sec?.payload as Revealed["payload"]) ?? {},
        media: (hm ?? []).map((m) => ({ ...m, url: signed?.find((s) => s.path === m.storage_path)?.signedUrl ?? undefined })) as Revealed["media"],
      };
    } else {
      const { data } = await supabase.from("post_reveals").select("post_id").eq("post_id", id).eq("user_id", me.id).maybeSingle();
      alreadyOpen = !!data;
    }
  }

  let pendingQuestions = 0;
  if (owner) {
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("post_id", id).eq("status", "pending");
    pendingQuestions = count ?? 0;
  }

  const askReason = post.is_sample ? "This is sample content, so it can't receive questions." : post.author_id === null ? "Questions are off for this wall." : undefined;
  const canAsk = !post.is_sample && !!post.author_id && !owner && post.status === "active";
  const replies = thread.replies as unknown as Reply[];
  const topLevel = replies.filter((r) => !r.parent_reply_id && !r.answer_id);
  const childrenOf = (rid: string) => replies.filter((r) => r.parent_reply_id === rid);
  const repliesOfAnswer = (aid: string) => replies.filter((r) => r.answer_id === aid);

  const parentPost = thread.parentLink ? thread.related.find((p) => p.id === thread.parentLink!.parent_post_id) ?? null : null;
  const childNodes = thread.childLinks.map((l) => ({ post: thread.related.find((p) => p.id === l.child_post_id)!, viaAnswer: !!l.via_answer_id })).filter((c) => c.post);
  const chainId = thread.parentLink?.chain_id ?? thread.childLinks[0]?.chain_id ?? null;

  return (
    <div className={modal ? "bg-night" : "min-h-dvh bg-night"}>
      {!modal && <CurtainOpen />}
      {!owner && me && <DiscoveryPing kind="wall_explored" id={post.id} />}
      <header className="wall wall-brick relative overflow-hidden px-4 pb-6 pt-4" style={{ ["--wall" as string]: "#B4503A", ["--mortar" as string]: "#7C3425" }}>
        <div className="relative z-10 mx-auto max-w-2xl">
          {!modal && <Link href="/wall" className="inline-flex min-h-11 items-center rounded-xl bg-black/45 px-3 text-sm font-bold">‹ Back to the Wall</Link>}
          <p className="display mt-4 text-4xl uppercase leading-none drop-shadow-[0_3px_0_rgba(0,0,0,.45)] sm:text-5xl">Behind the wall</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <section aria-labelledby="post-h" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-chalk-dim">
            {post.author ? (
              <Link href={`/profile/${post.author.username}`} className="flex items-center gap-2 font-bold text-chalk"><Avatar user={post.author} size={32} />{post.author.display_name || post.author.username}</Link>
            ) : <span className="font-bold text-chalk">Demonstration content</span>}
            {post.is_sample && <SampleTag />}
            <span>· {POST_TYPES[post.type].label} · {timeAgo(post.created_at)}</span>
            {post.visibility === "link" && <span className="rounded-md bg-mustard px-1.5 py-0.5 text-[11px] font-bold uppercase text-[#2c1e02]">Private link wall</span>}
            {post.visibility === "followers" && <span className="rounded-md bg-night-3 px-1.5 py-0.5 text-[11px] font-bold uppercase">Followers only</span>}
            {post.status !== "active" && <span className="rounded-md bg-danger/20 px-1.5 py-0.5 text-[11px] font-bold uppercase text-[#ffb4b4]">{post.status === "hidden" ? "Hidden pending review" : "Removed"}</span>}
          </div>
          {post.prompt_text && <p className="text-sm text-chalk-dim">Prompt: <span className="text-chalk">{post.prompt_text}</span></p>}
          <h1 id="post-h" className="sr-only">{POST_TYPES[post.type].label}</h1>

          {concealed ? (
            <>
              {post.body && <p className="display text-2xl">{post.body}</p>}
              <RevealPanel post={post} loggedIn={loggedIn} initiallyOpen={alreadyOpen} ownerData={ownerData} />
            </>
          ) : (
            <div className="space-y-4">
              {post.type === "picture" ? (
                <div className="space-y-3">
                  <p className="display text-2xl">{post.title}</p>
                  {post.media.length ? post.media.map((m) => m.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.storage_path} src={m.url} alt={m.alt_text ?? post.title ?? "Picture"} width={m.width ?? undefined} height={m.height ?? undefined} loading="lazy" decoding="async" className="w-full rounded-2xl bg-night-2 object-contain" />
                  )) : <div className="mx-auto h-48 w-48"><WallItem post={post} compact /></div>}
                  {post.body && <p className="whitespace-pre-wrap">{post.body}</p>}
                </div>
              ) : post.type === "ask_me" ? (
                <div className="space-y-2"><div className="mx-auto h-44 w-44"><WallItem post={post} compact /></div><p className="display text-2xl">{post.title}</p>{post.body && <p className="whitespace-pre-wrap text-chalk">{post.body}</p>}</div>
              ) : (
                <blockquote className="display rounded-2xl p-5 text-2xl" style={{ background: "#1d1a3a" }}>“{post.body}”</blockquote>
              )}
            </div>
          )}

          <ReactionBar type="post" id={post.id} counts={thread.reactions.post.counts} mine={thread.reactions.post.mine} loggedIn={loggedIn} own={owner} />
          {owner && post.visibility === "link" && post.share_token && (
            <div className="space-y-3 rounded-2xl border-2 border-mustard bg-night-2 p-4">
              <p className="display text-xl">Your private wall is live</p>
              <p className="text-sm text-chalk-dim">It isn't listed anywhere. Only people with your link can open it. Share it, and the questions land in your inbox.</p>
              <ShareButton label="Share my wall" path={`/w/${post.share_token}`} imagePath={`/w/${post.share_token}/card`} title="Share your wall" text={`${post.title ?? "Send me a message"} — send me an anonymous message`} />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PostToolbar postId={post.id} saved={thread.saved} loggedIn={loggedIn} isPublic={post.visibility === "public" && !post.is_sample} owner={owner} />
            {canAsk && <AskBox postId={post.id} loggedIn={loggedIn} allowAnonymous={post.allow_anonymous_questions} canAsk />}
            {!canAsk && !owner && <AskBox postId={post.id} loggedIn={loggedIn} allowAnonymous={false} canAsk={false} reason={askReason} />}
          </div>
          {owner && (
            <div className="space-y-3 rounded-2xl bg-night-2 p-3">
              <p className="text-sm font-bold">Your wall</p>
              {pendingQuestions > 0 && <Link href="/inbox" className="block rounded-xl bg-coral px-3 py-2 text-sm font-bold text-[#2a0d08]">{pendingQuestions} question{pendingQuestions === 1 ? "" : "s"} waiting in your inbox</Link>}
              <OwnerTools post={{ id: post.id, type: post.type, title: post.title, body: post.body, clue: post.clue }} hiddenText={ownerData?.hidden_text ?? null} media={post.media} />
            </div>
          )}
        </section>

        {thread.answers.length > 0 && (
          <section aria-labelledby="answers" className="space-y-4">
            <h2 id="answers" className="text-2xl">Answers</h2>
            {thread.answers.map((a) => {
              const asker = a.asker as { username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null } | null;
              const r = thread.reactions.answers[a.id];
              return (
                <article key={a.id} className="space-y-2">
                  <div className="ml-0 mr-10 rounded-2xl rounded-bl-sm bg-night-3 p-3.5">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-chalk-dim">{asker ? <>Asked by <Link className="underline" href={`/profile/${asker.username}`}>{asker.display_name || asker.username}</Link></> : "Asked anonymously"}</p>
                    <p>{a.question_text}</p>
                  </div>
                  <div className="ml-10 mr-0 space-y-3 rounded-2xl rounded-br-sm bg-mustard p-3.5 text-[#2c1e02]">
                    <p className="whitespace-pre-wrap font-semibold">{a.body}</p>
                  </div>
                  <div className="ml-4 space-y-2">
                    <ReactionBar type="answer" id={a.id} counts={r?.counts ?? {}} mine={r?.mine ?? null} loggedIn={loggedIn} own={owner} />
                    <div className="flex flex-wrap items-center gap-3">
                      <AnswerActions answerId={a.id} own={owner} isPublic />
                      {loggedIn && post.allow_chains && <Link href={`/create?chain_parent=${post.id}&chain_answer=${a.id}`} className="min-h-9 text-sm font-bold text-mustard underline">Build a related wall from this answer</Link>}
                    </div>
                    {repliesOfAnswer(a.id).map((x) => <ReplyBubble key={x.id} reply={x} postId={post.id} meId={me?.id ?? null} loggedIn={loggedIn} reactions={thread.reactions.replies[x.id]} />)}
                    {post.allow_replies && <details className="text-sm"><summary className="min-h-9 cursor-pointer font-bold text-chalk-dim">Reply to this answer</summary><div className="mt-2"><ReplyBox postId={post.id} answerId={a.id} loggedIn={loggedIn} /></div></details>}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <ChainStrip current={post} parent={parentPost} kids={childNodes} chainId={chainId} answerLinked={!!thread.parentLink?.via_answer_id} />
        {loggedIn && post.allow_chains && post.status === "active" && (
          <Link href={`/create?chain_parent=${post.id}`} className="btn-press block rounded-xl bg-violet px-4 py-3 text-center font-black text-white shadow-[0_5px_0_#4a2a9c] [--btn-shadow:#4a2a9c]">Create a related wall</Link>
        )}

        <section aria-labelledby="voices" className="space-y-4">
          <h2 id="voices" className="text-2xl">The conversation</h2>
          {!post.allow_replies ? <Notice>The creator turned replies off for this wall.</Notice> : (
            <>
              <ReplyBox postId={post.id} loggedIn={loggedIn} placeholder={concealed ? "Say something about what you found" : "Add to the conversation"} />
              {topLevel.length === 0 && <Empty title="Nobody has spoken yet">Start the conversation. Be the first voice behind this wall.</Empty>}
            </>
          )}
          <ol className="relative space-y-4 border-l-4 border-night-3 pl-4">
            {topLevel.slice().reverse().map((x) => (
              <li key={x.id} className="space-y-2">
                <ReplyBubble reply={x} postId={post.id} meId={me?.id ?? null} loggedIn={loggedIn} reactions={thread.reactions.replies[x.id]} />
                {childrenOf(x.id).map((c) => <div key={c.id} className="ml-6"><ReplyBubble reply={c} postId={post.id} meId={me?.id ?? null} loggedIn={loggedIn} reactions={thread.reactions.replies[c.id]} /></div>)}
                {post.allow_replies && loggedIn && <details className="ml-6 text-sm"><summary className="min-h-9 cursor-pointer text-chalk-dim">Answer this</summary><div className="mt-2"><ReplyBox postId={post.id} parentId={x.id} loggedIn placeholder="Reply to this voice" /></div></details>}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

function ReplyBubble({ reply, postId, meId, loggedIn, reactions }: { reply: Reply; postId: string; meId: string | null; loggedIn: boolean; reactions?: { counts: Partial<Record<import("@/lib/types").ReactionKind, number>>; mine: import("@/lib/types").ReactionKind | null } }) {
  const own = meId === reply.author_id;
  return (
    <div className="relative rounded-2xl bg-night-2 p-3">
      <span aria-hidden className="absolute -left-[26px] top-3 h-3 w-3 rounded-full bg-mustard ring-4 ring-night" />
      <div className="mb-1 flex items-center gap-2 text-sm">
        {reply.author ? <Link href={`/profile/${reply.author.username}`} className="flex items-center gap-2 font-bold"><Avatar user={reply.author} size={24} />{reply.author.display_name || reply.author.username}</Link> : <span className="font-bold">Someone</span>}
        <span className="text-chalk-dim">{timeAgo(reply.created_at)}</span>
      </div>
      <p className="whitespace-pre-wrap">{reply.body}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ReactionBar type="reply" id={reply.id} counts={reactions?.counts ?? {}} mine={reactions?.mine ?? null} loggedIn={loggedIn} own={own} />
        <ReplyActions postId={postId} replyId={reply.id} own={own} loggedIn={loggedIn} />
      </div>
    </div>
  );
}
