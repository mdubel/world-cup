import {
  useShinyInput,
  useShinyMessageHandler,
  useShinyOutput,
} from "@posit/shiny-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ServerResultMessage,
  SetTrackerPayload,
  TrackerMap,
  TrackerState,
} from "../lib/types";

export interface TrackerApi {
  /**
   * Tracker map blended with optimistic pending writes. Consumers should
   * use this — it reflects the user's latest click immediately, before the
   * server round-trips. Reconciled back to the server's value once the
   * write lands.
   */
  tracker: TrackerMap;
  /**
   * Pass `null` to clear the entry (un-toggle back to no state).
   */
  setTracker: (matchId: string, state: TrackerState | null) => void;
  /**
   * Match IDs whose write is in flight. Components use this to render a
   * small spinner on the affected control.
   */
  pendingMatches: Set<string>;
  /**
   * False until the server has delivered the first `tracker` payload for
   * this session. Used to gate the action bar so a quick-clicking user
   * can't blow away their existing state before it has arrived.
   */
  loaded: boolean;
}

export function useTracker(): TrackerApi {
  const [tracker] = useShinyOutput<TrackerMap | undefined>("tracker", undefined);

  // Per-match intent that hasn't been confirmed by the server yet.
  //   value !== null   → optimistically apply this state
  //   value === null   → optimistically clear the entry
  const [pending, setPending] = useState<Record<string, TrackerState | null>>(
    {}
  );

  const [, sendPayload] = useShinyInput<SetTrackerPayload | null>(
    "set_tracker",
    null,
    { debounceMs: 0, priority: "event" }
  );

  // Reconcile: when the real tracker map matches a pending entry, drop it.
  useEffect(() => {
    setPending((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      let changed = false;
      const next: Record<string, TrackerState | null> = {};
      for (const key of keys) {
        const intended = prev[key];
        const actual = tracker?.[key];
        const reconciled =
          intended === null ? actual === undefined : actual === intended;
        if (reconciled) {
          changed = true;
        } else {
          next[key] = intended;
        }
      }
      return changed ? next : prev;
    });
  }, [tracker]);

  // Belt-and-braces: if the server tells us a write failed, drop the
  // pending entry so the spinner doesn't spin forever.
  useShinyMessageHandler<ServerResultMessage & { match_id?: string }>(
    "trackerResult",
    (msg) => {
      if (msg.ok) return;
      const mid = msg.match_id;
      if (!mid) return;
      setPending((prev) => {
        if (!(mid in prev)) return prev;
        const next = { ...prev };
        delete next[mid];
        return next;
      });
    }
  );

  const setTracker = useCallback(
    (matchId: string, state: TrackerState | null) => {
      setPending((prev) => ({ ...prev, [matchId]: state }));
      sendPayload({ match_id: matchId, state });
    },
    [sendPayload]
  );

  const effectiveTracker: TrackerMap = useMemo(() => {
    const out: TrackerMap = { ...(tracker ?? {}) };
    for (const [matchId, pendingState] of Object.entries(pending)) {
      if (pendingState === null) {
        delete out[matchId];
      } else {
        out[matchId] = pendingState;
      }
    }
    return out;
  }, [tracker, pending]);

  const pendingMatches = useMemo(
    () => new Set(Object.keys(pending)),
    [pending]
  );

  return {
    tracker: effectiveTracker,
    setTracker,
    pendingMatches,
    loaded: tracker !== undefined,
  };
}
