import type { Match, TrackerMap, TrackerState } from "./types";

export function shouldHideScore(
  match: Match,
  trackerState: TrackerState | undefined | null
): boolean {
  return trackerState === "WATCH_LATER";
}

export function hasAnyWatchLater(tracker: TrackerMap | undefined): boolean {
  if (!tracker) return false;
  for (const v of Object.values(tracker)) {
    if (v === "WATCH_LATER") return true;
  }
  return false;
}

export function watchLaterMatchIds(tracker: TrackerMap | undefined): Set<string> {
  const out = new Set<string>();
  if (!tracker) return out;
  for (const [k, v] of Object.entries(tracker)) {
    if (v === "WATCH_LATER") out.add(k);
  }
  return out;
}

export function shouldMaskLeaderboard(tracker: TrackerMap | undefined): boolean {
  return hasAnyWatchLater(tracker);
}
