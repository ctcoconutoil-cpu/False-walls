import Link from "next/link";
import { WallFeed } from "@/components/discover/WallFeed";
import { ExperienceCard } from "@/components/discover/ExperienceCard";
import { GistComposer, GistList } from "@/components/discover/GistFeed";
import { People } from "@/components/discover/People";
import { Empty } from "@/components/ui";
import { EXPERIENCE_CATEGORIES, POST_TYPES } from "@/lib/constants";
import { getExperiences, getGistFeed, getSuggestions, followsAnyone } from "@/lib/data/discover";
import { getDiscoverFeed, type DiscoverFilter } from "@/lib/data/posts";
import { getViewer } from "@/lib/data/session";
import { cx } from "@/lib/utils";

export const metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

const TYPE_FILTERS = [["", "All"], ["false_wall", "False Walls"], ["picture", "Pictures"]] as const;
const TABS = [["walls", "Walls"], ["experiences", "Experiences"], ["gist", "Gist"]] as const;

type SP = { tab?: string; filter?: string; type?: string; page?: string; cat?: string; feed?: string };

export default async function Discover({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = sp.tab === "experiences" || sp.tab === "gist" ? sp.tab : "walls";
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-[calc(var(--dock)+1.5rem)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Discover</h1>
        <Link href="/search" aria-label="Search" className="grid h-10 w-10 place-items-center rounded-xl bg-night-3 text-lg">⌕</Link>
      </div>
      <div role="tablist" aria-label="Section" className="grid grid-cols-3 gap-1 rounded-2xl bg-night-2 p-1">
        {TABS.map(([v, l]) => (
          <Link key={v} role="tab" aria-selected={tab === v} href={`/discover?tab=${v}`} className={cx("min-h-11 rounded-xl py-2.5 text-center font-extrabold", tab === v ? "bg-mustard text-[#2c1e02]" : "text-chalk-dim")}>{l}</Link>
        ))}
      </div>
      {tab === "walls" ? <Walls sp={sp} /> : tab === "experiences" ? <Experiences sp={sp} /> : <GistTab sp={sp} />}
    </main>
  );
}

async function Walls({ sp }: { sp: SP }) {
  const filter: DiscoverFilter = sp.filter === "trending" ? "trending" : "new";
  const type = sp.type && sp.type in POST_TYPES && TYPE_FILTERS.some(([v]) => v === sp.type) ? sp.type : null;
  const { posts, hasMore } = await getDiscoverFeed(filter, type, 0);
  const href = (f: string, t: string | null) => `/discover?tab=walls&filter=${f}${t ? `&type=${t}` : ""}`;
  return (
    <>
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
        <WallFeed key={`${filter}-${type}`} initial={posts} hasMore={hasMore} filter={filter} type={type} />
      )}
    </>
  );
}

async function Experiences({ sp }: { sp: SP }) {
  const cat = sp.cat && sp.cat in EXPERIENCE_CATEGORIES ? sp.cat : null;
  const [items, { user }] = await Promise.all([getExperiences(cat), getViewer()]);
  const href = (c: string) => `/discover?tab=experiences${c ? `&cat=${c}` : ""}`;
  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-[22px] bg-[#1f1632] px-4 py-3">
        <h2 className="display text-2xl leading-tight">Discover experiences</h2>
        <Link href="/create/experience" className="btn-press shrink-0 rounded-full bg-[#F9A719] px-4 py-2 text-sm font-extrabold text-[#2c1e02]">+ Add</Link>
      </div>
      <nav aria-label="Category" className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4">
        {([["", "All"], ...Object.entries(EXPERIENCE_CATEGORIES)] as [string, string][]).map(([v, l]) => (
          <Link key={v} href={href(v)} aria-current={(cat ?? "") === v ? "true" : undefined} className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold", (cat ?? "") === v ? "bg-mustard text-[#2c1e02]" : "bg-night-3")}>{l}</Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <Empty title="No experiences yet" action={<Link href="/create/experience" className="font-bold text-mustard underline">Add the first one</Link>}>Add something people can do or go to, with a picture and a link.</Empty>
      ) : (
        <ul className="grid grid-cols-2 items-stretch gap-3 rounded-[28px] bg-[#1f1632] p-3">{items.map((e, i) => <li key={e.id}><ExperienceCard e={e} mine={e.author_id === user?.id} i={i} /></li>)}</ul>
      )}
    </>
  );
}

async function GistTab({ sp }: { sp: SP }) {
  const { user } = await getViewer();
  if (!user) return <Empty title="Log in to see gist" action={<Link href="/login?next=/discover%3Ftab%3Dgist" className="font-bold text-mustard underline">Log in</Link>}>Gist is what the people you follow are saying.</Empty>;
  const follows = await followsAnyone(user.id);
  const feed = sp.feed === "foryou" ? "foryou" : "following";
  // "For you" stays empty until you follow someone. Anyone can post; their own gist shows under Following.
  const [gists, people] = await Promise.all([getGistFeed(feed), getSuggestions()]);
  const tabHref = (f: string) => `/discover?tab=gist&feed=${f}`;
  return (
    <>
      <div role="tablist" aria-label="Gist feed" className="grid grid-cols-2 border-b border-night-3">
        {([["following", "Following"], ["foryou", "For you"]] as const).map(([v, l]) => (
          <Link key={v} role="tab" aria-selected={feed === v} href={tabHref(v)} className={cx("min-h-11 border-b-2 py-2.5 text-center text-lg font-bold", feed === v ? "border-chalk text-chalk" : "border-transparent text-chalk-dim")}>{l}</Link>
        ))}
      </div>
      <GistComposer />
      {gists.length > 0 ? <GistList gists={gists} /> : (
        <Empty title={follows ? "Nothing to see here yet" : "Follow people to see their gist"}>
          {!follows ? "You'll see what they share here. Start with a few below." : feed === "following" ? "The people you follow haven't shared any gist. Check back soon." : "We're gathering fresh gist for you. Check back soon."}
        </Empty>
      )}
      <People people={people} />
    </>
  );
}
