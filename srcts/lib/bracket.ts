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

  for (const stage of BRACKET_STAGES) {
    byStage[stage].sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
  }

  return { byStage, thirdPlace };
}
