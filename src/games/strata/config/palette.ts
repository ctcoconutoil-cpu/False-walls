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

export const BOARD_COLORS = { tile: "#F6F6F4", line: "#c9c9c6", black: "#17171b", frame: "#e9e9e6", dot: "#1c1c20" };
