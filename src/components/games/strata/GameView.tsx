"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BOARD_11 } from "@/games/strata/config/layouts";
import { PLAYER_COLORS } from "@/games/strata/config/palette";
import { STRATA_RULES } from "@/games/strata/config/rules";
import { chooseBlock, LEVELS, type Level } from "@/games/strata/engine/ai";
import { activePlayer, canSubmit, checkMove, createGame, isStuck, outline, placeBlock, previewTurn, ranking, submitTurn, undoBlock, winners, type GameState, type PlayerInfo } from "@/games/strata/engine/game";
import { fillPlan, type FillStep } from "@/games/strata/engine/animation";
import { PLAY_REASON_TEXT } from "@/games/strata/engine/play";
import { PIECES, flip, rollSide, rotateYaw, size, tiltPitch, type Cubes } from "@/games/strata/engine/pieces";
import { place, type Placement } from "@/games/strata/engine/placement";
import type { Board, PlayerColor } from "@/games/strata/engine/types";
import type { CameraCmd } from "./BoardScene";
import type { HeldBlock, SceneExtras } from "./PracticeScene";
import type { PlacedPiece } from "./Blocks";
import { cx } from "@/lib/utils";

const PracticeScene = dynamic(() => import("./PracticeScene").then((m) => m.PracticeScene), { ssr: false, loading: () => <div className="fw-skel h-full w-full" aria-busy="true" /> });

const ORDER: PlayerColor[] = ["blue", "turquoise", "yellow", "orange"]; // opposite corners first, so a 2 player game is fair
const KEY = "strata-local-game-v2";
const turnLeft = (c: Cubes) => rotateYaw(rotateYaw(rotateYaw(c)));
const recentre = (prev: Cubes, next: Cubes, x: number, y: number) => { const a = size(prev), b = size(next); return { x: Math.round(x + (a.w - b.w) / 2), y: Math.round(y + (a.d - b.d) / 2) }; };

type Saved = { state: GameState };
type Anim = { plan: FillStep[]; before: Board; blocks: PlacedPiece[]; vanish: boolean; /** "confirmed": score is in, blocks still stand, for a moment before they come off by themselves. "reveal": blocks shrink away and the colour fills in. */ stage: "confirmed" | "reveal"; color: PlayerColor; mover: "human" | "ai" };
const load = (): Saved | null => { try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as Saved) : null; } catch { return null; } };
const save = (v: Saved | null) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* storage can be unavailable; the game still works */ } };
const newSeed = () => (Math.floor(Math.random() * 2 ** 31) >>> 0) || 1;

function hasWebGL() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } }

export function GameView() {
  const [state, setState] = useState<GameState | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [held, setHeld] = useState<HeldBlock | null>(null);
  const [cmd, setCmd] = useState<CameraCmd>({ kind: "angled", nonce: 0 });
  const [note, setNote] = useState<string | null>(null);
  const [slots, setSlots] = useState<Array<{ name: string; kind: "human" | "ai"; level: Level }>>([
    { name: "Player 1", kind: "human", level: "intermediate" }, { name: "Computer", kind: "ai", level: "intermediate" },
    { name: "Computer 2", kind: "ai", level: "intermediate" }, { name: "Computer 3", kind: "ai", level: "intermediate" },
  ]);
  const [count, setCount] = useState(2);
  const [thinkMs, setThinkMs] = useState(900); // how long the computer "thinks" and how fast it moves
  const [saved, setSaved] = useState<Saved | null>(null);
  const [gl, setGl] = useState(true);
  useEffect(() => { setSaved(load()); setGl(hasWebGL()); }, []);

  const start = useCallback((players: PlayerInfo[]) => {
    const made = createGame({ layout: BOARD_11, players, seed: newSeed() });
    if (!made.ok) { setNote(`Couldn't start: ${made.error}`); return; }
    setState(made.state); setAnim(null); setHeld(null); setNote(null); save({ state: made.state });
  }, []);
  const startFromSetup = () => start(Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: slots[i].name.trim() || (slots[i].kind === "ai" ? `Computer ${i}` : `Player ${i + 1}`), color: ORDER[i], kind: slots[i].kind, level: slots[i].kind === "ai" ? slots[i].level : undefined })));

  const commitState = (s: GameState) => { setState(s); save(s.status === "finished" ? null : { state: s }); };
  // Confirming a move: the board shows the colour spreading out from the blocks, then the temporary blocks shrink away and the new territory stays.
  const finishTurn = (s: GameState): ReturnType<typeof submitTurn> => {
    const sub = submitTurn(s);
    if (!sub.ok) return sub;
    const blocks: PlacedPiece[] = sub.blocks.map((b, i) => ({ id: s.turnNumber * 10 + i, world: b.world }));
    const plan = fillPlan(sub.resolution, sub.blocks);
    commitState(sub.state);
    if (plan.length) {
      // Stage 1: the move is confirmed and scored and the blocks stay put for a moment. Stage 2 takes them away by itself and reveals the territory.
      const mover = activePlayer(s);
      setAnim({ plan, before: s.board, blocks, vanish: false, stage: "confirmed", color: mover.color, mover: mover.kind });
      window.setTimeout(() => setAnim((a) => (a && a.plan === plan && a.stage === "confirmed" ? { ...a, stage: "reveal", vanish: true } : a)), mover.kind === "ai" ? 1100 : 800);
    }
    return sub;
  };
  const animDone = useCallback(() => setAnim(null), []);
  
  const me = state ? activePlayer(state) : null;
  // turn the view so the mover's own colour is on the side nearest them; the computer's turn leaves it as it was
  const [viewFlip, setViewFlip] = useState(false);
  useEffect(() => {
    if (!state || !me || me.kind !== "human") return;
    const mine = state.board.cells.flat().filter((c) => c.startOf === me.color);
    if (mine.length) setViewFlip(mine.reduce((a, c) => a + c.y, 0) / mine.length < state.board.height / 2);
  }, [state, me]);
  const busy = !!anim;
  const humanTurn = !!state && state.status !== "finished" && !busy && me?.kind === "human";
  const standingBoard = anim?.before ?? state?.board ?? null;
  const placed: PlacedPiece[] = useMemo(() => (anim ? anim.blocks : state ? state.turn.placed.map((b, i) => ({ id: state.turnNumber * 10 + i, world: b.world })) : []), [anim, state]);
  const occupied = useMemo(() => new Set((state?.turn.placed ?? []).flatMap((b) => b.world.map((c) => c.join(",")))), [state]);
  const tray = useMemo(() => (state ? state.turn.hand.map((id) => ({ id, cubes: PIECES[id].cubes as Cubes })) : []), [state]);
  const check = useMemo(() => (state && held ? checkMove(state, held.cubes, held.x, held.y) : null), [state, held]);
  const shown: Placement | null = useMemo(() => {
    if (!state || !held || !check) return null;
    const g = place(state.board, held.cubes, held.x, held.y, occupied);
    return { ...g, valid: check.ok };
  }, [state, held, check, occupied]);
  const stuck = useMemo(() => (state ? isStuck(state) : false), [state]);
  const submit_ok = state ? canSubmit(state) : false;
  const standing = useMemo(() => (state ? ranking(state) : []), [state]);
  const preview = useMemo(() => (state && humanTurn ? previewTurn(state) : null), [state, humanTurn]);
  const extras: SceneExtras = useMemo(() => ({
    outline: anim?.stage === "confirmed" ? { cells: [...new Map(anim.blocks.flatMap((b) => b.world).map(([x, y]) => [`${x},${y}`, { x, y }])).values()], color: anim.color, strong: true }
      : state && !anim && state.status !== "finished" ? { cells: outline(state), color: activePlayer(state).color, strong: !!preview } : undefined,
    fill: anim?.stage === "reveal" ? { plan: anim.plan, onDone: animDone } : undefined,
    vanish: anim?.vanish,
  }), [state, anim, preview, animDone]);
  const send = (kind: CameraCmd["kind"]) => setCmd((c) => ({ kind, nonce: c.nonce + 1 }));

  const select = (id: string) => { if (!humanTurn) return; const cubes = PIECES[id].cubes as Cubes, s = size(cubes); setHeld({ id, cubes, x: Math.round((BOARD_11.width - s.w) / 2), y: Math.round((BOARD_11.height - s.d) / 2) }); setNote(null); };
  const transform = useCallback((fn: (c: Cubes) => Cubes) => setHeld((h) => { if (!h) return h; const cubes = fn(h.cubes); return { ...h, cubes, ...recentre(h.cubes, cubes, h.x, h.y) }; }), []);

  const confirm = useCallback(() => {
    if (!state || !held || !check?.ok || state.players[state.turn.player].kind !== "human") return;
    const r = placeBlock(state, held.id, held.cubes, held.x, held.y);
    if (!r.ok) { setNote(PLAY_REASON_TEXT[r.error as keyof typeof PLAY_REASON_TEXT] ?? "That block can't go there."); return; }
    commitState(r.state);
    setHeld(null); setNote(null);
  }, [state, held, check]);
  const undo = () => { if (!state || !humanTurn) return; const r = undoBlock(state); if (r.ok) { commitState(r.state); setHeld(null); setNote("Took back the last block."); } };
  const endTurn = () => {
    if (!state || !humanTurn) return;
    const r = finishTurn(state);
    if (!r.ok) { setNote(r.error === "hand_not_empty" ? "Place all three blocks first." : "The move can't be confirmed yet."); return; }
    setHeld(null);
    const next = r.state.status === "finished" ? null : r.state.players[r.state.turn.player].name;
    setNote(`${r.captured ? `Captured ${r.captured} tile${r.captured > 1 ? "s" : ""}. ` : ""}${next ? `${next}, your turn.` : ""}`);
  };
  // The computer's turn: think, pick up a block, turn it, move it, confirm, repeat, then end the turn. It only uses the same rule functions as a person.
  const turnKey = state ? `${state.turnNumber}:${state.status}` : "";
  useEffect(() => {
    if (!state || state.status === "finished" || activePlayer(state).kind !== "ai" || anim) return;
    const who = activePlayer(state);
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));
    (async () => {
      let s = state;
      await wait(thinkMs);
      while (!cancelled && s.turn.hand.length) {
        const c = chooseBlock(s, who.level ?? "intermediate");
        if (!c) break;
        const base = PIECES[c.pieceId].cubes as Cubes, bs = size(base);
        setHeld({ id: c.pieceId, cubes: base, x: Math.round((BOARD_11.width - bs.w) / 2), y: Math.round((BOARD_11.height - bs.d) / 2) });
        await wait(thinkMs * 0.5); if (cancelled) return;
        setHeld({ id: c.pieceId, cubes: c.cubes, x: c.x, y: c.y });
        await wait(thinkMs * 0.7); if (cancelled) return;
        const r = placeBlock(s, c.pieceId, c.cubes, c.x, c.y);
        if (!r.ok) break;
        s = r.state;
        commitState(s); setHeld(null);
        await wait(thinkMs * 0.4);
      }
      if (cancelled) return;
      await wait(thinkMs * 0.4); if (cancelled) return;
      const sub = finishTurn(s);
      if (!sub.ok) return;
      const next = sub.state.status === "finished" ? null : sub.state.players[sub.state.turn.player].name;
      setNote(`${who.name}${sub.captured ? ` captured ${sub.captured} tile${sub.captured > 1 ? "s" : ""}.` : " ended the turn."} ${next ? `${next}'s turn.` : ""}`);
    })();
    return () => { cancelled = true; timers.forEach((t) => window.clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, thinkMs, busy]);

  const leave = () => { save(null); setState(null); setAnim(null); setHeld(null); setNote(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      const k = e.key.toLowerCase();
      if (k === "escape") setHeld(null);
      else if (!held || !humanTurn) return;
      else if (k === "arrowleft") setHeld((h) => (h ? { ...h, x: h.x - 1 } : h)); else if (k === "arrowright") setHeld((h) => (h ? { ...h, x: h.x + 1 } : h)); else if (k === "arrowup") setHeld((h) => (h ? { ...h, y: h.y - 1 } : h)); else if (k === "arrowdown") setHeld((h) => (h ? { ...h, y: h.y + 1 } : h));
      else if (k === "r") transform(rotateYaw); else if (k === "t") transform(tiltPitch); else if (k === "f") transform(flip); else if (k === "enter") confirm(); else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [held, humanTurn, transform, confirm]);

  const btn = "btn-press inline-flex min-h-11 items-center justify-center rounded-xl bg-night-3 px-3.5 text-sm font-bold disabled:opacity-40";
  const dot = (c: PlayerColor) => <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: PLAYER_COLORS[c].hex }} />;

  if (!gl) return <div className="rounded-2xl bg-night-2 p-5 text-sm text-chalk-dim">This device can&apos;t draw 3D graphics, which STRATA needs. Try another browser or turn on hardware acceleration.</div>;

  // ---------- setup ----------
  if (!state) {
    return (
      <div className="space-y-5">
        <div><Link href="/games/strata" className="text-sm text-chalk-dim underline">STRATA</Link><h1 className="display mt-1 text-3xl font-black">Pass and play</h1><p className="mt-1 text-chalk-dim">Take turns on one device. Everything is calculated on your device, so it works offline once the page has loaded.</p></div>
        {saved && saved.state.status !== "finished" && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-night-2 p-4"><span className="text-sm"><b>Game in progress</b><span className="block text-chalk-dim">{saved.state.players.map((p) => p.name).join(" vs ")} · turn {saved.state.turnNumber}</span></span>
            <button type="button" className={cx(btn, "!bg-coral !text-[#2a0d08]")} onClick={() => { setState(saved.state); setAnim(null); }}>Resume</button></div>
        )}
        <fieldset className="space-y-2"><legend className="mb-1 font-black">Players</legend>
          <div className="flex gap-2" role="group" aria-label="Number of players">{[2, 3, 4].map((n) => <button key={n} type="button" aria-pressed={count === n} className={cx(btn, "flex-1", count === n && "!bg-mustard !text-[#2a1d00]")} onClick={() => setCount(n)}>{n} players</button>)}</div>
          <ul className="space-y-2">{Array.from({ length: count }, (_, i) => {
            const sl = slots[i], set = (patch: Partial<typeof sl>) => setSlots((all) => all.map((v, j) => (j === i ? { ...v, ...patch } : v)));
            return (
              <li key={i} className="space-y-2 rounded-2xl bg-night-2 p-2.5">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: PLAYER_COLORS[ORDER[i]].hex }}>{sl.kind === "ai" ? "🤖" : ""}</span>
                  <label className="flex-1 text-xs text-chalk-dim">{PLAYER_COLORS[ORDER[i]].name} corner<input value={sl.name} maxLength={16} onChange={(e) => set({ name: e.target.value })} className="mt-0.5 w-full rounded-lg bg-night px-2.5 py-2 text-base font-bold text-chalk outline-none focus:ring-2 focus:ring-coral" /></label>
                </div>
                <div className="flex gap-2" role="group" aria-label={`${PLAYER_COLORS[ORDER[i]].name} player type`}>
                  <button type="button" aria-pressed={sl.kind === "human"} className={cx(btn, "flex-1", sl.kind === "human" && "!bg-mustard !text-[#2a1d00]")} onClick={() => set({ kind: "human", name: /^Computer/.test(sl.name) ? `Player ${i + 1}` : sl.name })}>Person</button>
                  <button type="button" aria-pressed={sl.kind === "ai"} className={cx(btn, "flex-1", sl.kind === "ai" && "!bg-mustard !text-[#2a1d00]")} onClick={() => set({ kind: "ai", name: /^Player/.test(sl.name) ? (i ? `Computer ${i}` : "Computer") : sl.name })}>Computer</button>
                </div>
                {sl.kind === "ai" && (
                  <div>
                    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Difficulty">{LEVELS.map((l) => <button key={l.id} type="button" aria-pressed={sl.level === l.id} className={cx("btn-press min-h-11 rounded-lg bg-night-3 px-1 text-[12px] font-bold", sl.level === l.id && "!bg-coral !text-[#2a0d08]")} onClick={() => set({ level: l.id })}>{l.name}</button>)}</div>
                    <p className="mt-1.5 text-xs text-chalk-dim">{LEVELS.find((l) => l.id === sl.level)!.blurb}</p>
                  </div>
                )}
              </li>);
          })}</ul>
          {slots.slice(0, count).some((x) => x.kind === "ai") && (
            <div className="flex items-center gap-2 text-xs text-chalk-dim"><span>Computer speed</span>
              {([["Fast", 300], ["Normal", 900], ["Slow", 1800]] as const).map(([l, ms]) => <button key={l} type="button" aria-pressed={thinkMs === ms} className={cx("btn-press min-h-9 rounded-lg bg-night-3 px-3 font-bold text-chalk", thinkMs === ms && "!bg-mustard !text-[#2a1d00]")} onClick={() => setThinkMs(ms)}>{l}</button>)}</div>
          )}
          <p className="text-xs text-chalk-dim">This board has four corners, so up to 4 players. Five and six players need a bigger board, coming later.</p>
        </fieldset>
        <button type="button" className="btn-press flex min-h-14 w-full items-center justify-center rounded-2xl bg-coral px-5 font-black text-[#2a0d08]" onClick={startFromSetup}>Start game</button>
        <Link href="/games/strata/how-to-play" className="block text-center text-sm underline">How to play</Link>
        {note && <p role="alert" className="text-sm text-[#ff7a7a]">{note}</p>}
      </div>
    );
  }

  // ---------- game ----------
  const over = state.status === "finished" && !anim;
  const w = over ? winners(state) : [];
  const blockNo = STRATA_RULES.blocksPerTurn - state.turn.hand.length + (state.turn.hand.length ? 1 : 0);
  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h1 className="display text-xl font-black tracking-[0.14em]">STRATA</h1>
        <div className="flex gap-3 text-sm"><Link href="/games/strata/how-to-play" className="underline">Rules</Link><button type="button" className="underline" onClick={() => { if (over || window.confirm("Leave this game? It will be lost.")) leave(); }}>{over ? "Done" : "Leave"}</button></div>
      </header>

      <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(${state.players.length}, minmax(0, 1fr))` }} aria-label="Scores">
        {state.players.map((p, i) => { const r = standing.find((x) => x.index === i)!; const on = !over && state.turn.player === i; return (
          <li key={p.id} aria-current={on ? "true" : undefined} className={cx("rounded-2xl bg-night-2 p-2.5 text-center", on && "ring-2")} style={on ? { boxShadow: `0 0 0 2px ${PLAYER_COLORS[p.color].hex}` } : undefined}>
            <div className="flex items-center justify-center gap-1.5 truncate text-xs text-chalk-dim">{dot(p.color)}<span className="truncate">{p.kind === "ai" ? "🤖 " : ""}{p.name}</span></div>
            <div className="display text-2xl font-black leading-tight" data-testid={`score-${i}`}>{r.score}</div>
            <div className="text-[11px] text-chalk-dim">{r.claimed} claimed · {r.captured} captured</div>
          </li>); })}
      </ul>

      <div className="relative -mx-4 h-[62vh] min-h-[400px] touch-none overflow-hidden bg-night-2" data-testid="strata-board">
        <PracticeScene flip={viewFlip} color={me?.color ?? null} extras={extras} board={standingBoard ?? state.board} selected={null} onPick={(c) => { if (humanTurn && held && c) { const s = size(held.cubes); setHeld({ ...held, x: c.x - Math.floor(s.w / 2), y: c.y - Math.floor(s.d / 2) }); } }} cmd={cmd} placed={placed} tray={over ? [] : tray} held={over ? null : held} placement={shown}
          onSelectTray={select} onMove={(x, y) => { if (humanTurn) setHeld((h) => (h ? { ...h, x, y } : h)); }} />
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-chalk-dim/80">{over ? "Game over" : anim?.stage === "confirmed" ? "Move confirmed. The blocks are coming off." : busy ? "Filling in the new territory…" : held ? "Drag the lifted block, or tap a tile to move it" : "Tap one of your blocks below the board"}</p>
      </div>

      {over ? (
        <section className="space-y-3 rounded-2xl bg-night-2 p-4" aria-label="Result" data-testid="result">
          <h2 className="display text-2xl font-black">{w.length > 1 ? "It's a tie" : `${w[0].name} wins`}</h2>
          <ol className="space-y-1.5">{standing.map((r, i) => <li key={r.player.id} className="flex items-center gap-2 text-sm"><span className="w-5 text-chalk-dim">{i + 1}.</span>{dot(r.player.color)}<b className="flex-1 truncate">{r.player.name}</b><span>{r.score} pts</span><span className="text-xs text-chalk-dim">{r.claimed} claimed · {r.captured} captured</span></li>)}</ol>
          <p className="text-xs text-chalk-dim">{state.history.length} turns played.</p>
          <div className="flex flex-wrap gap-2"><button type="button" className={cx(btn, "!bg-coral !text-[#2a0d08]")} onClick={() => start(state.players)}>Rematch</button><button type="button" className={btn} onClick={leave}>New game</button><Link href="/games" className={btn}>Games</Link><Link href="/" className={btn}>Back to False Walls</Link></div>
        </section>
      ) : (
        <>
        <section aria-label="Your turn" className="space-y-2 rounded-2xl bg-night-2 p-3" data-testid="block-panel">
          {me!.kind === "ai" ? (
            <p className="flex items-center gap-2 text-sm" aria-live="polite" data-testid="block-status">
              <b style={{ color: PLAYER_COLORS[me!.color].hex }}>🤖 {me!.name}</b>
              {state.status === "final_round" && <span className="rounded-full bg-mustard px-2 py-0.5 text-[11px] font-black text-[#2a1d00]">Final round</span>}
              <span className="text-chalk-dim">{held ? "is placing a block…" : "is thinking…"}</span>
              <span aria-hidden className="ml-auto flex gap-1">{[0, 1, 2].map((i) => <i key={i} className="fw-twinkle block h-1.5 w-1.5 rounded-full bg-coral" style={{ animationDelay: `${i * 0.2}s` }} />)}</span>
            </p>
          ) : (<>
          <p className="text-sm" aria-live="polite" data-testid="block-status">
            <b style={{ color: PLAYER_COLORS[me!.color].hex }}>{me!.name}</b>
            {state.status === "final_round" && <span className="ml-1 rounded-full bg-mustard px-2 py-0.5 text-[11px] font-black text-[#2a1d00]">Final round</span>}
            {" · "}
            {anim?.stage === "confirmed" ? <>Move confirmed and scored.</> : busy ? <>Filling in the territory…</>
              : held && check ? (check.ok ? <><b className="text-[#3ddc97]">Fits.</b> Place the {PIECES[held.id].name} when it looks right.</> : <><b className="text-[#ff7a7a]">Can&apos;t place here.</b> {PLAY_REASON_TEXT[check.reason]}</>)
              : state.turn.hand.length ? (stuck ? <>No block fits anywhere. Confirm to end your turn.</> : <>Block {Math.min(blockNo, STRATA_RULES.blocksPerTurn)} of {STRATA_RULES.blocksPerTurn}: pick one up and place it. {note}</>) : <>All three blocks are down. Check the score below, then confirm. {note}</>}
          </p>
          {preview && (
            <div className="rounded-xl bg-night p-2.5 text-sm" data-testid="score-preview" aria-live="polite">
              <b>If you confirm</b>
              <ul className="mt-1 space-y-0.5 text-chalk-dim">
                <li>Claimed tiles: <b className="text-chalk">{preview.gain.claimed >= 0 ? "+" : ""}{preview.gain.claimed}</b> × {STRATA_RULES.claimedPoints} points</li>
                <li>Captured tiles: <b className="text-chalk">+{preview.gain.captured}</b> × {STRATA_RULES.capturedPoints} points</li>
                {preview.gain.heightBonus > 0 && <li>Height tile capture bonus: <b className="text-chalk">+{preview.gain.heightBonus}</b></li>}
                {preview.opponentLoss > 0 && <li>Taken from others: <b className="text-chalk">−{preview.opponentLoss}</b></li>}
              </ul>
              <p className="mt-1 font-black">Total <span style={{ color: PLAYER_COLORS[me!.color].hex }}>{preview.gain.total >= 0 ? "+" : ""}{preview.gain.total}</span> points</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={!held} onClick={() => transform(turnLeft)} aria-label="Rotate left">↺ Left</button>
            <button type="button" className={btn} disabled={!held} onClick={() => transform(rotateYaw)} aria-label="Rotate right">↻ Right</button>
            <button type="button" className={btn} disabled={!held} onClick={() => transform(tiltPitch)} aria-label="Tip forward">⤵ Tip</button>
            <button type="button" className={btn} disabled={!held} onClick={() => transform(rollSide)} aria-label="Roll sideways">⟳ Roll</button>
            <button type="button" className={btn} disabled={!held} onClick={() => transform(flip)} aria-label="Flip (mirror)">⇋ Flip</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cx(btn, "!bg-coral !text-[#2a0d08]")} disabled={!held || !check?.ok || busy} onClick={confirm} data-testid="confirm">Place block</button>
            <button type="button" className={btn} disabled={!held} onClick={() => setHeld(null)}>Put back</button>
            <button type="button" className={btn} disabled={state.turn.placed.length === 0 || busy} onClick={undo} data-testid="undo">Undo block</button>
            <button type="button" className={cx(btn, submit_ok && "!bg-mustard !text-[#2a1d00]")} disabled={!submit_ok || busy} onClick={endTurn} data-testid="end-turn">Confirm move</button>
          </div>
          </>)}
          {me!.kind === "ai" && note && <p className="text-xs text-chalk-dim">{note}</p>}
        </section>
        </>
      )}

      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Camera">
        <button type="button" className={btn} onClick={() => send("angled")}>Angled</button>
        <button type="button" className={btn} onClick={() => send("top")}>Top view</button>
        <button type="button" className={btn} onClick={() => send("zoomIn")} aria-label="Zoom in">＋</button>
        <button type="button" className={btn} onClick={() => send("zoomOut")} aria-label="Zoom out">－</button>
        <button type="button" className={btn} onClick={() => send("angled")}>Reset</button>
      </div>
    </div>
  );
}
