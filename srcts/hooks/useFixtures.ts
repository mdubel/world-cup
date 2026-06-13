import { useShinyOutput } from "@posit/shiny-react";
import { useEffect, useMemo } from "react";
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

// Browsers cap each localStorage call at ~5MB but our fixtures payload is
// well under that (104 matches × ~20 columns of small primitives). Bumping
// the v suffix is the migration mechanism: if the payload schema changes
// in a backwards-incompatible way, increment it and stale clients fall
// through to the server-fetched render instead of erroring out.
const CACHE_KEY = "wc26:fixtures:v1";

interface CachedFixtures {
  payload: FixturesPayload;
  cached_at: number;
}

function readCache(): CachedFixtures | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFixtures;
    if (!parsed || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(payload: FixturesPayload) {
  if (typeof window === "undefined") return;
  try {
    const entry: CachedFixtures = { payload, cached_at: Date.now() };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Quota errors or private-mode lockouts are non-fatal — the live
    // server payload will arrive over the websocket regardless.
  }
}

export function useFixtures(): FixturesView {
  const [payload] = useShinyOutput<FixturesPayload | undefined>(
    "fixtures",
    undefined
  );

  // On the FIRST render — before Shiny's websocket has had a chance to
  // deliver the live payload — fall back to whatever we persisted on the
  // previous successful render. This eliminates the "Loading fixtures…"
  // flash for repeat visits; the cached view gets transparently replaced
  // once the server payload arrives (cached_at is older, but the data
  // changes only every 10 min so the visual diff is usually nothing).
  const cached = useMemo(() => (payload ? null : readCache()), [payload]);

  // Persist every fresh server payload so the NEXT cold load can paint
  // instantly from disk.
  useEffect(() => {
    if (payload) writeCache(payload);
  }, [payload]);

  return useMemo<FixturesView>(() => {
    const effective = payload ?? cached?.payload;
    if (!effective) {
      return {
        matches: [],
        teams: [],
        tournamentLockUtc: null,
        serverNowUtc: null,
        loaded: false,
      };
    }
    const rows = columnarToRows<Record<string, unknown>>(effective.rows);
    const teamRows = columnarToRows<Record<string, unknown>>(effective.teams);
    const matches = sortByKickoff(rowsToMatches(rows));
    const teams = rowsToTeams(teamRows);
    return {
      matches,
      teams,
      tournamentLockUtc: effective.tournament_lock_utc ?? null,
      // serverNowUtc from the cache is stale by definition; only trust
      // the live payload's value (the "in 1d 14h" countdowns key off it).
      serverNowUtc: payload?.server_now_utc ?? null,
      loaded: true,
    };
  }, [payload, cached]);
}
