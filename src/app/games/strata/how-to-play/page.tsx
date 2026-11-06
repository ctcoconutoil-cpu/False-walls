import Link from "next/link";
import { STRATA_RULES as R } from "@/games/strata/config/rules";
import { PLAYER_COLORS } from "@/games/strata/config/palette";

export const metadata = { title: "How to play STRATA" };

const Swatch = ({ bg, children, ring }: { bg: string; children?: React.ReactNode; ring?: boolean }) => (
  <span aria-hidden className="relative grid h-12 w-12 shrink-0 place-items-center rounded-md border border-black/15 text-[10px] font-black leading-none" style={{ background: bg, color: "#17171b", outline: ring ? "2px solid #fff" : undefined, outlineOffset: -7 }}>{children}</span>
);
const Dots = ({ n }: { n: number }) => <span className="flex flex-col gap-[3px]">{Array.from({ length: n }, (_, i) => <i key={i} className="block h-[5px] w-[5px] rounded-full bg-[#1c1c20]" />)}</span>;

const H = ({ children, id }: { children: React.ReactNode; id: string }) => <h2 id={id} className="display scroll-mt-16 text-xl font-black">{children}</h2>;

export default function HowToPlay() {
  const legend: Array<[React.ReactNode, string, string]> = [
    [<Swatch key="n" bg="#F6F6F4" />, "Open tile", "Any block can claim it."],
    [<Swatch key="b" bg="#17171b" />, "Black tile", "An obstacle. Blocks can't stand on it or touch it. You can use black tiles as walls when you capture an area."],
    [<Swatch key="h2" bg="#F6F6F4"><Dots n={2} /></Swatch>, "Height tile (dots)", "Only a block with that many cubes stacked high can claim it. Two dots need a 2-high block, three dots need a 3-high block. A block of the wrong height leaves it unclaimed."],
    [<Swatch key="s" bg={PLAYER_COLORS.orange.hex} ring />, "Starting area and diamond", "Each colour starts in a corner. The diamond marks the heart of your starting area."],
    [<Swatch key="c" bg={PLAYER_COLORS.turquoise.hex}>≈≈≈</Swatch>, "Claimed tile (patterned)", `Worth ${R.claimedPoints} points. Other players can still claim it. Each colour has its own pattern, so you never have to rely on colour alone.`],
    [<Swatch key="k" bg={PLAYER_COLORS.yellow.hex} />, "Captured tile (solid)", `Worth ${R.capturedPoints} points. Locked in: opponents can't take it back.`],
  ];
  return (
    <main className="mx-auto max-w-xl space-y-7 px-4 pb-10 pt-5">
      <div>
        <Link href="/games/strata" className="text-sm text-chalk-dim underline">STRATA</Link>
        <h1 className="display mt-1 text-3xl font-black">How to play</h1>
        <p className="mt-2 text-chalk-dim">Claim ground with 3D blocks, then close it in so nobody can take it. Whoever scores the most wins.</p>
      </div>

      <nav aria-label="On this page" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
        {[["goal", "Goal"], ["turn", "A turn"], ["rules", "Placing blocks"], ["tiles", "Tiles"], ["score", "Scoring"], ["end", "Ending"], ["controls", "Controls"], ["open", "Still confirming"]].map(([id, l]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-full bg-night-3 px-3.5 py-2 text-sm font-bold">{l}</a>)}
      </nav>

      <section className="space-y-2"><H id="goal">The goal</H>
        <p className="text-chalk-dim">Each player owns a colour and a starting corner. On your turn you place blocks onto the board to <b className="text-chalk">claim</b> tiles. When a tile is completely surrounded by your own tiles, black tiles or the edge of the board, it becomes <b className="text-chalk">captured</b> and is worth double. When the board fills up, the highest score wins.</p></section>

      <section className="space-y-2"><H id="turn">What happens on your turn</H>
        <ol className="list-decimal space-y-1.5 pl-5 text-chalk-dim">
          <li>You get <b className="text-chalk">{R.blocksPerTurn} blocks</b>. You must place all of them.</li>
          <li>Pick up a block, turn it, and move it over the board. Valid tiles light up. Invalid ones don&apos;t.</li>
          <li>Place all {R.blocksPerTurn}, then confirm. You can undo until you confirm.</li>
          <li>The board scores your move, claims and captures tiles, and passes the turn on.</li>
        </ol></section>

      <section className="space-y-2"><H id="rules">Where blocks can go</H>
        <ul className="list-disc space-y-1.5 pl-5 text-chalk-dim">
          <li>At least one block must be <b className="text-chalk">on or next to</b> tiles you already claimed or captured.</li>
          <li>Blocks must touch along <b className="text-chalk">flat sides</b>. Touching only at a corner doesn&apos;t count.</li>
          <li>Every block must stay fully on the board. No overhang.</li>
          <li>Blocks may <b className="text-chalk">not touch black tiles</b> or an opponent&apos;s captured tiles.</li>
          <li>Every block must <b className="text-chalk">stand on its own</b>. It can rest on the board or on other blocks, never in mid-air.</li>
          <li>Height tiles need a block of the matching height (see below).</li>
        </ul></section>

      <section className="space-y-3"><H id="tiles">Reading the board</H>
        <ul className="space-y-2">
          {legend.map(([sw, t, d]) => <li key={t} className="flex items-center gap-3 rounded-2xl bg-night-2 p-3">{sw}<span className="text-sm"><b>{t}</b><span className="block text-chalk-dim">{d}</span></span></li>)}
        </ul>
</section>

      <section className="space-y-2"><H id="score">Scoring</H>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-night-2 p-3"><div className="display text-3xl font-black">{R.claimedPoints}</div><div className="text-sm text-chalk-dim">points per claimed tile</div></div>
          <div className="rounded-2xl bg-night-2 p-3"><div className="display text-3xl font-black">{R.capturedPoints}</div><div className="text-sm text-chalk-dim">points per captured tile</div></div>
        </div>
        <p className="text-chalk-dim">Height tiles also give a bonus when you capture them. A tile only counts for the player who currently holds it, so a claimed tile can change hands until it is captured. Optional timer: finish a turn before time runs out for +{R.timerBonusPoints} points.</p></section>

      <section className="space-y-2"><H id="end">How the game ends</H>
        <p className="text-chalk-dim">A tracker fills as the board is claimed. When it fills, everyone plays one final round, and the player with the most points wins.</p></section>

      <section className="space-y-2"><H id="controls">Controls</H>
        <ul className="list-disc space-y-1.5 pl-5 text-chalk-dim">
          <li><b className="text-chalk">Turn the board:</b> drag with one finger or the mouse.</li>
          <li><b className="text-chalk">Zoom:</b> pinch, scroll, or use ＋ and －.</li>
          <li><b className="text-chalk">Views:</b> Angled for depth, Top view for planning, Reset to start over.</li>
          <li><b className="text-chalk">Inspect:</b> tap any tile to see what it does.</li>
          <li><b className="text-chalk">Pick up a block:</b> tap one in the tray below the board. It lifts above the board and a coloured preview shows where it will land. Green fits, red doesn&apos;t.</li>
          <li><b className="text-chalk">Move it:</b> drag the lifted block, or tap a tile. It snaps to whole tiles and rests on the board or on blocks below it.</li>
          <li><b className="text-chalk">Turn it:</b> Left and Right spin it flat, Tip and Roll stand it on its side, Flip mirrors it. On a keyboard: R, T, F. Enter confirms and Esc puts it back.</li>
          <li><b className="text-chalk">Undo:</b> take back placements until the game is submitted.</li>
        </ul></section>

      <section className="space-y-2 rounded-2xl bg-night-2 p-4"><H id="open">Rules we&apos;re still confirming</H>
        <p className="text-sm text-chalk-dim">These rules come from the published STRATA help pages. A few details aren&apos;t published, so they are set in one settings file and can be corrected without touching the game:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-chalk-dim">
          <li>The exact shapes of the six blocks and how each turn&apos;s three blocks are dealt.</li>
          <li>The bonus size for height tiles, and what the diamond does beyond marking your start.</li>
          <li>How big the tracker is, which decides when the game ends.</li>
          <li>The original game is two-player, with teams for bigger groups. Here, 3 to 6 players each get a colour of their own.</li>
        </ul></section>

      <Link href="/games/strata/board" className="btn-press flex min-h-14 items-center justify-center rounded-2xl bg-coral px-5 font-black text-[#2a0d08]">Explore the board</Link>
    </main>
  );
}
