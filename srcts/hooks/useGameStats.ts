import { useShinyOutput } from "@posit/shiny-react";
import { useMemo } from "react";
import { columnarToRows } from "../lib/fixtures";
import type {
  GameStats,
  GameStatsEntry,
  GameStatsScorer,
  GameStatsTimelineEntry,
} from "../lib/types";

/**
 * Wire format from `output$game_stats` matches GameStats EXCEPT that the
 * per-game `scorers` and the top-level `points_timeline` arrive in
 * Shiny's column-major data-frame shape ({ user_id: [...], display_name:
 * [...], ... }). columnarToRows reconstructs the row-major arrays the
 * components want.
 */
type RawScorerColumns = Record<string, unknown[]>;
type RawTimelineColumns = Record<string, unknown[]>;

interface RawGameEntry extends Omit<GameStatsEntry, "scorers"> {
  scorers: RawScorerColumns;
}

interface RawGameStats {
  games: Record<string, RawGameEntry>;
  superlatives: GameStats["superlatives"];
  points_timeline: RawTimelineColumns | GameStatsTimelineEntry[];
  computed_at_utc: string;
}

export function useGameStats(): { stats: GameStats | null; loaded: boolean } {
  const [raw] = useShinyOutput<RawGameStats | undefined>(
    "game_stats",
    undefined
  );

  const stats = useMemo<GameStats | null>(() => {
    if (!raw) return null;

    const games: Record<string, GameStatsEntry> = {};
    for (const [matchId, g] of Object.entries(raw.games ?? {})) {
      const scorers = columnarToRows<GameStatsScorer>(g.scorers ?? {});
      games[matchId] = { ...g, scorers };
    }

    // points_timeline is column-major when non-empty; an empty list comes
    // back as []. Either way reconstruct defensively.
    const timeline =
      Array.isArray(raw.points_timeline)
        ? (raw.points_timeline as GameStatsTimelineEntry[])
        : columnarToRows<GameStatsTimelineEntry>(
            raw.points_timeline as RawTimelineColumns
          );

    return {
      games,
      superlatives: raw.superlatives,
      points_timeline: timeline,
      computed_at_utc: raw.computed_at_utc,
    };
  }, [raw]);

  return { stats, loaded: raw !== undefined };
}
