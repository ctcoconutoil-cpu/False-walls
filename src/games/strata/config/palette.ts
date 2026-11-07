import type { PlayerColor } from "../engine/types";

/** Colours sampled from the reference video. Purple and rose are added for 5 and 6 player games. */
export const PLAYER_COLORS: Record<PlayerColor, { name: string; hex: string; deep: string }> = {
  turquoise: { name: "Turquoise", hex: "#4CC3B5", deep: "#2c8f84" },
  orange: { name: "Orange", hex: "#E0552B", deep: "#a83a1a" },
  yellow: { name: "Yellow", hex: "#E6C619", deep: "#a58f0c" },
  blue: { name: "Blue", hex: "#8FCBEA", deep: "#5a9bbd" },
  purple: { name: "Purple", hex: "#8E6BD1", deep: "#6244a3" },
  rose: { name: "Rose", hex: "#D1466B", deep: "#9a2c4a" },
};

/** The 3D board: pale tiles on a light slab, near-black blocked tiles, dark purple table. */
export const BOARD_COLORS = { tile: "#F6F6F4", line: "#c9c9c6", black: "#17171b", frame: "#e9e9e6", dot: "#1c1c20", backdrop: "#1b1230" };

/**
 * Territory patterns. A pattern is only a look for CLAIMED tiles (captured tiles are solid); it never changes how a tile plays.
 * The reference shows different patterns on different colours, so each colour gets its own by default and a player can be given another.
 */
export const PATTERNS = ["waves", "dots", "crosses", "zigzag", "diagonal", "grid"] as const;
export type PatternId = (typeof PATTERNS)[number];
export const PLAYER_PATTERN: Record<PlayerColor, PatternId> = {
  turquoise: "waves", yellow: "dots", blue: "crosses", orange: "zigzag", purple: "diagonal", rose: "grid",
};
