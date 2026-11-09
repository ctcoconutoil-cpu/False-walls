"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRevealGate } from "@/components/wall/RevealGate";
import { motion, useReducedMotion } from "framer-motion";
import { revealPost, votePoll, type Revealed } from "@/lib/actions/posts";
import { Button, Notice } from "@/components/ui";
import { WALL_COLORS, FALSE_WALL_KINDS } from "@/lib/constants";
import type { Post } from "@/lib/types";

type Poll = { mine: number | null; counts: number[] } | null;

/** The wall-opening moment: a panel splits and slides apart to show what was concealed. */
export function RevealPanel({ post, loggedIn, initiallyOpen = false, ownerData }: { post: Post; loggedIn: boolean; initiallyOpen?: boolean; ownerData?: Revealed | null }) {
  const reduce = useReducedMotion();
  const [data, setData] = useState<Revealed | null>(ownerData ?? null);
  const [poll, setPoll] = useState<Poll>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [pending, start] = useTransition();
  const gate = useRevealGate();
  useEffect(() => { if (data) gate?.setOpened(true); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = WALL_COLORS[post.wall_color] ?? WALL_COLORS.coral;
  const isWall = post.type === "false_wall";

  function open() {
    setError(null);
    start(async () => {
      const r = await revealPost(post.id);
      if (!r.ok) { setError(r.error); return; }
      setOpening(true);
      setData(r.data);
      setPoll(r.poll);
    });
  }
  // Content the viewer already unlocked loads straight away.
  const autoTried = useRef(false);
  useEffect(() => {
    if (initiallyOpen && !autoTried.current && !data) { autoTried.current = true; open(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiallyOpen]);

  if (!data) {
    if (post.is_sample && !loggedIn) return <LockedCard post={post} c={c} />;
    return (
      <div className="space-y-3">
        <div className="wall wall-slab relative grid min-h-44 place-items-center overflow-hidden rounded-2xl p-5 text-center" style={{ ["--wall" as string]: c.dark, ["--mortar" as string]: c.base, boxShadow: `inset 0 0 0 4px ${c.base}66` }}>
          <div className="relative z-10">
            <p className="display text-2xl uppercase text-chalk drop-shadow-[0_2px_0_rgba(0,0,0,.5)]">{post.clue}</p>
            {isWall && post.false_wall_kind && <p className="mt-2 text-xs font-bold uppercase tracking-wider text-chalk/80">Behind this wall: {FALSE_WALL_KINDS[post.false_wall_kind].toLowerCase()}</p>}
          </div>
        </div>
        {loggedIn ? (
          <Button tone="mustard" onClick={open} disabled={pending} className="w-full">{pending ? "Opening…" : isWall ? "Open the wall" : "Reveal the thought"}</Button>
        ) : (
          <Notice>Log in to open walls and discover what's behind them.</Notice>
        )}
        {post.reveal_mode === "followers" && <p className="text-xs text-chalk-dim">The creator only lets followers open this one.</p>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl" aria-live="polite">
      {opening && !reduce && (
        <>
          <motion.div aria-hidden className="wall wall-slab absolute inset-y-0 left-0 z-20 w-1/2" style={{ ["--wall" as string]: c.dark, ["--mortar" as string]: c.base }} initial={{ x: 0 }} animate={{ x: "-101%" }} transition={{ duration: 0.8, ease: [0.7, 0, 0.2, 1] }} onAnimationComplete={() => setOpening(false)} />
          <motion.div aria-hidden className="wall wall-slab absolute inset-y-0 right-0 z-20 w-1/2" style={{ ["--wall" as string]: c.dark, ["--mortar" as string]: c.base }} initial={{ x: 0 }} animate={{ x: "101%" }} transition={{ duration: 0.8, ease: [0.7, 0, 0.2, 1] }} />
        </>
      )}
      <motion.div initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reduce ? 0 : 0.25, duration: 0.4 }} className="space-y-3 rounded-2xl bg-night-2 p-4" style={{ boxShadow: `inset 0 0 0 3px ${c.base}` }}>
        {data.media.length > 0 && (
          <div className="grid gap-2">
            {data.media.map((m) => m.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url} alt={m.alt_text ?? "Revealed picture"} width={m.width ?? undefined} height={m.height ?? undefined} loading="lazy" decoding="async" className="w-full rounded-xl object-cover" />
            ))}
          </div>
        )}
        {data.payload?.question && <p className="display text-xl">{data.payload.question}</p>}
        {data.hidden_text && <p className="whitespace-pre-wrap text-lg leading-relaxed">{data.hidden_text}</p>}
        {data.payload?.options && (
          <ul className="space-y-2">
            {data.payload.options.map((o, i) => {
              const total = poll?.counts.reduce((a, b) => a + b, 0) ?? 0;
              const pct = total ? Math.round(((poll?.counts[i] ?? 0) / total) * 100) : 0;
              const mine = poll?.mine === i;
              return (
                <li key={i}>
                  <button
                    disabled={pending}
                    onClick={() => start(async () => { const r = await votePoll(post.id, i); if (r.ok) setPoll(r.poll); else setError(r.error); })}
                    className="relative w-full overflow-hidden rounded-xl border-2 px-3.5 py-3 text-left font-semibold"
                    style={{ borderColor: mine ? c.base : "#2a2650" }} aria-pressed={mine}
                  >
                    {poll?.mine != null && <span aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: `${c.base}40` }} />}
                    <span className="relative flex justify-between gap-3"><span>{o}</span>{poll?.mine != null && <span className="text-sm text-chalk-dim">{pct}%</span>}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </motion.div>
    </div>
  );
}

function LockedCard({ post, c }: { post: Post; c: { base: string; dark: string } }) {
  return (
    <div className="space-y-3">
      <div className="grid min-h-40 place-items-center rounded-2xl p-5 text-center" style={{ background: c.dark, boxShadow: `inset 0 0 0 4px ${c.base}66` }}>
        <p className="display text-2xl uppercase">{post.clue}</p>
      </div>
      <Notice>Log in to open this wall.</Notice>
    </div>
  );
}
