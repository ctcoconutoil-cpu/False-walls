import { memo } from "react";
import { AREAS } from "@/lib/constants";
import { FACE, SIZE, TILE, hash, rng, zoneOf, type MazeSection } from "@/lib/maze/layout";
import type { AreaSlug } from "@/lib/types";

type Kind = "brick" | "slab" | "tile";
const kindFor = (a: AreaSlug): Kind => (a === "picture" ? "tile" : a === "hidden" || a === "trending" ? "slab" : "brick");
const SHADES = [0.07, -0.06, 0.03, -0.08, 0.05, -0.03, 0.08, -0.05, 0, 0.04, -0.04, 0.06];

/** One continuous texture for every wall tile, so neighbouring tiles read as a single connected structure. */
function WallPattern({ id, kind, wall, mortar }: { id: string; kind: Kind; wall: string; mortar: string }) {
  const bits: React.ReactNode[] = [];
  let n = 0;
  const block = (x: number, y: number, w: number, h: number) => {
    const s = SHADES[n++ % SHADES.length];
    bits.push(
      <g key={`${x}-${y}`}>
        <rect x={x + 1} y={y + 1} width={w - 1} height={h - 1} rx={1.5} fill={wall} />
        <rect x={x + 1} y={y + 1} width={w - 1} height={h - 1} rx={1.5} fill={s > 0 ? "#fff" : "#000"} opacity={Math.abs(s)} />
        <rect x={x + 1} y={y + 1} width={w - 1} height={1.6} fill="#fff" opacity={0.16} />
        <rect x={x + 1} y={y + h - 2} width={w - 1} height={1.4} fill="#000" opacity={0.2} />
      </g>,
    );
  };
  let W = 72, H = 48;
  if (kind === "brick") {
    for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) block(c * 36 + (r % 2 ? 18 : 0), r * 12, 36, 12);
  } else if (kind === "slab") {
    W = 72; H = 72;
    block(0, 0, 72, 36);
    block(-36, 36, 72, 36); block(36, 36, 72, 36);
  } else {
    W = 36; H = 36;
    block(0, 0, 36, 36);
  }
  return (
    <pattern id={id} width={W} height={H} patternUnits="userSpaceOnUse">
      <rect width={W} height={H} fill={mortar} />
      {bits}
    </pattern>
  );
}

export const MazeWorld = memo(function MazeWorld({ m, area }: { m: MazeSection; area: AreaSlug }) {
  const A = AREAS[area];
  const W = SIZE * TILE;
  const wallId = `wall-${area}`;
  const isWall = (x: number, y: number) => x < 0 || y < 0 || x >= SIZE || y >= SIZE || m.walls[y][x];
  const rand = rng(hash(`decor:${m.seed}`));

  const faces: React.ReactNode[] = [];
  const shadows: React.ReactNode[] = [];
  const tops: React.ReactNode[] = [];
  const rims: React.ReactNode[] = [];
  for (let y = 0; y < SIZE; y++) {
    let runStart = -1;
    for (let x = 0; x <= SIZE; x++) {
      const w = x < SIZE && m.walls[y][x];
      if (w) {
        if (runStart < 0) runStart = x;
        const southOpen = !isWall(x, y + 1);
        if (y === SIZE - 1 || southOpen) {
          faces.push(<rect key={`f${x},${y}`} x={x * TILE} y={(y + 1) * TILE} width={TILE} height={FACE} />);
          if (southOpen) shadows.push(<rect key={`s${x},${y}`} x={x * TILE} y={(y + 1) * TILE + FACE} width={TILE} height={22} />);
        }
        if (!isWall(x, y - 1)) rims.push(<rect key={`n${x},${y}`} x={x * TILE} y={y * TILE} width={TILE} height={2.5} fill="#fff" opacity={0.28} />);
        if (!isWall(x - 1, y)) rims.push(<rect key={`w${x},${y}`} x={x * TILE} y={y * TILE} width={3} height={TILE} fill="#000" opacity={0.22} />);
        if (!isWall(x + 1, y)) rims.push(<rect key={`e${x},${y}`} x={(x + 1) * TILE - 3} y={y * TILE} width={3} height={TILE} fill="#000" opacity={0.3} />);
        if (southOpen) rims.push(<rect key={`b${x},${y}`} x={x * TILE} y={(y + 1) * TILE - 3} width={TILE} height={3} fill="#000" opacity={0.35} />);
      } else if (runStart >= 0) {
        tops.push(<rect key={`t${runStart},${y}`} x={runStart * TILE} y={y * TILE} width={(x - runStart) * TILE} height={TILE} />);
        runStart = -1;
      }
    }
  }

  // Quiet floor decoration: stains, scratches and a few soft pools of light. Nothing that competes with the walls.
  const floors: { x: number; y: number }[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!m.walls[y][x]) floors.push({ x, y });
  const decor: React.ReactNode[] = [];
  for (let i = 0; i < 16 && floors.length; i++) {
    const f = floors[Math.floor(rand() * floors.length)];
    const cx = f.x * TILE + 10 + rand() * (TILE - 20), cy = f.y * TILE + 10 + rand() * (TILE - 20);
    if (i % 3 === 0) decor.push(<ellipse key={`d${i}`} cx={cx} cy={cy} rx={8 + rand() * 12} ry={4 + rand() * 6} fill="#000" opacity={0.16} />);
    else if (i % 3 === 1) decor.push(<path key={`d${i}`} d={`M${cx} ${cy} l${6 + rand() * 10} ${rand() * 6 - 3} l${rand() * 8 - 4} ${5 + rand() * 6}`} stroke="#fff" strokeWidth={1.2} opacity={0.07} fill="none" strokeLinecap="round" />);
    else decor.push(<circle key={`d${i}`} cx={cx} cy={cy} r={1.6 + rand() * 1.6} fill="#fff" opacity={0.08} />);
  }
  const lamps: { x: number; y: number }[] = m.rooms.map((r) => ({ x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE }));
  for (let i = 0; i < 2 && floors.length; i++) { const f = floors[Math.floor(rand() * floors.length)]; lamps.push({ x: (f.x + 0.5) * TILE, y: (f.y + 0.5) * TILE }); }

  const zoneTint = [0, 0.035, 0.06, 0.02];

  return (
    <svg aria-hidden width={W} height={W + FACE} viewBox={`0 0 ${W} ${W + FACE}`} className="pointer-events-none absolute left-0 top-0 block">
      <defs>
        <WallPattern id={wallId} kind={kindFor(area)} wall={A.wall} mortar={A.mortar} />
        <pattern id="floor-tiles" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <rect width={TILE} height={TILE} fill="none" />
          <path d={`M0 0H${TILE}M0 0V${TILE}`} stroke="#fff" strokeOpacity={0.045} strokeWidth={1.5} />
          <circle cx={TILE / 2} cy={TILE / 2} r={1.3} fill="#fff" opacity={0.08} />
        </pattern>
        <pattern id="plaza" width={TILE / 2} height={TILE / 2} patternUnits="userSpaceOnUse">
          <rect width={TILE / 4} height={TILE / 4} fill="#fff" opacity={0.035} />
          <rect x={TILE / 4} y={TILE / 4} width={TILE / 4} height={TILE / 4} fill="#fff" opacity={0.035} />
        </pattern>
        <linearGradient id="contact" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0.5" /><stop offset="1" stopColor="#000" stopOpacity="0" /></linearGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.14" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <radialGradient id="lamp"><stop offset="0" stopColor={A.accent} stopOpacity="0.2" /><stop offset="1" stopColor={A.accent} stopOpacity="0" /></radialGradient>
      </defs>

      {/* floor */}
      <rect width={W} height={W + FACE} fill={A.floor} />
      {[0, 1, 2, 3].map((z) => (
        <rect key={z} x={(z % 2) * (W / 2)} y={Math.floor(z / 2) * (W / 2)} width={W / 2} height={W / 2} fill={A.accent} opacity={zoneTint[z]} />
      ))}
      <rect width={W} height={W} fill="url(#floor-tiles)" />
      {m.rooms.map((r, i) => <rect key={`r${i}`} x={r.x * TILE} y={r.y * TILE} width={r.w * TILE} height={r.h * TILE} fill="url(#plaza)" />)}
      {lamps.map((l, i) => <circle key={`l${i}`} cx={l.x} cy={l.y} r={TILE * 1.9} fill="url(#lamp)" />)}
      {decor}

      {/* depth: contact shadows, south faces, then the wall tops as one connected mass */}
      <g fill="url(#contact)">{shadows}</g>
      <g fill={`url(#${wallId})`}>{faces}</g>
      <g fill="#07031a" opacity={0.42}>{faces}</g>
      <g fill={`url(#${wallId})`}>{tops}</g>
      <g fill="url(#sheen)">{tops}</g>
      {rims}
    </svg>
  );
});
