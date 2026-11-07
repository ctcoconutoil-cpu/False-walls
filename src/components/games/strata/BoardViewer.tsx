"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBoard, previewTerritory } from "@/games/strata/engine/board";
import { describeCell } from "@/games/strata/engine/describe";
import { BOARD_11 } from "@/games/strata/config/layouts";
import { PLAYER_COLORS } from "@/games/strata/config/palette";
import { PIECES, STARTER_SET, flip, rollSide, rotateYaw, size, tiltPitch, type Cubes } from "@/games/strata/engine/pieces";
import { place, REASON_TEXT } from "@/games/strata/engine/placement";
import type { Board, Cell } from "@/games/strata/engine/types";
import { clampHeld, type HeldBlock } from "./PracticeScene";
import type { PlacedPiece } from "./Blocks";
import { cx } from "@/lib/utils";

const TrayView = dynamic(() => import("./TrayView").then((m) => m.TrayView), { ssr: false, loading: () => <div className="fw-skel h-full w-full" aria-busy="true" /> });
const PracticeScene = dynamic(() => import("./PracticeScene").then((m) => m.PracticeScene), { ssr: false, loading: () => <div className="fw-skel h-full w-full" aria-busy="true" /> });

function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

const TRAY = STARTER_SET.map((id) => ({ id, cubes: PIECES[id].cubes as Cubes }));

/** Re-centres a block after it changes shape, so turning it doesn't make it jump across the board. */
const recentre = (prev: Cubes, next: Cubes, x: number, y: number) => {
  const a = size(prev), b = size(next);
  return { x: Math.round(x + (a.w - b.w) / 2), y: Math.round(y + (a.d - b.d) / 2) };
};

export function BoardViewer() {
  const [real] = useState<Board>(() => createBoard(BOARD_11));
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);
  const [held, setHeldRaw] = useState<HeldBlock | null>(null);
  // whatever sets the held block (a tap, a drag, the keys, a turn) it always ends up fully on the board
  const setHeld = useCallback((v: HeldBlock | null | ((h: HeldBlock | null) => HeldBlock | null)) => setHeldRaw((prev) => clampHeld(BOARD_11, typeof v === "function" ? v(prev) : v)), []);
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [gl] = useState(() => (typeof document === "undefined" ? true : hasWebGL()));
  const [note, setNote] = useState<string | null>(null);

  const board = useMemo(() => (preview ? previewTerritory(real) : real), [real, preview]);
  const placement = useMemo(() => (held ? place(real, held.cubes, held.x, held.y, new Set(placed.flatMap((p) => p.world.map((c) => c.join(","))))) : null), [held, real, placed]);

  const select = useCallback((id: string) => {
    const cubes = PIECES[id].cubes as Cubes, s = size(cubes);
    setHeld({ id, cubes, x: Math.round((BOARD_11.width - s.w) / 2), y: Math.round((BOARD_11.height - s.d) / 2) });
    setNote(null);
  }, []);
  const transform = useCallback((fn: (c: Cubes) => Cubes) => setHeld((h) => {
    if (!h) return h;
    const cubes = fn(h.cubes);
    return { ...h, cubes, ...recentre(h.cubes, cubes, h.x, h.y) };
  }), []);
  const confirm = useCallback(() => {
    if (!held || !placement?.valid) return;
    setPlaced((p) => [...p, { id: Date.now() + p.length, world: placement.world }]);
    setNote(`Placed the ${PIECES[held.id].name.toLowerCase()}.`);
    setHeld(null);
  }, [held, placement]);
  const undo = useCallback(() => {
    if (!placed.length) return;
    setPlaced((p) => p.slice(0, -1)); setNote("Undid the last block.");
  }, [placed.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      const k = e.key.toLowerCase();
      if (k === "escape") setHeld(null);
      else if (!held) return;
      else if (k === "r") transform(rotateYaw);
      else if (k === "t") transform(tiltPitch);
      else if (k === "f") transform(flip);
      else if (k === "enter") confirm();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [held, transform, confirm]);

  const onPick = (c: Cell | null) => {
    if (held && c) { const s = size(held.cubes); setHeld({ ...held, x: c.x - Math.floor(s.w / 2), y: c.y - Math.floor(s.d / 2) }); return; }
    setSelected(c);
  };
  const info = selected ? describeCell(board.cells[selected.y][selected.x]) : null;
  const btn = "btn-press inline-flex min-h-11 items-center justify-center rounded-xl bg-night-3 px-3.5 text-sm font-bold disabled:opacity-40";
  const turnLeft = (c: Cubes) => rotateYaw(rotateYaw(rotateYaw(c)));

  if (!gl) return <div className="rounded-2xl bg-night-2 p-5 text-sm text-chalk-dim">This device can&apos;t draw 3D graphics, which STRATA needs. Try another browser or turn on hardware acceleration.</div>;
  return (
    <div className="space-y-3">
      <div className="relative aspect-[100/104] touch-none overflow-hidden rounded-3xl bg-night-2" data-testid="strata-board">
        <PracticeScene board={board} selected={selected} onPick={onPick} placed={placed} held={held} placement={placement}
          onMove={(x, y) => setHeld((h) => (h ? { ...h, x, y } : h))} />
      </div>
      <div className="mt-2 h-[150px] overflow-hidden rounded-2xl bg-night-2"><TrayView items={TRAY} activeId={held?.id ?? null} onSelect={select} /></div>
      <p className="text-center text-[11px] text-chalk-dim/80">{held ? "Drag the lifted block, or tap a tile to move it" : "Tap a block below the board to pick it up"}</p>

      <section aria-label="Block controls" className="space-y-2 rounded-2xl bg-night-2 p-3" data-testid="block-panel">
        <p className="text-sm" aria-live="polite" data-testid="block-status">
          {held && placement ? (placement.valid
            ? <><b className="text-[#3ddc97]">Fits</b> · {PIECES[held.id].name}{placement.bridge ? ", as a bridge" : ""}. Confirm to place it.</>
            : <><b className="text-[#ff7a7a]">Can&apos;t place here</b> · {REASON_TEXT[placement.reason!]}</>)
            : <span className="text-chalk-dim">{note ?? "Practice mode: pick up a block, turn it, and place it. Blocks stand on the board and never stack. Real turns, bridges and scoring are in Play."}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={!held} onClick={() => transform(turnLeft)} aria-label="Rotate left">↺ Left</button>
          <button type="button" className={btn} disabled={!held} onClick={() => transform(rotateYaw)} aria-label="Rotate right">↻ Right</button>
          <button type="button" className={btn} disabled={!held} onClick={() => transform(tiltPitch)} aria-label="Tip forward">⤵ Tip</button>
          <button type="button" className={btn} disabled={!held} onClick={() => transform(rollSide)} aria-label="Roll sideways">⟳ Roll</button>
          <button type="button" className={btn} disabled={!held} onClick={() => transform(flip)} aria-label="Flip (mirror)">⇋ Flip</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cx(btn, "!bg-coral !text-[#2a0d08]")} disabled={!held || !placement?.valid} onClick={confirm} data-testid="confirm">Confirm placement</button>
          <button type="button" className={btn} disabled={!held} onClick={() => setHeld(null)}>Put back</button>
          <button type="button" className={btn} disabled={placed.length === 0} onClick={undo} data-testid="undo">Undo last</button>
          <span className="ml-auto self-center text-xs text-chalk-dim" data-testid="placed-count">{placed.length} placed</span>
        </div>
      </section>

      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Camera">
        <button type="button" aria-pressed={preview} className={cx(btn, preview && "!bg-mustard !text-[#2a1d00]")} onClick={() => setPreview((p) => !p)}>Preview claimed and captured</button>
      </div>
      <div className="min-h-[4.5rem] rounded-2xl bg-night-2 p-3.5 text-sm" aria-live="polite">
        {info ? <><b>{info.title}</b><p className="mt-0.5 text-chalk-dim">{info.text}</p></> : <p className="text-chalk-dim">Tap any tile to see what it does.</p>}
      </div>
      <ul className="flex flex-wrap gap-2 text-xs text-chalk-dim" aria-label="Player colours">
        {BOARD_11.starts.map((s) => <li key={s.color} className="flex items-center gap-1.5 rounded-full bg-night-2 px-2.5 py-1"><span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: PLAYER_COLORS[s.color].hex }} />{PLAYER_COLORS[s.color].name}</li>)}
      </ul>
    </div>
  );
}
