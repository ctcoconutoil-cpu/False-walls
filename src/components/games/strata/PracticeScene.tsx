"use client";
import type { Board, Cell } from "@/games/strata/engine/types";
import type { Cubes } from "@/games/strata/engine/pieces";
import type { Placement } from "@/games/strata/engine/placement";
import { BoardScene } from "./BoardScene";
import { Held, PlacedBlocks, type PlacedPiece } from "./Blocks";
import { FillLayer, Outline } from "./Territory";
import type { FillStep } from "@/games/strata/engine/animation";
import type { PlayerColor } from "@/games/strata/engine/types";

export type HeldBlock = { id: string; cubes: Cubes; x: number; y: number };

/** Keeps the block you are holding fully on the board: it can be moved anywhere, but never partly off the edge. */
export function clampHeld(board: { width: number; height: number }, h: HeldBlock | null): HeldBlock | null {
  if (!h) return h;
  const w = Math.max(...h.cubes.map((c) => c[0])) + 1, d = Math.max(...h.cubes.map((c) => c[1])) + 1;
  const x = Math.max(0, Math.min(board.width - w, h.x)), y = Math.max(0, Math.min(board.height - d, h.y));
  return x === h.x && y === h.y ? h : { ...h, x, y };
}

export type SceneExtras = {
  /** The tiles under this turn's temporary blocks, tinted in the player's colour. */
  outline?: { cells: Array<{ x: number; y: number }>; color: PlayerColor; strong: boolean };
  /** The colour fill after a confirmed move. */
  fill?: { plan: FillStep[]; onDone: () => void };
  /** Shrink the temporary blocks away. */
  vanish?: boolean;
};

export function PracticeScene({ board, selected, onPick, placed, held, placement, onMove, extras, color, flip = false }: {
  flip?: boolean;
  color?: PlayerColor | null;
  extras?: SceneExtras;
  board: Board; selected: Cell | null; onPick: (c: Cell) => void; placed: PlacedPiece[];
  held: HeldBlock | null; placement: Placement | null;
  onMove: (x: number, y: number) => void;
}) {
  return (
    <BoardScene board={board} selected={selected} onPick={onPick} flip={flip}>
      {extras?.outline && extras.outline.cells.length > 0 && <Outline board={board} cells={extras.outline.cells} color={extras.outline.color} strong={extras.outline.strong} />}
      {extras?.fill && <FillLayer board={board} plan={extras.fill.plan} onDone={extras.fill.onDone} />}
      <PlacedBlocks board={board} placed={placed} vanish={extras?.vanish} />
      {held && placement && <Held board={board} cubes={held.cubes} x={held.x} y={held.y} placement={placement} onMove={onMove} color={color ?? null} />}
    </BoardScene>
  );
}
