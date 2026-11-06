"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BOARD_11 } from "@/games/strata/config/layouts";
import { PLAYER_COLORS } from "@/games/strata/config/palette";
import { STRATA_RULES } from "@/games/strata/config/rules";
import { activePlayer, canSubmit, checkMove, createGame, isStuck, placeBlock, ranking, submitTurn, undoBlock, winners, type GameState, type PlayerInfo } from "@/games/strata/engine/game";
import { PLAY_REASON_TEXT } from "@/games/strata/engine/play";
import { PIECES, flip, rollSide, rotateYaw, size, tiltPitch, type Cubes } from "@/games/strata/engine/pieces";
import { place, type Placement } from "@/games/strata/engine/placement";
import type { PlayerColor } from "@/games/strata/engine/types";
import type { CameraCmd } from "./BoardScene";
import type { HeldBlock } from "./PracticeScene";
import type { PlacedPiece } from "./Blocks";
import { cx } from "@/lib/utils";

const PracticeScene = dynamic(() => import("./PracticeScene").then((m) => m.PracticeScene), { ssr: false, loading: () => <div className="fw-skel h-full w-full" aria-busy="true" /> });

const ORDER: PlayerColor[] = ["blue", "turquoise", "yellow", "orange"]; // opposite corners first, so a 2 player game is fair
const KEY = "strata-local-game-v1";
const turnLeft = (c: Cubes) => rotateYaw(rotateYaw(rotateYaw(c)));
const recentre = (prev: Cubes, next: Cubes, x: number, y: number) => { const a = size(prev), b = size(next); return { x: Math.round(x + (a.w - b.w) / 2), y: Math.round(y + (a.d - b.d) / 2) }; };

type Saved = { state: GameState; placed: PlacedPiece[] };
const load = (): Saved | null => { try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as Saved) : null; } catch { return null; } };
const save = (v: Saved | null) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* storage can be unavailable; the game still works */ } };
const newSeed = () => (Math.floor(Math.random() * 2 ** 31) >>> 0) || 1;

function hasWebGL() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } }

export function GameView() {
  const [state, setState] = useState<GameState | null>(null);
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);
  const [held, setHeld] = useState<HeldBlock | null>(null);
  const [cmd, setCmd] = useState<CameraCmd>({ kind: "angled", nonce: 0 });
  const [note, setNote] = useState<string | null>(null);
  const [names, setNames] = useState(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const [count, setCount] = useState(2);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [gl, setGl] = useState(true);
  useEffect(() => { setSaved(load()); setGl(hasWebGL()); }, []);

  const start = useCallback((players: PlayerInfo[]) => {
    const made = createGame({ layout: BOARD_11, players, seed: newSeed() });
    if (!made.ok) { setNote(`Couldn't start: ${made.error}`); return; }
    setState(made.state); setPlaced([]); setHeld(null); setNote(null); save({ state: made.state, placed: [] });
  }, []);
  const startFromSetup = () => start(Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: names[i].trim() || `Player ${i + 1}`, color: ORDER[i], kind: "human" as const })));

  const commitState = (s: GameState, p: PlacedPiece[]) => { setState(s); setPlaced(p); save(s.status === "finished" ? null : { state: s, placed: p }); };

  const me = state ? activePlayer(state) : null;
  const tray = useMemo(() => (state ? state.turn.hand.map((id) => ({ id, cubes: PIECES[id].cubes as Cubes })) : []), [state]);
  const check = useMemo(() => (state && held ? checkMove(state, held.cubes, held.x, held.y) : null), [state, held]);
  const shown: Placement | null = useMemo(() => {
    if (!state || !held || !check) return null;
    const g = place(state.board, held.cubes, held.x, held.y);
    return { ...g, valid: check.ok };
  }, [state, held, check]);
  const stuck = useMemo(() => (state ? isStuck(state) : false), [state]);
  const submit_ok = state ? canSubmit(state) : false;
  const standing = useMemo(() => (state ? ranking(state) : []), [state]);
  const send = (kind: CameraCmd["kind"]) => setCmd((c) => ({ kind, nonce: c.nonce + 1 }));

  const select = (id: string) => { const cubes = PIECES[id].cubes as Cubes, s = size(cubes); setHeld({ id, cubes, x: Math.round((BOARD_11.width - s.w) / 2), y: Math.round((BOARD_11.height - s.d) / 2) }); setNote(null); };
  const transform = useCallback((fn: (c: Cubes) => Cubes) => setHeld((h) => { if (!h) return h; const cubes = fn(h.cubes); return { ...h, cubes, ...recentre(h.cubes, cubes, h.x, h.y) }; }), []);

  const confirm = useCallback(() => {
    if (!state || !held || !check?.ok) return;
    const r = placeBlock(state, held.id, held.cubes, held.x, held.y);
    if (!r.ok) { setNote(PLAY_REASON_TEXT[r.error as keyof typeof PLAY_REASON_TEXT] ?? "That block can't go there."); return; }
    commitState(r.state, [...placed, { id: Date.now() + placed.length, world: check.placement.world }]);
    setHeld(null); setNote(null);
  }, [state, held, check, placed]);
  const undo = () => { if (!state) return; const r = undoBlock(state); if (r.ok) { commitState(r.state, placed.slice(0, -1)); setHeld(null); setNote("Took back the last block."); } };
  const endTurn = () => {
    if (!state) return;
    const r = submitTurn(state);
    if (!r.ok) { setNote(r.error === "hand_not_empty" ? "Place all your blocks first." : "The turn can't end yet."); return; }
    commitState(r.state, placed); setHeld(null);
    const next = r.state.status === "finished" ? null : r.state.players[r.state.turn.player].name;
    setNote(`${r.captured ? `Captured ${r.captured} tile${r.captured > 1 ? "s" : ""}. ` : ""}${next ? `${next}, your turn.` : ""}`);
  };
  const leave = () => { save(null); setState(null); setPlaced([]); setHeld(null); setNote(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      const k = e.key.toLowerCase();
      if (k === "escape") setHeld(null);
      else if (!held) return;
      else if (k === "r") transform(rotateYaw); else if (k === "t") transform(tiltPitch); else if (k === "f") transform(flip); else if (k === "enter") confirm(); else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [held, transform, confirm]);

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
            <button type="button" className={cx(btn, "!bg-coral !text-[#2a0d08]")} onClick={() => { setState(saved.state); setPlaced(saved.placed); }}>Resume</button></div>
        )}
        <fieldset className="space-y-2"><legend className="mb-1 font-black">Players</legend>
          <div className="flex gap-2" role="group" aria-label="Number of players">{[2, 3, 4].map((n) => <button key={n} type="button" aria-pressed={count === n} className={cx(btn, "flex-1", count === n && "!bg-mustard !text-[#2a1d00]")} onClick={() => setCount(n)}>{n} players</button>)}</div>
          <ul className="space-y-2">{Array.from({ length: count }, (_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-night-2 p-2.5">
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: PLAYER_COLORS[ORDER[i]].hex }} />
              <label className="flex-1 text-xs text-chalk-dim">{PLAYER_COLORS[ORDER[i]].name} corner<input value={names[i]} maxLength={16} onChange={(e) => setNames((n) => n.map((v, j) => (j === i ? e.target.value : v)))} className="mt-0.5 w-full rounded-lg bg-night px-2.5 py-2 text-base font-bold text-chalk outline-none focus:ring-2 focus:ring-coral" /></label>
            </li>))}</ul>
          <p className="text-xs text-chalk-dim">This board has four corners, so up to 4 players. Five and six players need a bigger board, coming later.</p>
        </fieldset>
        <button type="button" className="btn-press flex min-h-14 w-full items-center justify-center rounded-2xl bg-coral px-5 font-black text-[#2a0d08]" onClick={startFromSetup}>Start game</button>
        <Link href="/games/strata/how-to-play" className="block text-center text-sm underline">How to play</Link>
        {note && <p role="alert" className="text-sm text-[#ff7a7a]">{note}</p>}
      </div>
    );
  }

  // ---------- game ----------
  const over = state.status === "finished";
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
            <div className="flex items-center justify-center gap-1.5 truncate text-xs text-chalk-dim">{dot(p.color)}<span className="truncate">{p.name}</span></div>
            <div className="display text-2xl font-black leading-tight" data-testid={`score-${i}`}>{r.score}</div>
            <div className="text-[11px] text-chalk-dim">{r.claimed} claimed · {r.captured} captured</div>
          </li>); })}
      </ul>

      <div className="relative h-[46vh] min-h-[320px] touch-none overflow-hidden rounded-3xl bg-night-2" data-testid="strata-board">
        <PracticeScene board={state.board} selected={null} onPick={(c) => { if (held && c) { const s = size(held.cubes); setHeld({ ...held, x: c.x - Math.floor(s.w / 2), y: c.y - Math.floor(s.d / 2) }); } }} cmd={cmd} placed={placed} tray={over ? [] : tray} held={over ? null : held} placement={shown}
          onSelectTray={select} onMove={(x, y) => setHeld((h) => (h ? { ...h, x, y } : h))} />
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-chalk-dim/80">{over ? "Game over" : held ? "Drag the lifted block, or tap a tile to move it" : "Tap one of your blocks below the board"}</p>
      </div>

      {over ? (
        <section className="space-y-3 rounded-2xl bg-night-2 p-4" aria-label="Result" data-testid="result">
          <h2 className="display text-2xl font-black">{w.length > 1 ? "It's a tie" : `${w[0].name} wins`}</h2>
          <ol className="space-y-1.5">{standing.map((r, i) => <li key={r.player.id} className="flex items-center gap-2 text-sm"><span className="w-5 text-chalk-dim">{i + 1}.</span>{dot(r.player.color)}<b className="flex-1 truncate">{r.player.name}</b><span>{r.score} pts</span><span className="text-xs text-chalk-dim">{r.claimed} claimed · {r.captured} captured</span></li>)}</ol>
          <p className="text-xs text-chalk-dim">{state.history.length} turns played.</p>
          <div className="flex flex-wrap gap-2"><button type="button" className={cx(btn, "!bg-coral !text-[#2a0d08]")} onClick={() => start(state.players)}>Rematch</button><button type="button" className={btn} onClick={leave}>New game</button><Link href="/games" className={btn}>Games</Link><Link href="/" className={btn}>Back to False Walls</Link></div>
        </section>
      ) : (
        <section aria-label="Your turn" className="space-y-2 rounded-2xl bg-night-2 p-3" data-testid="block-panel">
          <p className="text-sm" aria-live="polite" data-testid="block-status">
            <b style={{ color: PLAYER_COLORS[me!.color].hex }}>{me!.name}</b>
            {state.status === "final_round" && <span className="ml-1 rounded-full bg-mustard px-2 py-0.5 text-[11px] font-black text-[#2a1d00]">Final round</span>}
            {" · "}
            {held && check ? (check.ok ? <><b className="text-[#3ddc97]">Fits.</b> Confirm to place the {PIECES[held.id].name}.</> : <><b className="text-[#ff7a7a]">Can&apos;t place here.</b> {PLAY_REASON_TEXT[check.reason]}</>)
              : state.turn.hand.length ? (stuck ? <>No block fits anywhere. End your turn.</> : <>Block {Math.min(blockNo, STRATA_RULES.blocksPerTurn)} of {STRATA_RULES.blocksPerTurn}: pick one up. {note}</>) : <>All blocks placed. End your turn. {note}</>}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={!held} onClick={() => transform(turnLeft)} aria-label="Rotate left">↺ Left</button>
            <button type="button" className={btn} disabled={!held} onClick={() => transform(rotateYaw)} aria-label="Rotate right">↻ Right</button>
            <button type="button" className={btn} disabled={!held} onClick={() => transform(tiltPitch)} aria-label="Tip forward">⤵ Tip</button>
            <button type="button" className={btn} disabled={!held} onClick={() => transform(rollSide)} aria-label="Roll sideways">⟳ Roll</button>
            <button type="button" className={btn} disabled={!held} onClick={() => transform(flip)} aria-label="Flip (mirror)">⇋ Flip</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cx(btn, "!bg-coral !text-[#2a0d08]")} disabled={!held || !check?.ok} onClick={confirm} data-testid="confirm">Confirm placement</button>
            <button type="button" className={btn} disabled={!held} onClick={() => setHeld(null)}>Put back</button>
            <button type="button" className={btn} disabled={state.turn.placed.length === 0} onClick={undo} data-testid="undo">Undo block</button>
            <button type="button" className={cx(btn, submit_ok && "!bg-mustard !text-[#2a1d00]")} disabled={!submit_ok} onClick={endTurn} data-testid="end-turn">End turn</button>
          </div>
        </section>
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
