import type { Match } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MatchScoreProps {
  match: Match;
  hidden: boolean;
}

export function MatchScore({ match, hidden }: MatchScoreProps) {
  if (hidden) {
    return (
      <div className='flex flex-col items-center text-center px-1 sm:px-2 min-w-0'>
        <div className='font-display text-2xl sm:text-3xl text-mustard tracking-widest'>
          ?? – ??
        </div>
        <span className='mt-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-ink-soft whitespace-nowrap'>
          hidden
        </span>
      </div>
    );
  }

  const inProgress = match.status === "IN_PLAY" || match.status === "PAUSED";
  const finished = match.status === "FINISHED";
  const hasFt = match.home_score_ft !== null && match.away_score_ft !== null;

  // Pre-match / scheduled — nothing to show but the matchup.
  if (!inProgress && !finished && !hasFt) {
    return (
      <div className='flex flex-col items-center text-center px-1 sm:px-2 min-w-0'>
        <div className='font-display text-2xl sm:text-3xl text-ink-soft tracking-widest'>
          vs
        </div>
      </div>
    );
  }

  // Finished by the API but the score hasn't been entered yet (football-data
  // sometimes flips status to FINISHED before the fullTime fields populate).
  // Show a placeholder instead of rendering a misleading "0 – 0".
  if (finished && !hasFt) {
    return (
      <div className='flex flex-col items-center text-center px-1 sm:px-2 min-w-0'>
        <div className='font-display text-2xl sm:text-3xl text-ink-soft tracking-widest'>
          — – —
        </div>
        <span className='mt-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-ink-soft whitespace-nowrap'>
          pending
        </span>
      </div>
    );
  }

  const home = match.home_score_ft ?? 0;
  const away = match.away_score_ft ?? 0;

  const wentToPK =
    match.home_score_pk !== null && match.away_score_pk !== null;
  const wentToET =
    !wentToPK &&
    match.home_score_et !== null &&
    match.away_score_et !== null;

  return (
    <div className='flex flex-col items-center text-center px-1 sm:px-2 min-w-0'>
      <div
        key={`${home}-${away}-${match.status}`}
        className={cn(
          "font-display text-3xl sm:text-5xl tracking-wider leading-none wc26-score-pop",
          inProgress ? "text-crimson" : "text-ink"
        )}
      >
        {home}
        <span className='text-ink-soft mx-1 sm:mx-1.5'>–</span>
        {away}
      </div>
      <div className='mt-1.5 flex gap-1 flex-wrap justify-center text-[9px] sm:text-[10px] uppercase tracking-wider whitespace-nowrap'>
        {finished && !wentToET && !wentToPK && (
          <span className='text-ink-soft'>FT</span>
        )}
        {wentToET && !wentToPK && (
          <span className='text-mustard font-semibold'>After ET</span>
        )}
        {wentToPK && (
          <span className='text-crimson font-semibold font-mono'>
            Pens {match.home_score_pk}–{match.away_score_pk}
          </span>
        )}
      </div>
    </div>
  );
}
