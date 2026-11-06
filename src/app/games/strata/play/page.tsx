import { GameView } from "@/components/games/strata/GameView";

export const metadata = { title: "Play STRATA" };

export default function Play() {
  return (
    <main className="mx-auto max-w-2xl space-y-3 px-4 pb-8 pt-4">
      <GameView />
    </main>
  );
}
