import { KickoffBadge } from "@/components/KickoffBadge";
import { LockedBadge } from "@/components/LockedBadge";
import { MatchScore } from "@/components/MatchScore";
import { PredictionPicker } from "@/components/PredictionPicker";
import { TeamFlag } from "@/components/TeamFlag";
import { TrackerStateButtons } from "@/components/TrackerStateButtons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppData } from "@/contexts/AppData";
import { useNow } from "@/hooks/useNow";
import { stageLabel, teamsKnown } from "@/lib/fixtures";
import { isPast } from "@/lib/time";
import { shouldHideScore } from "@/lib/spoiler";
import type { Match } from "@/lib/types";

interface BracketDialogProps {
  match: Match | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BracketDialog({
  match,
  open,
  onOpenChange,
}: BracketDialogProps) {
  const {
    tracker,
    setTracker,
    pendingTrackerMatches,
    predictions,
    setPrediction,
  } = useAppData();
  const now = useNow(60_000);

  if (!match) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const past = isPast(match.kickoff_utc, now);
  const teamsAreKnown = teamsKnown(match);
  const trackerState = tracker[match.match_id];
  const hidden = shouldHideScore(match, trackerState);
  const prediction = predictions[match.match_id];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-xl'>
        <DialogHeader>
          <DialogTitle className='font-display tracking-widest text-2xl text-crimson'>
            {stageLabel(match.stage)}
          </DialogTitle>
          <DialogDescription>
            <KickoffBadge kickoffUtc={match.kickoff_utc} />
          </DialogDescription>
        </DialogHeader>

        <div className='grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3'>
          <div className='flex items-center gap-3 min-w-0'>
            <TeamFlag
              crest={match.home_team_crest}
              code={match.home_team_code}
              name={match.home_team_name}
              size='lg'
            />
            <div className='min-w-0'>
              <div className='font-display text-xl tracking-wide truncate'>
                {match.home_team_name ?? "TBD"}
              </div>
              {match.home_team_code && (
                <div className='text-[11px] font-mono text-ink-soft'>
                  {match.home_team_code}
                </div>
              )}
            </div>
          </div>
          <MatchScore match={match} hidden={hidden} />
          <div className='flex flex-row-reverse items-center gap-3 min-w-0'>
            <TeamFlag
              crest={match.away_team_crest}
              code={match.away_team_code}
              name={match.away_team_name}
              size='lg'
            />
            <div className='min-w-0 text-right'>
              <div className='font-display text-xl tracking-wide truncate'>
                {match.away_team_name ?? "TBD"}
              </div>
              {match.away_team_code && (
                <div className='text-[11px] font-mono text-ink-soft'>
                  {match.away_team_code}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='space-y-3 pt-3 border-t border-paper-edge/60'>
          <div>
            <div className='font-display tracking-widest uppercase text-xs text-ink-soft mb-1.5'>
              Watch state
            </div>
            <TrackerStateButtons
              current={trackerState}
              onChange={(state) => setTracker(match.match_id, state)}
              pending={pendingTrackerMatches.has(match.match_id)}
            />
          </div>

          <div className='pt-3 border-t border-paper-edge/60'>
            <div className='font-display tracking-widest uppercase text-xs text-ink-soft mb-1.5'>
              Your prediction
            </div>
            {!teamsAreKnown ? (
              <div className='flex items-center gap-2'>
                <LockedBadge reason='bracket' />
                <span className='text-xs text-ink-soft'>
                  Both teams aren't known yet — feeder matches still to play.
                </span>
              </div>
            ) : (
              <PredictionPicker
                match={match}
                prediction={prediction}
                disabled={past}
                onSubmit={(pick, advancing) =>
                  setPrediction(match.match_id, pick, advancing)
                }
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
