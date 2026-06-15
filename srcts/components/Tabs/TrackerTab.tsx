import { EmptyState } from "@/components/EmptyState";
import { MatchCard } from "@/components/MatchCard";
import {
  EMPTY_FILTERS,
  ScheduleFilters,
  filtersAreEmpty,
  matchPassesFilters,
  type ScheduleFilterState,
} from "@/components/ScheduleFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppData } from "@/contexts/AppData";
import { useNow } from "@/hooks/useNow";
import { isPast } from "@/lib/time";
import type { Match } from "@/lib/types";
import { useMemo, useState } from "react";

type StatusFilter = "all" | "upcoming" | "watch_later" | "completed";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "watch_later", label: "Watch later" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

export function TrackerTab() {
  const {
    fixtures: { matches, loaded },
    tracker,
    setTracker,
    predictions,
    setPrediction,
    favoriteTeam,
  } = useAppData();
  const now = useNow(60_000);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");
  const [filters, setFilters] =
    useState<ScheduleFilterState>(EMPTY_FILTERS);

  const filtered: Match[] = useMemo(() => {
    return matches.filter((m) => {
      const past = isPast(m.kickoff_utc, now);
      const state = tracker[m.match_id];
      // A match is "live" when it has kicked off but isn't finished yet.
      // The server status (IN_PLAY / PAUSED) is the primary signal; the
      // `past && !FINISHED` clause is a fallback for the ~1 min window
      // before the refresh job updates status from TIMED to IN_PLAY.
      const live =
        m.status === "IN_PLAY" ||
        m.status === "PAUSED" ||
        (past && m.status !== "FINISHED");
      let passesStatus: boolean;
      switch (statusFilter) {
        case "upcoming":
          // Live games belong here too — they're the user's most relevant
          // matches when opening the app, and the kickoff_utc sort puts
          // them at the top naturally (their kickoffs are earlier than
          // the truly-upcoming ones). Picks stay locked via the per-card
          // `past` check; this is purely about visibility.
          passesStatus = live || (!past && m.status !== "FINISHED");
          break;
        case "watch_later":
          passesStatus = state === "WATCH_LATER";
          break;
        case "completed":
          passesStatus = m.status === "FINISHED";
          break;
        case "all":
        default:
          passesStatus = true;
      }
      if (!passesStatus) return false;
      return matchPassesFilters(m, filters);
    });
  }, [matches, tracker, statusFilter, filters, now]);

  if (!loaded) {
    return <EmptyState title='Loading fixtures…' />;
  }
  if (matches.length === 0) {
    return (
      <EmptyState
        title='No fixtures yet'
        description="The schedule hasn't been loaded. Check back after the next refresh."
      />
    );
  }

  const counts = {
    watch_later: Object.values(tracker).filter((s) => s === "WATCH_LATER")
      .length,
    watched: Object.values(tracker).filter((s) => s === "WATCHED").length,
    skipped: Object.values(tracker).filter((s) => s === "SKIP").length,
  };

  const hasExtraFilters = !filtersAreEmpty(filters);

  return (
    <div className='space-y-4'>
      <p className='text-xs text-ink-soft'>
        Track matches and submit picks from the same card — picks save
        instantly and are editable until kickoff. Group stage 3/1/0,
        knockout 3/1/0 plus a 1-pt bonus when your named advancing team
        actually advances.
      </p>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='flex gap-1 flex-wrap'>
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.id}
              size='sm'
              variant={statusFilter === f.id ? "default" : "outline"}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className='ml-auto flex gap-2 text-xs text-muted-foreground'>
          <Badge variant='secondary'>watch later: {counts.watch_later}</Badge>
          <Badge variant='secondary'>watched: {counts.watched}</Badge>
          <Badge variant='secondary'>skipped: {counts.skipped}</Badge>
        </div>
      </div>

      <Separator />

      <ScheduleFilters
        matches={matches}
        filters={filters}
        onChange={setFilters}
        favoriteTeam={favoriteTeam}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title='Nothing here'
          description={
            hasExtraFilters
              ? "No matches fit those filters — try removing one or two."
              : "Try a different status filter."
          }
        />
      ) : (
        <>
          <p className='text-[10px] uppercase tracking-widest text-ink-soft font-display'>
            {filtered.length}
            {filtered.length === matches.length ? "" : ` of ${matches.length}`}{" "}
            {filtered.length === 1 ? "match" : "matches"}
          </p>
          <div className='space-y-3'>
            {filtered.map((m) => (
              <MatchCard
                key={m.match_id}
                match={m}
                tracker={tracker}
                showTrackerControls
                onTrackerChange={(state) => setTracker(m.match_id, state)}
                showPredictionControls
                prediction={predictions[m.match_id]}
                onPredictionSubmit={(pick, advancing) =>
                  setPrediction(m.match_id, pick, advancing)
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
