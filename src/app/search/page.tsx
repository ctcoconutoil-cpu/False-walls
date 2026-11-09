import { PRIVATE_ONLY_IN } from "@/lib/constants";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { POST_SELECT, hydratePosts } from "@/lib/data/posts";
import { Avatar, Empty } from "@/components/ui";
import { WallItem } from "@/components/maze/WallItem";
import { POST_TYPES } from "@/lib/constants";
import type { Post, PostType } from "@/lib/types";
import { cx } from "@/lib/utils";

export const metadata = { title: "Search" };
const KINDS = [["all", "Everything"], ["people", "People"], ["questions", "Questions"], ["walls", "Walls"], ["pictures", "Pictures"], ["chains", "Wall Chains"], ["trending", "Trending"]] as const;
type Kind = (typeof KINDS)[number][0];

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string }> }) {
  const sp = await searchParams;
  const kind: Kind = KINDS.some(([k]) => k === sp.kind) ? (sp.kind as Kind) : "all";
  // Strip characters that have meaning in filters or LIKE patterns.
  const q = (sp.q ?? "").replace(/[^\p{L}\p{N}\s'’-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const ready = q.length >= 2;
  const supabase = await createClient();
  const pat = `%${q}%`;

  let people: { id: string; username: string; display_name: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null }[] = [];
  let posts: Post[] = [];
  let chains: { id: string; root: Post }[] = [];
  let answers: { id: string; post_id: string; question_text: string; body: string }[] = [];

  if (ready) {
    if (kind === "all" || kind === "people") people = ((await supabase.rpc("search_profiles", { p_q: q, p_limit: 20 })).data ?? []) as typeof people;
    if (["all", "questions", "walls", "pictures", "chains"].includes(kind)) {
      let qb = supabase.from("posts").select(POST_SELECT).eq("status", "active").neq("visibility", "wall").not("type", "in", PRIVATE_ONLY_IN).or(`title.ilike.${pat},body.ilike.${pat},clue.ilike.${pat}`).order("created_at", { ascending: false }).limit(30);
      if (kind === "questions") qb = qb.eq("type", "ask_me");
      if (kind === "pictures") qb = qb.eq("type", "picture");
      if (kind === "walls") qb = qb.in("type", ["false_wall", "hidden_thought", "prompt_response"] satisfies PostType[]);
      posts = await hydratePosts(supabase, ((await qb).data ?? []) as never);
    }
    if (kind === "questions" || kind === "all") {
      answers = ((await supabase.from("answers").select("id, post_id, question_text, body").eq("is_public", true).eq("status", "active").or(`question_text.ilike.${pat},body.ilike.${pat}`).limit(15)).data ?? []) as typeof answers;
    }
    if (kind === "chains" || kind === "all") {
      const { data } = await supabase.from("wall_chains").select("id, root_post_id");
      const rootIds = new Set((data ?? []).map((c) => c.root_post_id as string));
      const rootMatches = posts.filter((p) => rootIds.has(p.id));
      chains = rootMatches.map((r) => ({ id: (data ?? []).find((c) => c.root_post_id === r.id)!.id as string, root: r }));
      if (kind === "chains") posts = [];
    }
    if (kind === "trending") {
      const { data: ranked } = await supabase.rpc("trending_posts", { p_limit: 40, p_offset: 0, p_area: null, p_type: null });
      const ids = ((ranked ?? []) as { post_id: string }[]).map((r) => r.post_id);
      if (ids.length) {
        const { data } = await supabase.from("posts").select(POST_SELECT).in("id", ids).neq("visibility", "wall").not("type", "in", PRIVATE_ONLY_IN);
        const all = await hydratePosts(supabase, (data ?? []) as never);
        posts = all.filter((p) => `${p.title ?? ""} ${p.body ?? ""} ${p.clue ?? ""}`.toLowerCase().includes(q.toLowerCase()));
      }
    }
  }
  const nothing = ready && !people.length && !posts.length && !chains.length && !answers.length;
  const href = (k: string) => `/search?q=${encodeURIComponent(q)}&kind=${k}`;

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <h1 className="text-3xl">Search</h1>
      <form role="search" className="flex gap-2">
        <input type="hidden" name="kind" value={kind} />
        <label className="sr-only" htmlFor="q">Search people, walls and conversations</label>
        <input id="q" name="q" defaultValue={q} placeholder="People, questions, walls…" className="min-h-11 flex-1 rounded-xl border-2 border-night-3 bg-night px-3.5 text-chalk focus:border-mustard focus:outline-none" />
        <button className="btn-press display min-h-11 rounded-xl bg-mustard px-5 font-black text-[#2c1e02] shadow-[0_5px_0_#a87a14]">Search</button>
      </form>
      <nav aria-label="Filter results" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
        {KINDS.map(([k, l]) => <Link key={k} href={href(k)} aria-current={kind === k ? "true" : undefined} className={cx("shrink-0 rounded-full px-3.5 py-2 text-sm font-bold", kind === k ? "bg-chalk text-night" : "bg-night-3")}>{l}</Link>)}
      </nav>
      {!ready && <Empty title="Look for something">Search people, questions, walls, and chains. You only see what you're allowed to see, so private walls never turn up.</Empty>}
      {nothing && <Empty title="Nothing behind that wall">Try a shorter word, or a different filter.</Empty>}
      {people.length > 0 && <section aria-labelledby="s-people" className="space-y-2"><h2 id="s-people" className="text-xl">People</h2><ul className="space-y-2">{people.map((p) => <li key={p.id}><Link href={`/profile/${p.username}`} className="flex items-center gap-3 rounded-xl bg-night-2 p-3"><Avatar user={p} size={40} /><span><span className="block font-bold">{p.display_name || p.username}</span><span className="block text-sm text-chalk-dim">@{p.username}</span></span></Link></li>)}</ul></section>}
      {chains.length > 0 && <section aria-labelledby="s-chains" className="space-y-2"><h2 id="s-chains" className="text-xl">Wall Chains</h2><ul className="space-y-2">{chains.map((c) => <li key={c.id}><Link href={`/chain/${c.id}`} className="block rounded-xl bg-night-2 p-3"><span className="text-xs font-bold uppercase text-mustard">Chain</span><span className="block font-semibold">{c.root.title ?? c.root.clue ?? c.root.body}</span></Link></li>)}</ul></section>}
      {answers.length > 0 && <section aria-labelledby="s-ans" className="space-y-2"><h2 id="s-ans" className="text-xl">Public answers</h2><ul className="space-y-2">{answers.map((a) => <li key={a.id}><Link href={`/post/${a.post_id}`} className="block rounded-xl bg-night-2 p-3"><span className="block text-sm text-chalk-dim">{a.question_text}</span><span className="block font-semibold">{a.body}</span></Link></li>)}</ul></section>}
      {posts.length > 0 && kind !== "chains" && <section aria-labelledby="s-posts" className="space-y-2"><h2 id="s-posts" className="text-xl">{kind === "trending" ? "Trending now" : "Walls"}</h2><ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{posts.map((p) => <li key={p.id} className="h-40"><Link href={`/post/${p.id}`} className="block h-full" aria-label={`${POST_TYPES[p.type].label}: ${p.title ?? p.clue ?? p.body ?? ""}`}><WallItem post={p} compact /></Link></li>)}</ul></section>}
    </main>
  );
}
