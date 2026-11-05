import Link from "next/link";

export const metadata = { title: "STRATA" };
const later: Array<[string, string]> = [["Play with friends", "Private rooms and invite codes"], ["Play online", "Matchmaking with public players"], ["Play the computer", "Four difficulty levels, works offline"], ["Daily challenge", "One shared puzzle a day"]];

export default function Strata() {
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 pb-8 pt-6">
      <div>
        <Link href="/games" className="text-sm text-chalk-dim underline">Games</Link>
        <h1 className="display mt-1 text-4xl font-black tracking-[0.18em]">STRATA</h1>
        <p className="mt-2 text-chalk-dim">Place blocks to claim territory, then surround it to capture it. Chess-style planning with Tetris-style fitting, on a board you can turn in 3D.</p>
      </div>
      <div className="grid gap-3">
        <Link href="/games/strata/how-to-play" className="btn-press flex min-h-14 items-center justify-between rounded-2xl bg-coral px-5 font-black text-[#2a0d08]">How to play<span aria-hidden>›</span></Link>
        <Link href="/games/strata/board" className="btn-press flex min-h-14 items-center justify-between rounded-2xl bg-night-3 px-5 font-black">Explore the board<span aria-hidden>›</span></Link>
      </div>
      <section aria-labelledby="soon" className="rounded-2xl bg-night-2 p-4">
        <h2 id="soon" className="font-black">Being built</h2>
        <p className="mt-1 text-sm text-chalk-dim">You can explore the board now. Placing blocks and the game modes below are the next phases, and nothing here pretends to work before it does.</p>
        <ul className="mt-3 space-y-2 text-sm">
          {later.map(([t, d]) => <li key={t} className="flex items-start justify-between gap-3 rounded-xl bg-night/60 px-3 py-2"><span><b>{t}</b><span className="block text-chalk-dim">{d}</span></span><span className="shrink-0 rounded-full bg-night-3 px-2 py-0.5 text-[11px] text-chalk-dim">Soon</span></li>)}
        </ul>
      </section>
    </main>
  );
}
