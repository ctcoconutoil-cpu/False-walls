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
    [<Swatch key="b" bg="#17171b" />, "Black tile", "Blocks can't stand on it. Only a bridge, which spans over it, can claim it. Unclaimed black tiles also act as walls when you enclose an area."],
    [<Swatch key="h2" bg="#F6F6F4"><Dots n={2} /></Swatch>, "Height tile (dots)", `A column of cubes exactly as tall as the dots has to stand on it to claim it: two dots need a 2-high column, three dots a 3-high column. The wrong height leaves it unclaimed. Capturing a height tile earns a bonus (${R.heightBonusPoints[1]} / ${R.heightBonusPoints[2]} / ${R.heightBonusPoints[3]} points for one / two / three dots), claiming it does not.`],
    [<Swatch key="s" bg={PLAYER_COLORS.orange.hex} ring />, "Starting area and diamond", "Each colour starts in a corner with three tiles and a white diamond. These are the four starting territories; they are not special tiles."],
    [<Swatch key="c" bg={PLAYER_COLORS.turquoise.hex}>≈≈≈</Swatch>, "Claimed tile (patterned)", `Worth ${R.claimedPoints} points. Shows your colour and your pattern (waves, dots, crosses, zigzags…). Patterns are only a look, not a tile type. Other players can still take it.`],
    [<Swatch key="k" bg={PLAYER_COLORS.yellow.hex} />, "Captured tile (solid)", `Worth ${R.capturedPoints} points. A solid colour. Ordinary blocks can't take it; only an opponent's bridge can.`],
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
          <li>You get <b className="text-chalk">{R.blocksPerTurn} blocks</b> and place all of them, <b className="text-chalk">one after another</b>.</li>
          <li>Pick up a block, turn it, move it over the board and press <b className="text-chalk">Place block</b>. Green fits, red doesn&apos;t. Do the same for the second and third.</li>
          <li>The tiles under your blocks are outlined in your colour. No score is shown yet.</li>
          <li>Once all {R.blocksPerTurn} are down, the game checks the whole arrangement and shows what the move would score. You can still undo blocks.</li>
          <li>Press <b className="text-chalk">Confirm move</b>. Your score updates, but the blocks stay standing so everyone can see what you built.</li>
          <li>Press <b className="text-chalk">Remove blocks</b>. The blocks shrink away and your colour fills the tiles you claimed or captured. The computer does this step by itself.</li>
        </ol></section>

      <section className="space-y-2"><H id="rules">Where blocks can go</H>
        <ul className="list-disc space-y-1.5 pl-5 text-chalk-dim">
          <li>The three blocks form <b className="text-chalk">one connected arrangement</b>, touching along <b className="text-chalk">flat sides</b>. A corner touch doesn&apos;t count.</li>
          <li>At least one block must be <b className="text-chalk">on or next to</b> tiles you already hold. (You can start from that block and build outwards.)</li>
          <li>Every block stays fully on the board.</li>
          <li>Every block must <b className="text-chalk">stand on its own</b>. It never rests on another block and must not tip over.</li>
          <li><b className="text-chalk">Black tiles</b> and tiles <b className="text-chalk">captured by another player</b> can&apos;t be stood on. A <b className="text-chalk">bridge</b> (a block with a span held up at both ends) can reach over them and claim them.</li>
          <li>Height tiles need a column of cubes of the matching height.</li>
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
        <p className="text-chalk-dim">Capturing a height tile adds a bonus: {R.heightBonusPoints[1]} for one dot, {R.heightBonusPoints[2]} for two, {R.heightBonusPoints[3]} for three. Claiming it earns no bonus. A tile only counts for the player who currently holds it, so a claimed tile can change hands until it is captured. Optional timer: finish a turn before time runs out for +{R.timerBonusPoints} points.</p></section>

      <section className="space-y-2"><H id="end">How the game ends</H>
        <p className="text-chalk-dim">A tracker fills as the board is claimed. When it fills, everyone plays one final round, and the player with the most points wins.</p></section>

      <section className="space-y-2"><H id="controls">Controls</H>
        <ul className="list-disc space-y-1.5 pl-5 text-chalk-dim">
          <li><b className="text-chalk">Turn the board:</b> drag with one finger or the mouse.</li>
          <li><b className="text-chalk">Zoom:</b> pinch, scroll, or use ＋ and －.</li>
          <li><b className="text-chalk">Views:</b> Angled for depth, Top view for planning, Reset to start over.</li>
          <li><b className="text-chalk">Inspect:</b> tap any tile to see what it does.</li>
          <li><b className="text-chalk">Pick up a block:</b> tap one in the tray below the board. It lifts above the board and a coloured preview shows where it will land. Green fits, red doesn&apos;t.</li>
          <li><b className="text-chalk">Move it:</b> drag the lifted block, or tap a tile. It snaps to whole tiles. Arrow keys also move it.</li>
          <li><b className="text-chalk">Turn it:</b> Left and Right spin it flat, Tip and Roll stand it on its side, Flip mirrors it. On a keyboard: R, T, F. Enter places it and Esc puts it back.</li>
          <li><b className="text-chalk">Undo:</b> take back placed blocks until you confirm the move.</li>
        </ul></section>

      <section className="space-y-2 rounded-2xl bg-night-2 p-4"><H id="open">Rules we&apos;re still confirming</H>
        <p className="text-sm text-chalk-dim">These rules come from the published STRATA help pages. A few details aren&apos;t published, so they are set in one settings file and can be corrected without touching the game:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-chalk-dim">
          <li>The exact cube positions of the six blocks (read from the reference picture) and how each turn&apos;s three blocks are dealt.</li>
          <li>What the diamond does beyond marking your start, and whether a claimed height tile keeps its bonus if an opponent later takes it (here the bonus follows the owner).</li>
          <li>How big the tracker is, which decides when the game ends.</li>
          <li>The original game is two-player, with teams for bigger groups. Here, 3 to 6 players each get a colour of their own.</li>
        </ul></section>

      <Link href="/games/strata/board" className="btn-press flex min-h-14 items-center justify-center rounded-2xl bg-coral px-5 font-black text-[#2a0d08]">Explore the board</Link>
    </main>
  );
}
