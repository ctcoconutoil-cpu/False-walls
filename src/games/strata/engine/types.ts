export type PlayerColor = "blue" | "yellow" | "orange" | "turquoise" | "purple" | "rose";
export type TileType = "normal" | "black" | "height" | "start";
export type TileStatus = "unclaimed" | "claimed" | "captured";

export type Cell = {
  x: number;
  y: number;
  type: TileType;
  /** For height tiles: the block height (number of dots) a block must have to claim it. */
  height: number | null;
  /** Start tiles belong to one colour's starting area. */
  startOf: PlayerColor | null;
  /** The marked diamond space inside a starting area. */
  diamond: boolean;
  owner: PlayerColor | null;
  status: TileStatus;
  /** Stack of cube units currently standing on this cell (0 = empty). */
  stack: number;
};

export type Board = { id: string; name: string; width: number; height: number; cells: Cell[][] };

export type BoardLayout = {
  id: string;
  name: string;
  width: number;
  height: number;
  black: ReadonlyArray<readonly [number, number]>;
  /** Dot tiles: [x, y, dots]. */
  dots: ReadonlyArray<readonly [number, number, number]>;
  starts: ReadonlyArray<{ color: PlayerColor; cells: ReadonlyArray<readonly [number, number]>; diamond: readonly [number, number] }>;
};
