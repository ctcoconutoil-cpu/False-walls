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
import type { HeldBlock, SceneExtras } from "./PracticeScene";
import type { PlacedPiece } from "./Blocks";
import { cx } from "@/lib/utils";

const TrayView = dynamic(() => import("./TrayView").then((m) => m.TrayView), { ssr: false, loading: () => <div className="fw-skel h-full w-full" aria-busy="true" /> });
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
      <div className="mx-auto h-dvh max-w-2xl space-y-5 overflow-y-auto px-4 pb-8 pt-4">
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
  const me2 = me!;
  const round = "btn-press grid shrink-0 place-items-center rounded-full border-2 border-mustard/60 bg-night-2 text-xl font-black leading-none shadow-[0_3px_0_#0b0714] disabled:opacity-35";
  const ctl = (label: string, glyph: string, on: () => void, opts: { disabled?: boolean; big?: boolean; tone?: "coral" | "mustard"; testid?: string; aria?: string } = {}) => (
    <button type="button" disabled={opts.disabled} onClick={on} data-testid={opts.testid} aria-label={opts.aria ?? label} className="flex flex-col items-center gap-1 disabled:opacity-100">
      <span className={cx(round, opts.big ? "h-14 w-14 text-2xl" : "h-11 w-11", opts.tone === "coral" && !opts.disabled && "!border-coral !bg-coral !text-[#2a0d08]", opts.tone === "mustard" && !opts.disabled && "!border-mustard !bg-mustard !text-[#2a1d00]", opts.disabled && "opacity-35")}>{glyph}</span>
      <span className={cx("text-[11px] font-bold", opts.disabled ? "text-chalk-dim/50" : "text-chalk")}>{label}</span>
    </button>
  );
  const status = over ? "Game over"
    : anim?.stage === "confirmed" ? "Move confirmed. The blocks are coming off."
    : busy ? "Filling in the new territory…"
    : me2.kind === "ai" ? `${me2.name} is ${held ? "placing a block…" : "thinking…"}`
    : held && check ? (check.ok ? `Fits. Place the ${PIECES[held.id].name} when it looks right.` : `Can't place here. ${PLAY_REASON_TEXT[check.reason]}`)
    : state.turn.hand.length ? (stuck ? "No block fits anywhere. Confirm to end your turn." : `Block ${Math.min(blockNo, STRATA_RULES.blocksPerTurn)} of ${STRATA_RULES.blocksPerTurn}: tap a block below to pick it up. ${note ?? ""}`)
    : `All three blocks are down. Check the score, then confirm. ${note ?? ""}`;
  const mine = !over && me2.kind === "human";
  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-night pb-[max(8px,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2 border-b-2 border-mustard/50 bg-night-2 px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button type="button" aria-label={over ? "Done" : "Leave game"} className="btn-press grid h-10 w-10 shrink-0 place-items-center rounded-full text-2xl text-mustard" onClick={() => { if (over || window.confirm("Leave this game? It will be lost.")) leave(); }}>‹</button>
        <ul className="grid min-w-0 flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${state.players.length}, minmax(0, 1fr))` }} aria-label="Scores">
          {state.players.map((pl, i) => { const r = standing.find((x) => x.index === i)!; const on = !over && state.turn.player === i; return (
            <li key={pl.id} aria-current={on ? "true" : undefined} className="min-w-0 rounded-xl bg-night px-1.5 py-1 text-center" style={on ? { boxShadow: `0 0 0 2px ${PLAYER_COLORS[pl.color].hex}` } : undefined}>
              <div className="flex items-center justify-center gap-1 truncate text-[11px] leading-tight text-chalk-dim">{dot(pl.color)}<span className="truncate">{pl.kind === "ai" ? "🤖 " : ""}{pl.name}</span></div>
              <div className="display text-xl font-black leading-none" data-testid={`score-${i}`}>{r.score}</div>
              <div className="truncate text-[10px] leading-tight text-chalk-dim">{r.claimed} claimed · {r.captured} captured</div>
            </li>); })}
        </ul>
        <Link href="/games/strata/how-to-play" aria-label="Rules" className="btn-press grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-mustard/60 text-base font-black text-mustard">?</Link>
      </header>

      <div className="relative min-h-0 flex-1 touch-none overflow-hidden" data-testid="strata-board">
        <PracticeScene flip={viewFlip} color={me?.color ?? null} extras={extras} board={standingBoard ?? state.board} selected={null} onPick={(c) => { if (humanTurn && held && c) { const s = size(held.cubes); setHeld({ ...held, x: c.x - Math.floor(s.w / 2), y: c.y - Math.floor(s.d / 2) }); } }} placed={placed} held={over ? null : held} placement={shown}
          onMove={(x, y) => { if (humanTurn) setHeld((h) => (h ? { ...h, x, y } : h)); }} />
      </div>

      {/* the blocks waiting for you sit straight under the board, small and seen from the front, with the message above them */}
      <div className="bg-night-2 pb-1">
      <div className="px-3 pt-1.5 text-center" aria-live="polite" data-testid="block-status">
        <p className="text-[13px] leading-snug">
          {state.status === "final_round" && !over && <span className="mr-1 rounded-full bg-mustard px-2 py-0.5 text-[11px] font-black text-[#2a1d00]">Final round</span>}
          <b style={{ color: PLAYER_COLORS[me2.color].hex }}>{me2.name}</b> <span className="text-chalk-dim">· {status}</span>
        </p>
        {mine && preview && (
          <p className="mt-0.5 text-[13px]" data-testid="score-preview">
            <b>If you confirm: </b>
            <span className="text-chalk-dim">claimed {preview.gain.claimed >= 0 ? "+" : ""}{preview.gain.claimed}×{STRATA_RULES.claimedPoints}, captured +{preview.gain.captured}×{STRATA_RULES.capturedPoints}{preview.gain.heightBonus > 0 ? `, height bonus +${preview.gain.heightBonus}` : ""}{preview.opponentLoss > 0 ? `, taken from others −${preview.opponentLoss}` : ""} = </span>
            <b style={{ color: PLAYER_COLORS[me2.color].hex }}>{preview.gain.total >= 0 ? "+" : ""}{preview.gain.total}</b>
          </p>
        )}
      </div>
        <div className="h-[92px] touch-manipulation overflow-hidden" data-testid="strata-tray">
          {!over && <TrayView items={tray} activeId={held?.id ?? null} onSelect={select} />}
        </div>
      </div>

      <div className="mt-1.5 space-y-1.5 px-3">
        <div className="flex items-start justify-around" role="toolbar" aria-label="Turn the block">
          {ctl("Left", "↺", () => transform(turnLeft), { disabled: !held || !mine, aria: "Rotate left" })}
          {ctl("Right", "↻", () => transform(rotateYaw), { disabled: !held || !mine, aria: "Rotate right" })}
          {ctl("Tip", "⤵", () => transform(tiltPitch), { disabled: !held || !mine, aria: "Tip forward" })}
          {ctl("Roll", "⟳", () => transform(rollSide), { disabled: !held || !mine, aria: "Roll sideways" })}
          {ctl("Flip", "⇋", () => transform(flip), { disabled: !held || !mine, aria: "Flip (mirror)" })}
        </div>
        <div className="flex items-start justify-around" role="toolbar" aria-label="Your move">
          {ctl("Put back", "✕", () => setHeld(null), { disabled: !held || !mine })}
          {ctl("Undo", "↶", undo, { disabled: !mine || state.turn.placed.length === 0 || busy, testid: "undo", aria: "Undo block" })}
          {ctl("Place", "⬇", confirm, { disabled: !mine || !held || !check?.ok || busy, big: true, tone: "coral", testid: "confirm", aria: "Place block" })}
          {ctl("Confirm", "✓", endTurn, { disabled: !mine || !submit_ok || busy, big: true, tone: "mustard", testid: "end-turn", aria: "Confirm move" })}
        </div>
      </div>

      {over && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-night/90 p-4">
          <section className="w-full max-w-sm space-y-3 rounded-2xl bg-night-2 p-4" aria-label="Result" data-testid="result">
            <h2 className="display text-2xl font-black">{w.length > 1 ? "It's a tie" : `${w[0].name} wins`}</h2>
            <ol className="space-y-1.5">{standing.map((r, i) => <li key={r.player.id} className="flex items-center gap-2 text-sm"><span className="w-5 text-chalk-dim">{i + 1}.</span>{dot(r.player.color)}<b className="flex-1 truncate">{r.player.name}</b><span>{r.score} pts</span><span className="text-xs text-chalk-dim">{r.claimed} claimed · {r.captured} captured</span></li>)}</ol>
            <p className="text-xs text-chalk-dim">{state.history.length} turns played.</p>
            <div className="flex flex-wrap gap-2"><button type="button" className={cx(btn, "!bg-coral !text-[#2a0d08]")} onClick={() => start(state.players)}>Rematch</button><button type="button" className={btn} onClick={leave}>New game</button><Link href="/games" className={btn}>Games</Link></div>
          </section>
        </div>
      )}
    </div>
  );
}
