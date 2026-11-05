import type { Cell } from "./types";
import { PLAYER_COLORS } from "../config/palette";
import { STRATA_RULES } from "../config/rules";

/** Plain-language description of a tile, used for tap-to-inspect and the how-to-play legend. */
export function describeCell(c: Cell): { title: string; text: string } {
  const where = `Column ${c.x + 1}, row ${c.y + 1}`;
  if (c.type === "black") return { title: "Black tile", text: `${where}. An obstacle. Blocks can't stand on it or touch it. Cells you capture can use it as a wall.` };
  if (c.type === "height") return { title: `Height tile (${c.height} dots)`, text: `${where}. Only a block ${c.height} cubes high can claim this tile. A different height leaves it unclaimed.` };
  if (c.type === "start") return { title: `${PLAYER_COLORS[c.startOf!].name} starting area${c.diamond ? " (diamond)" : ""}`, text: `${where}. Part of ${PLAYER_COLORS[c.startOf!].name}'s starting territory. ${c.diamond ? "The diamond marks the heart of the starting area" + (STRATA_RULES.diamondBonusPoints ? "" : "; it carries no extra points") + ". " : ""}Your first blocks go on or next to it.` };
  if (c.status === "captured") return { title: "Captured tile", text: `${where}. Solid colour. Surrounded by ${PLAYER_COLORS[c.owner!].name}'s tiles, black tiles or the edge. Worth ${STRATA_RULES.capturedPoints} points and safe from other players.` };
  if (c.status === "claimed") return { title: "Claimed tile", text: `${where}. Patterned. Claimed by ${PLAYER_COLORS[c.owner!].name}. Worth ${STRATA_RULES.claimedPoints} points, and other players can still claim it.` };
  return { title: "Open tile", text: `${where}. Any block can claim it.` };
}
