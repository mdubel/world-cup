import { useShinyInput } from "@posit/shiny-react";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import {
  useFixtures,
  type FixturesView,
} from "@/hooks/useFixtures";
import { useTracker } from "@/hooks/useTracker";
import { usePredictions } from "@/hooks/usePredictions";
import { useTournamentPick } from "@/hooks/useTournamentPick";
import { useLeaderboard, type LeaderboardView } from "@/hooks/useLeaderboard";
import type {
  CurrentUser,
  Pick as MatchPick,
  PredictionsMap,
  Side,
  Team,
  TournamentPick,
  TrackerMap,
  TrackerState,
} from "@/lib/types";

// Hoist every Shiny output hook to a single instance at App level so that
// switching tabs does NOT unmount/remount the hooks. Without this, every tab
// switch briefly sees `payload === undefined` from useShinyOutput on its
// first render after remount, which flips `loaded` back to false and shows
// "Loading fixtures…" for a frame. Pulling the hooks up here keeps them
// alive for the lifetime of the session.

interface AppData {
  fixtures: FixturesView;
  tracker: TrackerMap;
  setTracker: (matchId: string, state: TrackerState | null) => void;
  /** Match IDs with an in-flight tracker write — used to render spinners. */
  pendingTrackerMatches: Set<string>;
  predictions: PredictionsMap;
  setPrediction: (
    matchId: string,
    pick: MatchPick,
    advancingTeam: Side | null
  ) => void;
  tournamentPick: TournamentPick | null;
  setTournamentPick: (teamId: string) => void;
  leaderboard: LeaderboardView;
  /** User's chosen favorite/supported team (separate from the champion pick). */
  favoriteTeam: Team | null;
  favoriteTeamId: string | null;
  /** Pass null/"" to clear. */
  setFavoriteTeam: (teamId: string | null) => void;
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({
  user,
  children,
}: {
  user: CurrentUser | undefined;
  children: ReactNode;
}) {
  const fixtures = useFixtures();
  const {
    tracker,
    setTracker,
    pendingMatches: pendingTrackerMatches,
  } = useTracker();
  const { predictions, setPrediction } = usePredictions();
  const { pick: tournamentPick, setPick: setTournamentPick } =
    useTournamentPick();
  const leaderboard = useLeaderboard();

  // Hoist the favorite-team setter into this provider so every consumer
  // (settings dialog, match cards) shares one Shiny input instance.
  const [, sendFavorite] = useShinyInput<string | null>(
    "set_user_favorite_team",
    null,
    { debounceMs: 0, priority: "event" }
  );
  const setFavoriteTeam = useCallback(
    (id: string | null) => sendFavorite(id ?? ""),
    [sendFavorite]
  );

  const favoriteTeamId = user?.favorite_team_id ?? null;
  const favoriteTeam = useMemo<Team | null>(() => {
    if (!favoriteTeamId) return null;
    return fixtures.teams.find((t) => t.team_id === favoriteTeamId) ?? null;
  }, [favoriteTeamId, fixtures.teams]);

  return (
    <Ctx.Provider
      value={{
        fixtures,
        tracker,
        setTracker,
        pendingTrackerMatches,
        predictions,
        setPrediction,
        tournamentPick,
        setTournamentPick,
        leaderboard,
        favoriteTeam,
        favoriteTeamId,
        setFavoriteTeam,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useAppData() called outside <AppDataProvider>");
  }
  return v;
}
