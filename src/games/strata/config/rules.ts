/**
 * Central STRATA rules. Nothing in the renderer or the engine hardcodes these numbers.
 * "confirmed" values come from Board's published Strata help articles (board.gorgias.help, Strata FAQs and Instructions).
 * "unconfirmed" values are not stated there; they are kept here as configurable defaults so they can be corrected in one place.
 */
export const STRATA_RULES = {
  // confirmed
  blocksPerTurn: 3,
  claimedPoints: 5,
  capturedPoints: 10,
  mustUseAllBlocks: true,
  mustTouchOwnTerritory: true, // at least one block on or next to the player's Claimed or Captured tiles
  flatSideContactOnly: true, // corner-to-corner does not count
  noOverhang: true,
  cannotTouchBlackTiles: true,
  cannotTouchOpponentCaptured: true,
  blocksMustStand: true,
  heightTileMustMatch: true,
  /** House rules (optional in the source game). */
  timerSecondsMin: 30,
  timerSecondsMax: 300,
  timerBonusPoints: 50,
  // unconfirmed (kept configurable)
  minPlayers: 2,
  maxPlayers: 6,
  /** The source says height bonuses exist and are awarded on capture, but not how many points. */
  heightBonusPoints: null as number | null,
  heightBonusOn: "capture" as "capture" | "claim",
  /** The source says "filling the Territory Tracker" ends the game, but not its size. Fraction of open tiles claimed or captured. */
  territoryTrackerShare: 0.6,
  /** The diamond space marks each starting area. No separate rule is published, so it carries no extra points. */
  diamondBonusPoints: 0,
} as const;

export type StrataRules = typeof STRATA_RULES;
