"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { createBoard, previewTerritory } from "@/games/strata/engine/board";
import { describeCell } from "@/games/strata/engine/describe";
import { BOARD_11 } from "@/games/strata/config/layouts";
import { PLAYER_COLORS } from "@/games/strata/config/palette";
import type { Cell } from "@/games/strata/engine/types";
import type { CameraCmd } from "./BoardScene";
import { cx } from "@/lib/utils";

const BoardScene = dynamic(() => import("./BoardScene").then((m) => m.BoardScene), { ssr: false, loading: () => <div className="fw-skel h-full w-full" aria-busy="true" /> });

function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

export function BoardViewer() {
  const base = useMemo(() => createBoard(BOARD_11), []);
  const [preview, setPreview] = useState(false);
  const board = useMemo(() => (preview ? previewTerritory(base) : base), [base, preview]);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [cmd, setCmd] = useState<CameraCmd>({ kind: "angled", nonce: 0 });
  const [gl] = useState(() => (typeof document === "undefined" ? true : hasWebGL()));
  const send = (kind: CameraCmd["kind"]) => setCmd((c) => ({ kind, nonce: c.nonce + 1 }));
  const info = selected ? describeCell(board.cells[selected.y][selected.x]) : null;
  const btn = "btn-press inline-flex min-h-11 items-center justify-center rounded-xl bg-night-3 px-3.5 text-sm font-bold";

  if (!gl) return <div className="rounded-2xl bg-night-2 p-5 text-sm text-chalk-dim">This device can&apos;t draw 3D graphics, which STRATA needs. Try another browser or turn on hardware acceleration.</div>;
  return (
    <div className="space-y-3">
      <div className="relative h-[62vh] min-h-[380px] overflow-hidden rounded-3xl bg-night-2" data-testid="strata-board">
        <BoardScene board={board} selected={selected} onPick={(c) => setSelected(c ?? null)} cmd={cmd} />
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-chalk-dim/80">Drag to turn · pinch or scroll to zoom · tap a tile</p>
      </div>
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Camera">
        <button type="button" className={btn} onClick={() => send("angled")}>Angled</button>
        <button type="button" className={btn} onClick={() => send("top")}>Top view</button>
        <button type="button" className={btn} onClick={() => send("zoomIn")} aria-label="Zoom in">＋</button>
        <button type="button" className={btn} onClick={() => send("zoomOut")} aria-label="Zoom out">－</button>
        <button type="button" className={btn} onClick={() => { setSelected(null); send("angled"); }}>Reset</button>
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
