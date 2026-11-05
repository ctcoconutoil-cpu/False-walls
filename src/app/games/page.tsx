import Link from "next/link";

export const metadata = { title: "Games" };

export default function Games() {
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 pb-8 pt-6">
      <h1 className="display text-3xl font-black">Games</h1>
      <p className="text-chalk-dim">Play something together. Games live beside the Wall and Adventure, and don&apos;t change them.</p>
      <Link href="/games/strata" className="btn-press block rounded-3xl bg-night-2 p-5 [--btn-shadow:#0d0820]">
        <span className="flex items-center gap-4">
          <span aria-hidden className="grid h-16 w-16 shrink-0 grid-cols-3 gap-[3px] rounded-2xl bg-white p-2">
            {["#fff", "#4CC3B5", "#fff", "#17171b", "#fff", "#17171b", "#E0552B", "#fff", "#E6C619"].map((c, i) => <i key={i} className="rounded-[2px] border border-black/10" style={{ background: c }} />)}
          </span>
          <span><b className="display block text-xl">STRATA</b><span className="text-sm text-chalk-dim">3D territory strategy for 2 to 6 players. Place blocks, claim ground, capture areas.</span></span>
        </span>
      </Link>
    </main>
  );
}
