import { useShinyInput, useShinyOutput } from "@posit/shiny-react";
import { useCallback } from "react";
import type {
  SetTournamentPickPayload,
  TournamentPick,
} from "../lib/types";

export function useTournamentPick(): {
  pick: TournamentPick | null;
  setPick: (teamId: string) => void;
  /** False until the server has delivered the first payload this session. */
  loaded: boolean;
} {
  const [raw] = useShinyOutput<TournamentPick | undefined>(
    "tournament_pick",
    undefined
  );
  const [, sendPayload] = useShinyInput<SetTournamentPickPayload | null>(
    "set_tournament_pick",
    null,
    { debounceMs: 0, priority: "event" }
  );
  const setPick = useCallback(
    (teamId: string) => {
      sendPayload({ team_id: teamId });
    },
    [sendPayload]
  );
  const pick: TournamentPick | null = raw && raw.team_id ? raw : null;
  return { pick, setPick, loaded: raw !== undefined };
}
