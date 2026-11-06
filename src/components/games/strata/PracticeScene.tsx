"use client";
import type { Board, Cell } from "@/games/strata/engine/types";
import type { Cubes } from "@/games/strata/engine/pieces";
import type { Placement } from "@/games/strata/engine/placement";
import { BoardScene, type CameraCmd } from "./BoardScene";
import { Held, PlacedBlocks, Tray, type PlacedPiece } from "./Blocks";
import { FillLayer, Outline } from "./Territory";
import type { FillStep } from "@/games/strata/engine/animation";
import type { PlayerColor } from "@/games/strata/engine/types";

export type HeldBlock = { id: string; cubes: Cubes; x: number; y: number };

export type SceneExtras = {
  /** The tiles under this turn's temporary blocks, tinted in the player's colour. */
  outline?: { cells: Array<{ x: number; y: number }>; color: PlayerColor; strong: boolean };
  /** The colour fill after a confirmed move. */
  fill?: { plan: FillStep[]; onDone: () => void };
  /** Shrink the temporary blocks away. */
  vanish?: boolean;
};

export function PracticeScene({ board, selected, onPick, cmd, placed, tray, held, placement, onSelectTray, onMove, extras, color }: {
  color?: PlayerColor | null;
  extras?: SceneExtras;
  board: Board; selected: Cell | null; onPick: (c: Cell) => void; cmd: CameraCmd; placed: PlacedPiece[];
  tray: Array<{ id: string; cubes: Cubes }>; held: HeldBlock | null; placement: Placement | null;
  onSelectTray: (id: string) => void; onMove: (x: number, y: number) => void;
}) {
  return (
    <BoardScene board={board} selected={selected} onPick={onPick} cmd={cmd}>
      {extras?.outline && extras.outline.cells.length > 0 && <Outline board={board} cells={extras.outline.cells} color={extras.outline.color} strong={extras.outline.strong} />}
      {extras?.fill && <FillLayer board={board} plan={extras.fill.plan} onDone={extras.fill.onDone} />}
      <PlacedBlocks board={board} placed={placed} vanish={extras?.vanish} />
      <Tray board={board} items={tray} activeId={held?.id ?? null} onSelect={onSelectTray} />
      {held && placement && <Held board={board} cubes={held.cubes} x={held.x} y={held.y} placement={placement} onMove={onMove} color={color ?? null} />}
    </BoardScene>
  );
}
