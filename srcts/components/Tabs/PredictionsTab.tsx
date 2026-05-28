import { EmptyState } from "@/components/EmptyState";
import { MatchCard } from "@/components/MatchCard";
import { Card, CardContent } from "@/components/ui/card";
import { useAppData } from "@/contexts/AppData";
import { useNow } from "@/hooks/useNow";
import { isPast } from "@/lib/time";
import { useMemo } from "react";

export function PredictionsTab() {
  const {
    fixtures: { matches, loaded },
    tracker,
    predictions,
    setPrediction,
  } = useAppData();
  const now = useNow(60_000);

  const open = useMemo(
    () => matches.filter((m) => !isPast(m.kickoff_utc, now)),
    [matches, now]
  );

  if (!loaded) {
    return <EmptyState title='Loading fixtures…' />;
  }
  if (open.length === 0) {
    return (
      <EmptyState
        title='No matches open for predictions'
        description='All current fixtures have kicked off. Check the leaderboard tab.'
      />
    );
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
      {open.map((m) => (
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
    </div>
  );
}
