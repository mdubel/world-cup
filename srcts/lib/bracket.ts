import type { Match, MatchStage, TrackerMap } from "./types";
import { isKnockoutStage } from "./fixtures";

// 2026 knockout column order. Third-place match is rendered separately
// because it isn't part of the championship lineage.
export const BRACKET_STAGES = [
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "FINAL",
] as const satisfies readonly MatchStage[];

export type BracketStage = (typeof BRACKET_STAGES)[number];

// How many vertical rows each stage's matches span when laid out on a
// 16-row grid. Doubling per stage keeps the bracket visually balanced.
export const BRACKET_ROW_SPAN: Record<BracketStage, number> = {
  LAST_32: 1,
  LAST_16: 2,
  QUARTER_FINALS: 4,
  SEMI_FINALS: 8,
  FINAL: 16,
};

export const BRACKET_TOTAL_ROWS = 16;

export const STAGE_COLUMN_LABEL: Record<BracketStage, string> = {
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  FINAL: "Final",
};

// FIFA WC 2026 bracket-position table, keyed by kickoff_utc string (which
// matches both football-data's `utcDate` and our iso_utc() output exactly).
// Sorting each stage by these positions instead of by raw kickoff order
// makes R16[N] = R32[2N] + R32[2N+1] (and same for higher rounds) — the
// pairing FIFA actually publishes. Without it, R32 matches got paired by
// kickoff order and e.g. Mexico ended up sharing a semi with Germany when
// FIFA's bracket has Mexico on the opposite half (they can only meet in
// the Final).
//
// Cross-referenced against FIFA's published bracket: the column order is
// top-to-bottom on the left half, then top-to-bottom on the right.
const BRACKET_POSITION_BY_KICKOFF: Record<BracketStage, Record<string, number>> =
  {
    LAST_32: {
      // Left half top
      "2026-06-29T20:30:00Z": 0, // M74 — GER's side
      "2026-06-30T21:00:00Z": 1, // M77
      "2026-06-28T19:00:00Z": 2, // M73
      "2026-06-30T01:00:00Z": 3, // M75
      // Left half bottom
      "2026-07-02T23:00:00Z": 4, // M83
      "2026-07-02T19:00:00Z": 5, // M84
      "2026-07-02T00:00:00Z": 6, // M81 — USA's side
      "2026-07-01T20:00:00Z": 7, // M82
      // Right half top
      "2026-06-29T17:00:00Z": 8, // M76
      "2026-06-30T17:00:00Z": 9, // M78
      "2026-07-01T01:00:00Z": 10, // M79 — MEX's side
      "2026-07-01T16:00:00Z": 11, // M80
      // Right half bottom
      "2026-07-03T22:00:00Z": 12, // M86
      "2026-07-03T18:00:00Z": 13, // M88
      "2026-07-03T03:00:00Z": 14, // M85
      "2026-07-04T01:30:00Z": 15, // M87
    },
    LAST_16: {
      "2026-07-04T21:00:00Z": 0, // M89  (M74+M77)
      "2026-07-04T17:00:00Z": 1, // M90  (M73+M75)
      "2026-07-06T19:00:00Z": 2, // M93  (M83+M84)
      "2026-07-07T00:00:00Z": 3, // M94  (M81+M82)
      "2026-07-05T20:00:00Z": 4, // M91  (M76+M78)
      "2026-07-06T00:00:00Z": 5, // M92  (M79+M80)
      "2026-07-07T16:00:00Z": 6, // M95  (M86+M88)
      "2026-07-07T20:00:00Z": 7, // M96  (M85+M87)
    },
    QUARTER_FINALS: {
      "2026-07-09T20:00:00Z": 0, // M97  (M89+M90)
      "2026-07-10T19:00:00Z": 1, // M98  (M93+M94)
      "2026-07-11T21:00:00Z": 2, // M99  (M91+M92)
      "2026-07-12T01:00:00Z": 3, // M100 (M95+M96)
    },
    SEMI_FINALS: {
      "2026-07-14T19:00:00Z": 0, // M101 (M97+M98)   ← GER/USA meet here
      "2026-07-15T19:00:00Z": 1, // M102 (M99+M100)  ← MEX semi
    },
    FINAL: {
      "2026-07-19T19:00:00Z": 0, // M104
    },
  };

export interface KnockoutColumns {
  byStage: Record<BracketStage, Match[]>;
  thirdPlace: Match | null;
}

/**
 * Sort knockout matches into stage columns. Within a stage matches are sorted
 * by kickoff time (ascending) so the same logical pairing always renders in
 * the same row position.
 */
/**
 * Index of a stage in BRACKET_STAGES, or -1 if not in the championship lineage
 * (e.g. THIRD_PLACE).
 */
export function stageIndex(stage: string): number {
  return BRACKET_STAGES.indexOf(stage as BracketStage);
}

/**
 * Find the earliest (lowest-index) knockout stage that contains a WATCH_LATER
 * match for the user. Returns null when nothing is marked. Used by the bracket
 * UI to mask team identities in slots whose teams come from feeders the user
 * hasn't watched yet.
 */
export function earliestWatchLaterStage(
  matches: Match[],
  tracker: TrackerMap
): BracketStage | null {
  let best: BracketStage | null = null;
  let bestIdx = Number.POSITIVE_INFINITY;
  for (const m of matches) {
    if (tracker[m.match_id] !== "WATCH_LATER") continue;
    const idx = stageIndex(m.stage);
    if (idx < 0) continue;
    if (idx < bestIdx) {
      bestIdx = idx;
      best = m.stage as BracketStage;
    }
  }
  return best;
}

export function buildKnockoutColumns(matches: Match[]): KnockoutColumns {
  const byStage: Record<BracketStage, Match[]> = {
    LAST_32: [],
    LAST_16: [],
    QUARTER_FINALS: [],
    SEMI_FINALS: [],
    FINAL: [],
  };
  let thirdPlace: Match | null = null;

  for (const m of matches) {
    if (!isKnockoutStage(m.stage)) continue;
    if (m.stage === "THIRD_PLACE") {
      thirdPlace = m;
      continue;
    }
    if (m.stage in byStage) {
      byStage[m.stage as BracketStage].push(m);
    }
  }

  // Sort each stage by FIFA bracket position rather than kickoff order —
  // FIFA's pairing graph doesn't follow kickoff chronology. Unknown
  // kickoffs (schedule change, off-cycle match) fall through to
  // kickoff-order as a defensive fallback so the bracket still renders.
  for (const stage of BRACKET_STAGES) {
    const positions = BRACKET_POSITION_BY_KICKOFF[stage] ?? {};
    byStage[stage].sort((a, b) => {
      const pa = positions[a.kickoff_utc] ?? Number.MAX_SAFE_INTEGER;
      const pb = positions[b.kickoff_utc] ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.kickoff_utc.localeCompare(b.kickoff_utc);
    });
  }

  return { byStage, thirdPlace };
}
