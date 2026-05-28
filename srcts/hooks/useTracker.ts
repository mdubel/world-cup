import { useShinyInput, useShinyOutput } from "@posit/shiny-react";
import { useCallback } from "react";
import type { SetTrackerPayload, TrackerMap, TrackerState } from "../lib/types";

export function useTracker(): {
  tracker: TrackerMap;
  setTracker: (matchId: string, state: TrackerState) => void;
} {
  const [tracker] = useShinyOutput<TrackerMap | undefined>("tracker", undefined);
  const [, sendPayload] = useShinyInput<SetTrackerPayload | null>(
    "set_tracker",
    null,
    { debounceMs: 0, priority: "event" }
  );
  const setTracker = useCallback(
    (matchId: string, state: TrackerState) => {
      sendPayload({ match_id: matchId, state });
    },
    [sendPayload]
  );
  return { tracker: tracker ?? {}, setTracker };
}
