import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data/session";
import { getPostsByIds } from "@/lib/data/posts";
import { DiscoveryPing } from "@/components/wall/Interactions";
import { POST_TYPES, WALL_COLORS } from "@/lib/constants";
import { isUuid, timeAgo } from "@/lib/utils";
import type { Post } from "@/lib/types";

export const metadata = { title: "Wall Chain" };
type Link_ = { parent_post_id: string; child_post_id: string; via_answer_id: string | null };

export default async function ChainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const viewer = await getViewer();
  const { data: chain } = await supabase.from("wall_chains").select("id, root_post_id").eq("id", id).maybeSingle();
  if (!chain) notFound();
  const { data: links } = await supabase.from("wall_chain_links").select("parent_post_id, child_post_id, via_answer_id").eq("chain_id", id);
  const ls = (links ?? []) as Link_[];
  const ids = [chain.root_post_id as string, ...ls.map((l) => l.child_post_id)];
  const posts = await getPostsByIds(ids);
  const byId = new Map(posts.map((p) => [p.id, p]));
  const kids = (pid: string) => ls.filter((l) => l.parent_post_id === pid);

  function Node({ post, via, depth }: { post: Post; via?: boolean; depth: number }) {
    const c = WALL_COLORS[post.wall_color] ?? WALL_COLORS.coral;
    const children = kids(post.id).filter((l) => byId.has(l.child_post_id));
    return (
      <li className={depth ? "relative pl-6" : ""}>
        {depth > 0 && <span aria-hidden className="absolute left-0 top-0 h-7 w-5 rounded-bl-xl border-b-4 border-l-4 border-mustard/70" />}
        {via && <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-mustard">Built from an answer</p>}
        <Link href={`/post/${post.id}`} className="flex items-center gap-3 rounded-xl p-3" style={{ background: depth === 0 ? c.base : "#1d1a3a", color: depth === 0 ? c.ink : undefined, boxShadow: depth === 0 ? `0 4px 0 ${c.dark}` : `inset 0 0 0 2px ${c.base}55` }}>
          <span aria-hidden className="display grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/20 text-lg">{POST_TYPES[post.type].icon}</span>
          <span className="min-w-0"><span className="block text-[11px] font-bold uppercase tracking-wide opacity-75">{depth === 0 ? "Where it started" : POST_TYPES[post.type].label} · {timeAgo(post.created_at)}</span><span className="block font-semibold">{post.title ?? post.clue ?? post.body}</span></span>
        </Link>
        {children.length > 0 && <ol className="ml-4 mt-3 space-y-3 border-l-4 border-mustard/70 pb-1">{children.map((l) => <Node key={l.child_post_id} post={byId.get(l.child_post_id)!} via={!!l.via_answer_id} depth={depth + 1} />)}</ol>}
      </li>
    );
  }

  const root = byId.get(chain.root_post_id as string);
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
      {viewer.profile && <DiscoveryPing kind="chain_explored" id={id} />}
      <h1 className="text-3xl">Wall chain</h1>
      <p className="text-chalk-dim">One conversation that kept growing. Walls you can't see because of their privacy settings are left out.</p>
      {root ? <ol className="space-y-3"><Node post={root} depth={0} /></ol> : <p className="rounded-xl bg-night-2 p-4 text-chalk-dim">The wall where this chain started isn't available to you.</p>}
    </main>
  );
}
