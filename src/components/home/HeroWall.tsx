"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** The hero is the product's one idea: a wall with a crack in it. Tap it. */
export function HeroWall() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const dur = reduce ? 0 : 0.7;
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="relative h-48 overflow-hidden rounded-2xl bg-night shadow-[0_10px_0_rgba(0,0,0,.35)]" style={{ boxShadow: "inset 0 0 0 3px #f2573f66, 0 10px 0 rgba(0,0,0,.35)" }}>
        <div className="absolute inset-0 grid place-items-center bg-[#fff1c9] p-5 text-center text-[#2c1e02]">
          <p className="note text-lg leading-snug">Hello. You opened a false wall. People hide questions, photos, stories and polls behind these.</p>
        </div>
        <motion.div aria-hidden className="wall wall-brick absolute inset-y-0 left-0 w-1/2" style={{ ["--wall" as string]: "#b4503a", ["--mortar" as string]: "#7c3425" }} animate={{ x: open ? "-100%" : 0 }} transition={{ duration: dur, ease: [0.7, 0, 0.2, 1] }} />
        <motion.div aria-hidden className="wall wall-brick absolute inset-y-0 right-0 w-1/2" style={{ ["--wall" as string]: "#b4503a", ["--mortar" as string]: "#7c3425" }} animate={{ x: open ? "100%" : 0 }} transition={{ duration: dur, ease: [0.7, 0, 0.2, 1] }} />
        {!open && (
          <button onClick={() => setOpen(true)} className="absolute inset-0 z-10 flex items-end justify-center pb-3" aria-label="Tap the crack to open the wall">
            <svg aria-hidden viewBox="0 0 40 192" className="absolute inset-y-0 left-1/2 h-full w-10 -translate-x-1/2" preserveAspectRatio="none"><path d="M22 0 14 40 26 70 12 110 24 140 16 192" fill="none" stroke="#0b0716" strokeWidth="5" strokeLinejoin="round" /><path d="M22 0 14 40 26 70 12 110 24 140 16 192" fill="none" stroke="#ffd36b" strokeWidth="1.5" /></svg>
            <span className="relative z-10 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-chalk">Tap the crack</span>
          </button>
        )}
      </div>
      {open && <button onClick={() => setOpen(false)} className="mt-3 w-full text-center text-sm text-chalk-dim underline">Close the wall</button>}
    </div>
  );
}
