import { useShinyInput, useShinyOutput } from "@posit/shiny-react";
import { useCallback, useMemo } from "react";
import type { AdminStats, AdminUserRow } from "../lib/types";

export interface AdminStatsView {
  stats: AdminStats | null;
  /** True while the server is recomputing the snapshot. */
  loading: boolean;
  /**
   * Pushes a manual-refresh event. Server bumps an invalidator and
   * recomputes; the output re-renders when done.
   */
  refresh: () => void;
}

/**
 * Normalises the wire format — Shiny's `render_json` flattens single-row
 * data frames into scalars and lists of one item into a single object, so
 * `stats.users` can arrive as either an array or a single object. This
 * unwrapper guarantees an array.
 */
function normaliseUsers(input: unknown): AdminUserRow[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as AdminUserRow[];
  return [input as AdminUserRow];
}

export function useAdminStats(): AdminStatsView {
  const [raw, recalculating] = useShinyOutput<AdminStats | undefined>(
    "admin_stats",
    undefined
  );
  const [, sendRefresh] = useShinyInput<object | null>(
    "admin_refresh",
    null,
    { debounceMs: 0, priority: "event" }
  );

  const refresh = useCallback(() => {
    sendRefresh({});
  }, [sendRefresh]);

  const stats = useMemo<AdminStats | null>(() => {
    if (!raw) return null;
    return {
      ...raw,
      users: normaliseUsers(raw.users),
    };
  }, [raw]);

  return { stats, loading: Boolean(recalculating), refresh };
}
