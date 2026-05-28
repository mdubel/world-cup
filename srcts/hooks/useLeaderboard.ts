import { useShinyInput, useShinyOutput } from "@posit/shiny-react";
import { useCallback, useMemo } from "react";
import { columnarToRows } from "../lib/fixtures";
import type {
  LeaderboardDetail,
  LeaderboardDetailRow,
  LeaderboardPayload,
  LeaderboardRow,
  Pick as MatchPick,
  Side,
} from "../lib/types";

export interface LeaderboardView {
  rows: LeaderboardRow[];
  computedAtUtc: string | null;
  loaded: boolean;
}

export function useLeaderboard(): LeaderboardView {
  const [payload] = useShinyOutput<LeaderboardPayload | undefined>(
    "leaderboard",
    undefined
  );

  return useMemo<LeaderboardView>(() => {
    if (!payload) {
      return { rows: [], computedAtUtc: null, loaded: false };
    }
    const rawRows = Array.isArray(payload.rows)
      ? (payload.rows as unknown as Record<string, unknown>[])
      : columnarToRows<Record<string, unknown>>(payload.rows);
    const rows: LeaderboardRow[] = rawRows.map((r) => {
      const champId =
        r.champion_pick_team_id == null || r.champion_pick_team_id === "NA"
          ? null
          : String(r.champion_pick_team_id);
      const champName =
        r.champion_pick_team_name == null ||
        r.champion_pick_team_name === "NA"
          ? null
          : String(r.champion_pick_team_name);
      return {
        user_id: String(r.user_id ?? ""),
        display_name: String(r.display_name ?? r.user_id ?? ""),
        total: Number(r.total ?? 0),
        group_pts: Number(r.group_pts ?? 0),
        knockout_pts: Number(r.knockout_pts ?? 0),
        tournament_pts: Number(r.tournament_pts ?? 0),
        exact_predictions: Number(r.exact_predictions ?? 0),
        champion_pick_team_id: champId,
        champion_pick_team_name: champName,
      };
    });
    return {
      rows,
      computedAtUtc: payload.computed_at_utc ?? null,
      loaded: true,
    };
  }, [payload]);
}

export interface LeaderboardDetailView {
  userId: string | null;
  rows: LeaderboardDetailRow[];
  groupPts: number;
  knockoutPts: number;
  tournamentPts: number;
  total: number;
  exactPredictions: number;
  tournamentPick: { team_id: string; team_name: string } | null;
}

export function useLeaderboardDetail(): {
  detail: LeaderboardDetailView;
  selectUser: (userId: string | null) => void;
} {
  const [detailPayload] = useShinyOutput<LeaderboardDetail | undefined>(
    "leaderboard_detail",
    undefined
  );
  const [, sendUserId] = useShinyInput<string | null>("detail_user_id", null, {
    debounceMs: 0,
    priority: "event",
  });

  const selectUser = useCallback(
    (userId: string | null) => {
      sendUserId(userId);
    },
    [sendUserId]
  );

  const detail = useMemo<LeaderboardDetailView>(() => {
    const empty: LeaderboardDetailView = {
      userId: null,
      rows: [],
      groupPts: 0,
      knockoutPts: 0,
      tournamentPts: 0,
      total: 0,
      exactPredictions: 0,
      tournamentPick: null,
    };
    if (!detailPayload) return empty;
    const rawRows = Array.isArray(detailPayload.per_match)
      ? (detailPayload.per_match as unknown as Record<string, unknown>[])
      : columnarToRows<Record<string, unknown>>(detailPayload.per_match);
    const rows: LeaderboardDetailRow[] = rawRows.map((r) => ({
      match_id: String(r.match_id ?? ""),
      stage: String(r.stage ?? ""),
      pick: String(r.pick ?? "") as MatchPick,
      advancing_team:
        r.advancing_team == null || r.advancing_team === "NA"
          ? null
          : (String(r.advancing_team) as Side),
      winner_actual:
        r.winner_actual == null || r.winner_actual === "NA"
          ? null
          : (String(r.winner_actual) as "HOME" | "AWAY" | "DRAW"),
      advancing_actual:
        r.advancing_actual == null || r.advancing_actual === "NA"
          ? null
          : (String(r.advancing_actual) as Side),
      points: Number(r.points ?? 0),
    }));
    return {
      userId: detailPayload.user_id ?? null,
      rows,
      groupPts: Number(detailPayload.group_pts ?? 0),
      knockoutPts: Number(detailPayload.knockout_pts ?? 0),
      tournamentPts: Number(detailPayload.tournament_pts ?? 0),
      total: Number(detailPayload.total ?? 0),
      exactPredictions: Number(detailPayload.exact_predictions ?? 0),
      tournamentPick: detailPayload.tournament_pick ?? null,
    };
  }, [detailPayload]);

  return { detail, selectUser };
}
