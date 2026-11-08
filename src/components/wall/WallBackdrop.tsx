import { memo } from "react";
import { BAYH, DW, hash01 } from "@/lib/wall/layout";
import { WALL_THEMES, type WallTheme } from "@/lib/wall/themes";

type Leaf = { x: number; y: number; r: number; s: number; c: number };

/** Leaves scattered around a point: a bush, or the foot of a hanging vine. */
function cluster(seed: string, cx: number, cy: number, rx: number, ry: number, n: number, spread = 360): Leaf[] {
  return Array.from({ length: n }, (_, i) => {
    const a = hash01(seed, i * 3 + 1) * Math.PI * 2, d = Math.sqrt(hash01(seed, i * 3 + 2));
    return { x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: hash01(seed, i * 3 + 3) * spread, s: 0.8 + hash01(seed, i * 7 + 5) * 0.9, c: Math.floor(hash01(seed, i * 5 + 9) * 5) };
  });
}
/** A vine hanging from (x0, y0): a swaying stem with a leaf or two at every step. */
function vine(seed: string, x0: number, y0: number, len: number, dir: 1 | -1): { stem: string; leaves: Leaf[] } {
  let x = x0, y = y0;
  const pts = [`M${x} ${y}`];
  const leaves: Leaf[] = [];
  for (let i = 0; y < y0 + len; i++) {
    const r = hash01(seed, i);
    x += dir * (Math.sin(i * 0.8 + r * 3) * 5 + 0.8); y += 11;
    pts.push(`L${x.toFixed(1)} ${y}`);
    for (const sg of [-1, 1]) if (hash01(seed, i * 2 + sg + 40) < 0.85) leaves.push({ x: x + sg * 3, y: y + r * 5, r: sg * (35 + r * 60) + 90, s: 0.75 + r * 0.7, c: Math.floor(hash01(seed, i + sg * 9) * 5) });
  }
  return { stem: pts.join(" "), leaves };
}
const LeafPath = ({ l, t }: { l: Leaf; t: WallTheme }) => t.blossoms && l.c === 4 ? <Blossom l={l} t={t} /> : (
  <g transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.r.toFixed(0)}) scale(${l.s.toFixed(2)})`}>
    <path d="M0 0C5-6 14-6 19 0C14 6 5 6 0 0z" fill={t.greens[l.c]} />
    <path d="M1 0H17" stroke="#0f3612" strokeWidth=".6" opacity=".5" fill="none" />
  </g>
);

const Blossom = ({ l, t }: { l: Leaf; t: WallTheme }) => {
  const b = t.blossoms!, c = b[Math.abs(Math.round(l.x + l.y)) % b.length];
  return (
    <g transform={`translate(${l.x.toFixed(1)} ${l.y.toFixed(1)}) rotate(${l.r.toFixed(0)}) scale(${(l.s * 0.8).toFixed(2)})`}>
      {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-6" rx="3.6" ry="6" fill={c} transform={`rotate(${a})`} />)}
      <circle r="2.6" fill="#ffd24a" />
    </g>
  );
};
const Star = ({ x, y, s, c }: { x: number; y: number; s: number; c: string }) => (
  <path d="M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2z" fill={c} opacity=".85" transform={`translate(${x} ${y}) scale(${s})`} />
);

const Lamp = ({ x, y, side, bulb }: { x: number; y: number; side: 1 | -1; bulb: string }) => (
  <g transform={`translate(${x} ${y}) scale(${side * 1.45} 1.45)`}>
    <rect x="-3" y="-4" width="6" height="22" rx="1.5" fill="#15110f" />
    <path d="M3 6H22C27 6 29 9 29 14" fill="none" stroke="#15110f" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M16 20a13 12 0 0 1 26 0z" fill="#1b1614" transform="translate(-3 0)" />
    <path d="M17 20a12 11 0 0 1 8-10" fill="none" stroke="#4a403a" strokeWidth="1.4" transform="translate(-3 0)" />
    <rect x="11" y="19.5" width="30" height="3" rx="1.5" fill="#0d0a09" transform="translate(-3 0)" />
    <ellipse cx="26" cy="24.5" rx="8" ry="4" fill={bulb} transform="translate(-3 0)" />
  </g>
);

const Crown = ({ c }: { c: string }) => (
  <g fill="none" stroke={c} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity=".88">
    <path d="M4 40 8 14 22 28 32 6 42 28 56 12 60 40z" /><path d="M8 48H58" />
  </g>
);
const GEye = ({ e }: { e: [string, string, string] }) => (
  <g opacity=".9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 26C16 6 48 6 62 26C48 44 16 44 4 26z" fill="none" stroke={e[0]} strokeWidth="4" />
    <circle cx="33" cy="26" r="11" fill={e[1]} /><circle cx="33" cy="26" r="5" fill={e[2]} /><circle cx="37" cy="22" r="2.4" fill="#fff" />
    <path d="M14 8 11 0M26 3 25-5M40 3 42-5M52 8 56 0" stroke={e[0]} strokeWidth="2.6" fill="none" />
    <path d="M26 44v14M38 44v9" stroke={e[0]} strokeWidth="3" fill="none" />
  </g>
);
const Scribble = ({ c }: { c: string }) => (
  <g fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".85">
    <path d="M4 30C20 8 36 52 52 24S66 8 70 14" /><path d="M60 6 72 14 60 22" />
  </g>
);

/** The wall itself for one bay: lamps and their glow, plants, graffiti. Posts hang over it. The bricks are the stage's own background. */
export const WallBackdrop = memo(function WallBackdrop({ bay, theme = 0 }: { bay: number; theme?: number }) {
  const t = WALL_THEMES[theme] ?? WALL_THEMES[0];
  const id = `g${bay}`;
  const odd = bay % 2 === 1;
  const edge = [
    ...cluster(`bl${bay}`, 4, 290 + hash01(`a${bay}`) * 60, 26, 60, 26),
    ...cluster(`br${bay}`, DW - 4, 540 + hash01(`b${bay}`) * 60, 26, 70, 28),
    ...cluster(`bl2${bay}`, 4, 700, 24, 40, 14),
  ];
  const corners = bay === 0 ? [
    ...cluster("c1", 14, 6, 52, 40, 46), ...cluster("c2", DW - 14, 4, 56, 42, 50),
  ] : [];
  const v1 = bay === 0 ? vine("v1", 10, 8, 250, 1) : null, v2 = bay === 0 ? vine("v2", DW - 10, 8, 300, -1) : null, v3 = bay === 0 ? vine("v3", 34, 6, 120, 1) : null;
  const l1 = { x: odd ? 340 : 54, y: 26 }, l2 = { x: odd ? 54 : 346, y: 96 };
  return (
    <svg aria-hidden className="wp-backdrop" style={{ top: bay * BAYH }} width={DW} height={BAYH} viewBox={`0 0 ${DW} ${BAYH}`}>
      <defs>
        <radialGradient id={id}><stop offset="0" stopColor={t.glow[0]} stopOpacity=".8" /><stop offset=".45" stopColor={t.glow[1]} stopOpacity=".38" /><stop offset="1" stopColor={t.glow[2]} stopOpacity="0" /></radialGradient>
        <linearGradient id={`s${bay}`} x1="0" x2="1"><stop offset="0" stopColor="#000" stopOpacity=".45" /><stop offset=".12" stopColor="#000" stopOpacity="0" /><stop offset=".88" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></linearGradient>
      </defs>
      <rect width={DW} height={BAYH} fill={`url(#s${bay})`} />
      <circle cx={l1.x + (odd ? -14 : 14)} cy={l1.y + 40} r="230" fill={`url(#${id})`} />
      <circle cx={l2.x + (odd ? 14 : -14)} cy={l2.y + 40} r="200" fill={`url(#${id})`} />
      {bay === 0 && <circle cx={DW / 2} cy="-10" r="200" fill={`url(#${id})`} />}
      <g transform={odd ? "translate(250 34)" : "translate(94 30) scale(.8)"}>{odd ? <Scribble c={t.scribble} /> : <Crown c={t.crown} />}</g>
      <g transform={odd ? "translate(74 36) scale(.9)" : "translate(284 40) scale(.9)"}><GEye e={t.eye} /></g>
      {t.stars && Array.from({ length: 22 }, (_, i) => <Star key={i} x={10 + hash01(`st${bay}`, i) * (DW - 20)} y={120 + hash01(`sy${bay}`, i) * (BAYH - 160)} s={0.5 + hash01(`ss${bay}`, i) * 0.9} c={t.glow[0]} />)}
      <Lamp x={l1.x} y={l1.y} side={odd ? -1 : 1} bulb={t.bulb} />
      <Lamp x={l2.x} y={l2.y} side={odd ? 1 : -1} bulb={t.bulb} />
      {[v1, v2, v3].map((v, i) => v && <g key={i}><path d={v.stem} fill="none" stroke={t.vine} strokeWidth="1.8" />{v.leaves.map((l, j) => <LeafPath key={j} l={l} t={t} />)}</g>)}
      {corners.map((l, i) => <LeafPath key={`c${i}`} l={l} t={t} />)}
      {edge.map((l, i) => <LeafPath key={`e${i}`} l={l} t={t} />)}
    </svg>
  );
});
