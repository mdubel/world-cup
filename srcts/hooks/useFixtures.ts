import { useShinyOutput } from "@posit/shiny-react";
import { useMemo } from "react";
import {
  columnarToRows,
  rowsToMatches,
  rowsToTeams,
  sortByKickoff,
} from "../lib/fixtures";
import type { FixturesPayload, Match, Team } from "../lib/types";

export interface FixturesView {
  matches: Match[];
  teams: Team[];
  tournamentLockUtc: string | null;
  serverNowUtc: string | null;
  loaded: boolean;
}

export function useFixtures(): FixturesView {
  const [payload] = useShinyOutput<FixturesPayload | undefined>(
    "fixtures",
    undefined
  );

  return useMemo<FixturesView>(() => {
    if (!payload) {
      return {
        matches: [],
        teams: [],
        tournamentLockUtc: null,
        serverNowUtc: null,
        loaded: false,
      };
    }
    const rows = columnarToRows<Record<string, unknown>>(payload.rows);
    const teamRows = columnarToRows<Record<string, unknown>>(payload.teams);
    const matches = sortByKickoff(rowsToMatches(rows));
    const teams = rowsToTeams(teamRows);
    return {
      matches,
      teams,
      tournamentLockUtc: payload.tournament_lock_utc ?? null,
      serverNowUtc: payload.server_now_utc ?? null,
      loaded: true,
    };
  }, [payload]);
}
