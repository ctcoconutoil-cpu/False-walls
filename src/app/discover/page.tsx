import Link from "next/link";
import { FeedCard } from "@/components/discover/FeedCard";
import { Empty } from "@/components/ui";
import { POST_TYPES } from "@/lib/constants";
import { DISCOVER_PAGE, getDiscoverFeed, type DiscoverFilter } from "@/lib/data/posts";
import { cx } from "@/lib/utils";

export const metadata = { title: "Discover" };

const TYPE_FILTERS = [["", "All"], ["false_wall", "False Walls"], ["ask_me", "Ask Me"], ["hidden_thought", "Hidden Thoughts"], ["picture", "Pictures"], ["prompt_response", "Prompts"]] as const;

export default async function Discover({ searchParams }: { searchParams: Promise<{ filter?: string; type?: string; page?: string }> }) {
  const sp = await searchParams;
  const filter: DiscoverFilter = sp.filter === "trending" ? "trending" : "new";
  const type = sp.type && sp.type in POST_TYPES ? sp.type : null;
  const page = Math.min(Math.max(parseInt(sp.page ?? "0", 10) || 0, 0), 50);
  const { posts, hasMore } = await getDiscoverFeed(filter, type, page);
  const href = (f: string, t: string | null, p = 0) => `/discover?filter=${f}${t ? `&type=${t}` : ""}${p ? `&page=${p}` : ""}`;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-[calc(var(--dock)+1.5rem)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Discover</h1>
        <Link href="/search" aria-label="Search" className="grid h-10 w-10 place-items-center rounded-xl bg-night-3 text-lg">⌕</Link>
      </div>
      <div role="tablist" aria-label="Order" className="flex gap-2">
        {([["new", "New"], ["trending", "Trending"]] as const).map(([f, l]) => (
          <Link key={f} role="tab" aria-selected={filter === f} href={href(f, type)} className={cx("min-h-10 rounded-xl px-4 py-2 font-bold", filter === f ? "bg-chalk text-night" : "bg-night-3")}>{l}</Link>
        ))}
      </div>
      <nav aria-label="Type" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4">
        {TYPE_FILTERS.map(([v, l]) => (
          <Link key={v} href={href(filter, v || null)} aria-current={(type ?? "") === v ? "true" : undefined} className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold", (type ?? "") === v ? "bg-mustard text-[#2c1e02]" : "bg-night-3")}>{l}</Link>
        ))}
      </nav>
      {posts.length === 0 ? (
        <Empty title={filter === "trending" ? "Nothing is trending yet" : "Nothing here yet"} action={<Link href="/create" className="font-bold text-mustard underline">Put something on the wall</Link>}>
          {filter === "trending" ? "Walls rise here when several different people react and reply. Check New, or start a conversation." : "Be the first to put something here."}
        </Empty>
      ) : (
        <ul className="space-y-3">{posts.map((p) => <li key={p.id}><FeedCard post={p} /></li>)}</ul>
      )}
      {(page > 0 || hasMore) && (
        <div className="flex justify-between gap-2">
          {page > 0 ? <Link href={href(filter, type, page - 1)} className="min-h-11 rounded-xl bg-night-3 px-4 py-2.5 font-bold">‹ Previous</Link> : <span />}
          {hasMore && <Link href={href(filter, type, page + 1)} className="min-h-11 rounded-xl bg-night-3 px-4 py-2.5 font-bold">More ›</Link>}
        </div>
      )}
      <p className="text-center text-xs text-chalk-dim">Showing {DISCOVER_PAGE} per page. Everything here is also on the <Link href="/wall" className="underline">Wall</Link>.</p>
    </main>
  );
}
