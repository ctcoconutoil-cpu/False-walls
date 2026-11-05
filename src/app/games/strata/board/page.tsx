import Link from "next/link";
import { BoardViewer } from "@/components/games/strata/BoardViewer";

export const metadata = { title: "STRATA board" };

export default function Board() {
  return (
    <main className="mx-auto max-w-2xl space-y-3 px-4 pb-8 pt-4">
      <div className="flex items-baseline justify-between"><h1 className="display text-2xl font-black tracking-[0.14em]">STRATA</h1><Link href="/games/strata/how-to-play" className="text-sm underline">How to play</Link></div>
      <BoardViewer />
    </main>
  );
}
