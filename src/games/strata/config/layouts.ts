import type { BoardLayout } from "../engine/types";

/**
 * Board 1: the 11 x 11 board from the reference video (top-down shot, counted cell by cell).
 * The black obstacle clusters, the four starting corners and the dot tiles are mirrored left-to-right and top-to-bottom, as in the video.
 * The dot COUNTS are the one thing the video does not show clearly enough to count with certainty: the white tile inside each black
 * cluster shows three dots and the others two. Change them here if the real board differs.
 */
const dot = (list: Array<[number, number]>, n: number): Array<[number, number, number]> => list.map(([x, y]) => [x, y, n]);
const NOTCHES: Array<[number, number]> = [[5, 1], [2, 5], [8, 5], [5, 9]];
const TWO: Array<[number, number]> = [
  [3, 0], [4, 0], [6, 0], [7, 0], [3, 1], [7, 1],
  [0, 3], [1, 3], [4, 3], [6, 3], [9, 3], [10, 3],
  [0, 4], [10, 4], [4, 5], [6, 5], [0, 6], [10, 6],
  [0, 7], [1, 7], [4, 7], [6, 7], [9, 7], [10, 7],
  [3, 9], [7, 9], [3, 10], [4, 10], [6, 10], [7, 10],
];

export const BOARD_11: BoardLayout = {
  id: "classic-11",
  name: "Classic 11 x 11",
  width: 11,
  height: 11,
  black: [
    [4, 1], [6, 1], [4, 2], [5, 2], [6, 2], [5, 3], // top
    [1, 4], [2, 4], [0, 5], [1, 5], [1, 6], [2, 6], // left
    [9, 4], [8, 4], [10, 5], [9, 5], [9, 6], [8, 6], // right
    [5, 7], [4, 8], [5, 8], [6, 8], [4, 9], [6, 9], // bottom
  ],
  dots: [...dot(TWO, 2), ...dot(NOTCHES, 3)],
  starts: [
    { color: "blue", cells: [[1, 0], [0, 1], [1, 1]], diamond: [1, 1] },
    { color: "yellow", cells: [[9, 0], [9, 1], [10, 1]], diamond: [9, 1] },
    { color: "orange", cells: [[0, 9], [1, 9], [1, 10]], diamond: [1, 9] },
    { color: "turquoise", cells: [[9, 9], [10, 9], [10, 10]], diamond: [9, 9] },
  ],
};

export const LAYOUTS = { [BOARD_11.id]: BOARD_11 } as const;
