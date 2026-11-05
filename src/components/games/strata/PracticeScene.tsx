"use client";
import type { Board, Cell } from "@/games/strata/engine/types";
import type { Cubes } from "@/games/strata/engine/pieces";
import type { Placement } from "@/games/strata/engine/placement";
import { BoardScene, type CameraCmd } from "./BoardScene";
import { Held, PlacedBlocks, Tray, type PlacedPiece } from "./Blocks";

export type HeldBlock = { id: string; cubes: Cubes; x: number; y: number };

export function PracticeScene({ board, selected, onPick, cmd, placed, tray, held, placement, onSelectTray, onMove }: {
  board: Board; selected: Cell | null; onPick: (c: Cell) => void; cmd: CameraCmd; placed: PlacedPiece[];
  tray: Array<{ id: string; cubes: Cubes }>; held: HeldBlock | null; placement: Placement | null;
  onSelectTray: (id: string) => void; onMove: (x: number, y: number) => void;
}) {
  return (
    <BoardScene board={board} selected={selected} onPick={onPick} cmd={cmd}>
      <PlacedBlocks board={board} placed={placed} />
      <Tray board={board} items={tray} activeId={held?.id ?? null} onSelect={onSelectTray} />
      {held && placement && <Held board={board} cubes={held.cubes} x={held.x} y={held.y} placement={placement} onMove={onMove} />}
    </BoardScene>
  );
}
