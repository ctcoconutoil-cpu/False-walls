import Link from "next/link";
import { POST_TYPES, WALL_COLORS } from "@/lib/constants";
import type { Post } from "@/lib/types";

function line(p: Post) { return p.title ?? p.clue ?? p.body ?? POST_TYPES[p.type].label; }

function Node({ post, current }: { post: Post; current?: boolean }) {
  const c = WALL_COLORS[post.wall_color] ?? WALL_COLORS.coral;
  const body = (
    <span className="flex items-center gap-3 rounded-xl p-3" style={{ background: current ? c.base : "#1d1a3a", color: current ? c.ink : undefined, boxShadow: current ? `0 4px 0 ${c.dark}` : `inset 0 0 0 2px ${c.base}55` }}>
      <span aria-hidden className="display grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/20">{POST_TYPES[post.type].icon}</span>
      <span className="min-w-0"><span className="block text-[11px] font-bold uppercase tracking-wide opacity-75">{current ? "You are here" : POST_TYPES[post.type].label}</span><span className="block truncate font-semibold">{line(post)}</span></span>
    </span>
  );
  return current ? body : <Link href={`/post/${post.id}`} className="block">{body}</Link>;
}
function Connector({ label }: { label?: string }) {
  return (
    <div aria-hidden className="flex items-center gap-3 pl-[18px]">
      <span className="h-7 w-1 rounded bg-mustard/70" />
      {label && <span className="text-[11px] font-bold uppercase tracking-wide text-mustard">{label}</span>}
    </div>
  );
}

/** Shows where a wall sits in a chain: what it grew from, and what grew from it. */
export function ChainStrip({ current, parent, kids, chainId, answerLinked }: { current: Post; parent: Post | null; kids: { post: Post; viaAnswer: boolean }[]; chainId: string | null; answerLinked: boolean }) {
  if (!parent && !kids.length) return null;
  return (
    <section aria-labelledby="chain" className="space-y-1 rounded-2xl bg-night-2 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="chain" className="text-xl">Wall chain</h2>
        {chainId && <Link href={`/chain/${chainId}`} className="text-sm font-bold text-mustard underline">See the whole chain</Link>}
      </div>
      {parent && <><Node post={parent} /><Connector label={answerLinked ? "Grew from an answer" : "Grew from"} /></>}
      <Node post={current} current />
      {kids.map(({ post, viaAnswer }) => (
        <div key={post.id}><Connector label={viaAnswer ? "Answered with" : "Leads to"} /><Node post={post} /></div>
      ))}
    </section>
  );
}
