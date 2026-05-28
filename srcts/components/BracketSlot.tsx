import { TeamFlag } from "@/components/TeamFlag";
import { useUserTz } from "@/contexts/Timezone";
import { useNow } from "@/hooks/useNow";
import { actualAdvancingSide, teamsKnown } from "@/lib/fixtures";
import { shouldHideScore } from "@/lib/spoiler";
import { formatLocalDate, formatLocalTime, isPast } from "@/lib/time";
import type { Match, Prediction, TrackerState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BracketSlotProps {
  match: Match;
  prediction?: Prediction;
  trackerState?: TrackerState;
  /**
   * When true, also mask team identities (render TBD) in addition to the
   * normal score-hiding from `trackerState`. Used for slots whose teams come
   * from a WATCH_LATER feeder match — knowing the home/away team would
   * reveal the feeder's outcome.
   */
  forceMask?: boolean;
  showPicksVsReality: boolean;
  onClick: () => void;
}

interface SideRowProps {
  side: "HOME" | "AWAY";
  match: Match;
  isWinner: boolean;
  isLoser: boolean;
  hidden: boolean;
  maskTeam: boolean;
}

function SideRow({ side, match, isWinner, isLoser, hidden, maskTeam }: SideRowProps) {
  const isHome = side === "HOME";
  const code = isHome ? match.home_team_code : match.away_team_code;
  const name = isHome ? match.home_team_name : match.away_team_name;
  const crest = isHome ? match.home_team_crest : match.away_team_crest;
  const goals = isHome ? match.home_score_ft : match.away_score_ft;
  const teamKnown = Boolean(isHome ? match.home_team_id : match.away_team_id);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-1.5 py-1 min-w-0",
        // Suppress winner/loser styling when hidden — even subtle dimming is a
        // spoiler ("the dimmed team lost").
        !hidden && isLoser && "opacity-50",
        !hidden && isWinner && "font-semibold"
      )}
    >
      {maskTeam ? (
        <span className='shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-sm bg-paper-soft border border-paper-edge font-display text-[9px] text-ink-soft'>
          ?
        </span>
      ) : (
        <TeamFlag crest={crest} code={code} name={name} size='xs' />
      )}
      <span
        className={cn(
          "font-display tracking-wider truncate text-sm",
          (!teamKnown || maskTeam) && "text-ink-soft"
        )}
      >
        {maskTeam ? "TBD" : (code ?? (teamKnown ? name : "TBD"))}
      </span>
      {!hidden && goals !== null && (
        <span className='ml-auto font-mono text-sm tabular-nums'>{goals}</span>
      )}
      {hidden && (
        <span className='ml-auto font-mono text-xs text-mustard'>•</span>
      )}
    </div>
  );
}

export function BracketSlot({
  match,
  prediction,
  trackerState,
  forceMask = false,
  showPicksVsReality,
  onClick,
}: BracketSlotProps) {
  const tz = useUserTz();
  const now = useNow(60_000);
  // forceMask hides scores AND team names; trackerState only hides scores.
  const hidden = forceMask || shouldHideScore(match, trackerState);
  const maskTeam = forceMask;
  const finished = match.status === "FINISHED";
  const live = match.status === "IN_PLAY" || match.status === "PAUSED";
  const past = isPast(match.kickoff_utc, now);
  const teamsAreKnown = teamsKnown(match);
  const advancing = actualAdvancingSide(match);

  // "Picks vs reality" — only color slots when the result isn't being hidden
  // for spoiler protection. A green/red ring on a hidden match would defeat
  // the purpose.
  let pickedCorrectly: boolean | null = null;
  if (!hidden && showPicksVsReality && finished && prediction && match.winner) {
    pickedCorrectly = prediction.pick === match.winner;
  }

  const wentToPK =
    match.home_score_pk !== null && match.away_score_pk !== null;

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        "block w-full text-left",
        "border-2 rounded-sm bg-paper transition-colors",
        "hover:border-ink shadow-[0_2px_0_var(--paper-edge)]",
        // Default border + state borders
        "border-paper-edge",
        live && "border-crimson ring-2 ring-crimson/20",
        pickedCorrectly === true && "border-mustard ring-2 ring-mustard/30",
        pickedCorrectly === false && "border-crimson ring-2 ring-crimson/30"
      )}
    >
      <div className='divide-y divide-paper-edge/40'>
        <SideRow
          side='HOME'
          match={match}
          hidden={hidden}
          maskTeam={maskTeam}
          isWinner={
            finished &&
            (match.winner === "HOME" || advancing === "HOME")
          }
          isLoser={
            finished &&
            ((match.winner === "AWAY" && advancing !== "HOME") ||
              advancing === "AWAY")
          }
        />
        <SideRow
          side='AWAY'
          match={match}
          hidden={hidden}
          maskTeam={maskTeam}
          isWinner={
            finished &&
            (match.winner === "AWAY" || advancing === "AWAY")
          }
          isLoser={
            finished &&
            ((match.winner === "HOME" && advancing !== "AWAY") ||
              advancing === "HOME")
          }
        />
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-1 px-1.5 py-0.5",
          "text-[9px] uppercase tracking-wider",
          "border-t border-paper-edge/40",
          hidden
            ? "text-mustard font-bold"
            : live
              ? "text-crimson font-bold"
              : "text-ink-soft"
        )}
      >
        {hidden ? (
          // Treat as if the match isn't decided yet from the user's POV.
          // No FT/AET/PEN labels (each is itself a spoiler).
          <span>Watch later</span>
        ) : live ? (
          <span>● Live</span>
        ) : finished ? (
          <span>
            {wentToPK
              ? `PEN ${match.home_score_pk}–${match.away_score_pk}`
              : match.home_score_et !== null
                ? "AET"
                : "FT"}
          </span>
        ) : !teamsAreKnown ? (
          <span>TBD</span>
        ) : past ? (
          <span>Locked</span>
        ) : (
          <span className='font-mono normal-case tracking-normal'>
            {formatLocalDate(match.kickoff_utc, tz)} ·{" "}
            {formatLocalTime(match.kickoff_utc, tz)}
          </span>
        )}

        {prediction && (
          <span
            className={cn(
              "font-mono normal-case tracking-normal text-[9px]",
              pickedCorrectly === true && "text-mustard",
              pickedCorrectly === false && "text-crimson"
            )}
          >
            pick: {prediction.pick}
          </span>
        )}
      </div>
    </button>
  );
}
