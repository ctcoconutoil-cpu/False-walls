/**
 * Central STRATA rules. Nothing in the renderer or the engine hardcodes these numbers.
 * "confirmed" values come from Board's published Strata help articles and the gameplay specification supplied for this project.
 * "unconfirmed" values are not stated there; they are kept here as configurable defaults so they can be corrected in one place.
 */
export const STRATA_RULES = {
  // confirmed
  blocksPerTurn: 3,
  claimedPoints: 5,
  capturedPoints: 10,
  /** Bonus for CAPTURING a height tile (not for claiming it), by its number of dots. */
  heightBonusPoints: { 1: 10, 2: 20, 3: 30 } as Readonly<Record<number, number>>,
  mustUseAllBlocks: true,
  /** At least one block of the three must be on or beside the player's territory. */
  mustTouchOwnTerritory: true,
  /** The three blocks form one arrangement and touch along flat faces; a corner touch doesn't count. */
  connectedArrangement: true,
  /** Every block stands on the board by itself and never rests on another block. */
  independentSupport: true,
  /** Black tiles and tiles another player has captured can only be claimed by a bridge that spans them. */
  restrictedNeedBridge: true,
  heightTileMustMatch: true,
  /** House rules (optional in the source game). */
  timerSecondsMin: 30,
  timerSecondsMax: 300,
  timerBonusPoints: 50,
  // unconfirmed (kept configurable)
  /** A height tile is claimed when the column of cubes on it is exactly this many cubes high ("exact") or at least that high ("at_least"). */
  heightMatch: "exact" as "exact" | "at_least",
  /** If none of the remaining blocks can legally be placed, the player may end the turn early. */
  allowEndWhenStuck: true,
  minPlayers: 2,
  maxPlayers: 6,
  /** The source says "filling the Territory Tracker" ends the game, but not its size. Fraction of open tiles claimed or captured. */
  territoryTrackerShare: 0.6,
  /** The diamond space marks each starting area. No separate rule is published, so it carries no extra points. */
  diamondBonusPoints: 0,
} as const;

export type StrataRules = typeof STRATA_RULES;
