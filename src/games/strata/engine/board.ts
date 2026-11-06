import type { Board, BoardLayout, Cell, PlayerColor } from "./types";

export function createBoard(layout: BoardLayout): Board {
  const cells: Cell[][] = Array.from({ length: layout.height }, (_, y) =>
    Array.from({ length: layout.width }, (_, x): Cell => ({ x, y, type: "normal", height: null, startOf: null, diamond: false, owner: null, status: "unclaimed" })));
  const at = (x: number, y: number) => {
    const c = cells[y]?.[x];
    if (!c) throw new Error(`Layout ${layout.id} has a tile outside the board at ${x},${y}`);
    return c;
  };
  for (const [x, y] of layout.black) at(x, y).type = "black";
  for (const [x, y, h] of layout.dots) {
    const c = at(x, y);
    if (c.type !== "normal") throw new Error(`Dot tile on a non-normal tile at ${x},${y}`);
    c.type = "height";
    c.height = h;
  }
  for (const s of layout.starts) {
    for (const [x, y] of s.cells) {
      const c = at(x, y);
      if (c.type !== "normal") throw new Error(`Start tile overlaps another tile at ${x},${y}`);
      c.type = "start";
      c.startOf = s.color;
      c.owner = s.color;
      c.status = "claimed";
    }
    at(s.diamond[0], s.diamond[1]).diamond = true;
  }
  return { id: layout.id, name: layout.name, width: layout.width, height: layout.height, cells };
}

export const cellAt = (b: Board, x: number, y: number): Cell | null => b.cells[y]?.[x] ?? null;
export const allCells = (b: Board): Cell[] => b.cells.flat();

/** Counts by tile type, for checks and the board legend. */
export function tally(b: Board) {
  const out = { normal: 0, black: 0, height: 0, start: 0, diamond: 0 };
  for (const c of allCells(b)) { out[c.type]++; if (c.diamond) out.diamond++; }
  return out;
}

export const startColors = (b: Board): PlayerColor[] => [...new Set(allCells(b).filter((c) => c.startOf).map((c) => c.startOf as PlayerColor))];

/**
 * Phase 1 only: a clearly labelled preview of how claimed and captured tiles look. It touches a copy and is never used in a real game.
 * Each colour gets the three open tiles nearest its diamond as claimed, and the tile beside the diamond as captured.
 */
export function previewTerritory(src: Board): Board {
  const b: Board = { ...src, cells: src.cells.map((row) => row.map((c) => ({ ...c }))) };
  const starts = allCells(b).filter((c) => c.diamond);
  for (const d of starts) {
    const open = allCells(b)
      .filter((c) => c.type !== "black" && c.type !== "start" && c.type !== "height")
      .sort((p, q) => Math.hypot(p.x - d.x, p.y - d.y) - Math.hypot(q.x - d.x, q.y - d.y))
      .slice(0, 4);
    open.forEach((c, i) => { c.owner = d.startOf; c.status = i === 0 ? "captured" : "claimed"; });
  }
  return b;
}
