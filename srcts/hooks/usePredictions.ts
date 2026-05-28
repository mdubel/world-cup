import { useShinyInput, useShinyOutput } from "@posit/shiny-react";
import { useCallback } from "react";
import type {
  Pick as MatchPick,
  PredictionsMap,
  SetPredictionPayload,
  Side,
} from "../lib/types";

export function usePredictions(): {
  predictions: PredictionsMap;
  setPrediction: (
    matchId: string,
    pick: MatchPick,
    advancingTeam: Side | null
  ) => void;
} {
  const [predictions] = useShinyOutput<PredictionsMap | undefined>(
    "predictions",
    undefined
  );
  const [, sendPayload] = useShinyInput<SetPredictionPayload | null>(
    "set_prediction",
    null,
    { debounceMs: 0, priority: "event" }
  );
  const setPrediction = useCallback(
    (matchId: string, pick: MatchPick, advancingTeam: Side | null) => {
      sendPayload({ match_id: matchId, pick, advancing_team: advancingTeam });
    },
    [sendPayload]
  );
  return { predictions: predictions ?? {}, setPrediction };
}
