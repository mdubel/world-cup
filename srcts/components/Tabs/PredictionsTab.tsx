import { EmptyState } from "@/components/EmptyState";
import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppData } from "@/contexts/AppData";
import { useNow } from "@/hooks/useNow";
import { isPast } from "@/lib/time";
import { useMemo, useState } from "react";

type PicksFilter = "upcoming" | "done" | "all";

const PICKS_FILTERS: { id: PicksFilter; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

export function PredictionsTab() {
  const {
    fixtures: { matches, loaded },
    tracker,
    predictions,
    setPrediction,
  } = useAppData();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<PicksFilter>("upcoming");

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      const past = isPast(m.kickoff_utc, now);
      switch (filter) {
        case "upcoming":
          return !past;
        case "done":
          return past;
        case "all":
        default:
          return true;
      }
    });
  }, [matches, now, filter]);

  if (!loaded) {
    return <EmptyState title='Loading fixtures…' />;
  }

  return (
    <div className='space-y-3'>
      <Card>
        <CardContent className='py-3 px-4 text-sm text-muted-foreground'>
          Picks save instantly and are editable until kickoff. Group stage is
          3/1/0. Knockout is 3/1/0 plus a 1-pt bonus if your named advancing
          team actually advances.
        </CardContent>
      </Card>

      <div className='flex gap-1 flex-wrap'>
        {PICKS_FILTERS.map((f) => (
          <Button
            key={f.id}
            size='sm'
            variant={filter === f.id ? "default" : "outline"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            filter === "upcoming"
              ? "No matches open for predictions"
              : filter === "done"
                ? "No matches have kicked off yet"
                : "No matches"
          }
          description={
            filter === "upcoming"
              ? "All current fixtures have kicked off. Switch to Done or All to review your picks."
              : undefined
          }
        />
      ) : (
        <>
          <p className='text-[10px] uppercase tracking-widest text-ink-soft font-display'>
            {filtered.length}
            {filtered.length === matches.length ? "" : ` of ${matches.length}`}{" "}
            {filtered.length === 1 ? "match" : "matches"}
          </p>
          {filtered.map((m) => (
            <MatchCard
              key={m.match_id}
              match={m}
              tracker={tracker}
              showPredictionControls
              prediction={predictions[m.match_id]}
              onPredictionSubmit={(pick, advancing) =>
                setPrediction(m.match_id, pick, advancing)
              }
            />
          ))}
        </>
      )}
    </div>
  );
}
