"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const KEY = "fw-curtain";

/** Brick shutters that close over the Wall before a conversation opens, then part on the other side. */
export function useCurtainNav() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [closing, setClosing] = useState(false);
  const go = useCallback((href: string) => {
    if (reduce) { router.push(href); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch { /* storage may be unavailable */ }
    setClosing(true);
    window.setTimeout(() => router.push(href), 320);
  }, [router, reduce]);
  const overlay = (
    <AnimatePresence>
      {closing && (
        <div className="pointer-events-auto fixed inset-0 z-[90]" aria-hidden>
          <motion.div className="wall wall-brick absolute inset-y-0 left-0 w-1/2" style={{ ["--wall" as string]: "#b4503a", ["--mortar" as string]: "#7c3425" }} initial={{ x: "-100%" }} animate={{ x: 0 }} transition={{ duration: 0.3, ease: "easeIn" }} />
          <motion.div className="wall wall-brick absolute inset-y-0 right-0 w-1/2" style={{ ["--wall" as string]: "#b4503a", ["--mortar" as string]: "#7c3425" }} initial={{ x: "100%" }} animate={{ x: 0 }} transition={{ duration: 0.3, ease: "easeIn" }} />
        </div>
      )}
    </AnimatePresence>
  );
  return { go, overlay };
}

export function CurtainOpen() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === "1") { sessionStorage.removeItem(KEY); if (!reduce) setShow(true); }
    } catch { /* ignore */ }
  }, [reduce]);
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-hidden>
      <motion.div className="wall wall-brick absolute inset-y-0 left-0 w-1/2" style={{ ["--wall" as string]: "#b4503a", ["--mortar" as string]: "#7c3425" }} initial={{ x: 0 }} animate={{ x: "-100%" }} transition={{ duration: 0.45, ease: "easeOut" }} onAnimationComplete={() => setShow(false)} />
      <motion.div className="wall wall-brick absolute inset-y-0 right-0 w-1/2" style={{ ["--wall" as string]: "#b4503a", ["--mortar" as string]: "#7c3425" }} initial={{ x: 0 }} animate={{ x: "100%" }} transition={{ duration: 0.45, ease: "easeOut" }} />
    </div>
  );
}
