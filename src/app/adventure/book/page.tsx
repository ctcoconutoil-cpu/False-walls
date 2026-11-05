import Link from "next/link";
import { Empty } from "@/components/ui";
import { ObjectArt } from "@/components/adventure/Bits";
import { requireMember } from "@/lib/data/session";
import { getBook } from "@/lib/data/adventure";

export const metadata = { title: "Collection book" };

export default async function Book() {
  await requireMember("/adventure/book");
  const shelves = await getBook();
  if (!shelves) return <main className="mx-auto max-w-xl px-4 py-10"><Empty title="The book couldn't load">Try again in a moment.</Empty></main>;
  const total = shelves.reduce((n, s) => n + s.found, 0);
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 pb-8 pt-4">
      <Link href="/adventure" className="text-sm text-chalk-dim underline">Adventure</Link>
      <header><h1 className="display text-3xl">My collection book</h1><p className="text-chalk-dim">{total} {total === 1 ? "object" : "objects"} discovered so far.</p></header>
      {total === 0 && <Empty title="Your book is empty" action={<Link href="/adventure" className="underline">Pick a collection</Link>}>Everything you find in the maze is added here automatically.</Empty>}
      {shelves.map((s) => (
        <section key={s.slug} aria-labelledby={`s-${s.slug}`} className="rounded-3xl bg-night-2 p-4" style={{ borderTop: `4px solid ${s.color}` }}>
          <div className="mb-3 flex items-center justify-between"><h2 id={`s-${s.slug}`} className="display text-lg uppercase">{s.emoji} {s.name}</h2><span className="text-sm text-chalk-dim">{s.found}/{s.total}</span></div>
          <ul className="grid grid-cols-3 gap-2.5">
            {s.items.map((i, n) => (
              <li key={`${i.name}-${n}`} className="flex flex-col items-center gap-1 rounded-xl bg-night p-2.5 text-center">
                <ObjectArt found={i.found} emoji={i.emoji} image_path={i.image_path} rare={i.rarity === "rare"} size={52} />
                <p className="text-xs font-bold leading-tight">{i.found ? i.name : "???"}</p>
                <p className="text-[10px] text-chalk-dim">{i.found && i.found_at ? `${new Date(i.found_at).toLocaleDateString()} · ${i.via_team ? "Team" : "Solo"}` : "Undiscovered"}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
