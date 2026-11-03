import { motion, type MotionValue } from "framer-motion";
import { TILE, type Dir, type Point } from "@/lib/maze/layout";

const LOOK: Record<Dir, { x: number; y: number }> = { n: { x: 0, y: -2.6 }, e: { x: 2.8, y: 0 }, s: { x: 0, y: 2.6 }, w: { x: -2.8, y: 0 } };

/**
 * The player: a glowing eye-orb. It rides on its own motion values so it glides between tiles,
 * and the pupil looks the way you are heading.
 */
export function PlayerMarker({ px, py, color, look, moving, bump, tile }: { px: MotionValue<number>; py: MotionValue<number>; color: string; look: Dir; moving: boolean; bump: number; tile: Point }) {
  const p = LOOK[look];
  return (
    <motion.div aria-hidden data-testid="player" data-tx={tile.x} data-ty={tile.y} className="pointer-events-none absolute left-0 top-0 z-30" style={{ x: px, y: py, width: TILE, height: TILE }}>
      <span className="fw-ground absolute left-1/2 top-[66%] h-3 w-9 -translate-x-1/2 rounded-full bg-black/45 blur-[3px]" />
      <span className="fw-ping absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ border: `2px solid ${color}` }} />
      <motion.div key={bump} className="absolute left-1/2 top-1/2" initial={bump ? { x: look === "e" ? 6 : look === "w" ? -6 : 0, y: look === "s" ? 6 : look === "n" ? -6 : 0 } : false} animate={{ x: 0, y: 0 }} transition={{ type: "spring", stiffness: 600, damping: 12 }} style={{ marginLeft: -19, marginTop: -21 }}>
        <div className={moving ? "fw-bob-fast" : "fw-bob"}>
          <svg viewBox="0 0 38 38" width="38" height="38" style={{ filter: `drop-shadow(0 0 7px ${color}aa)` }}>
            <circle cx="19" cy="19" r="17" fill="#f3f2fb" />
            <circle cx="19" cy="19" r="17" fill="none" stroke={color} strokeWidth="3" />
            <path d="M5 19C10 10 28 10 33 19 28 28 10 28 5 19Z" fill="#14112a" />
            <circle cx={19 + p.x} cy={19 + p.y} r="6" fill={color} style={{ transition: "cx .14s, cy .14s" }} />
            <circle cx={19 + p.x} cy={19 + p.y} r="2.6" fill="#14112a" style={{ transition: "cx .14s, cy .14s" }} />
            <circle cx={17.5 + p.x} cy={17 + p.y} r="1.1" fill="#fff" />
          </svg>
        </div>
      </motion.div>
    </motion.div>
  );
}
