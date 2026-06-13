import { Card, CardContent } from "@/components/ui/card";
import { useAppData } from "@/contexts/AppData";
import { useNow } from "@/hooks/useNow";
import {
  actualAdvancingSide,
  isKnockoutStage,
  stageLabel,
  teamsKnown,
} from "@/lib/fixtures";
import { isPast } from "@/lib/time";
import type {
  Match,
  Pick as MatchPick,
  Prediction,
  Side,
  TrackerMap,
  TrackerState,
} from "@/lib/types";
import { shouldHideScore } from "@/lib/spoiler";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { KickoffBadge } from "./KickoffBadge";
import { LockedBadge } from "./LockedBadge";
import { MatchScore } from "./MatchScore";
import { PredictionPicker } from "./PredictionPicker";
import { TeamFlag } from "./TeamFlag";
import { TrackerStateButtons } from "./TrackerStateButtons";

type FavoriteOutcome = "win" | "loss" | "draw" | null;

/**
 * Was the user's favorite team in this finished match, and how did it go?
 * Returns null when the match wasn't a favorite-team game, the match isn't
 * finished yet, or the favorite isn't set.
 */
function favoriteOutcomeFor(
  match: Match,
  favoriteTeamId: string | null
): FavoriteOutcome {
  if (!favoriteTeamId) return null;
  const isHomeFavorite = match.home_team_id === favoriteTeamId;
  const isAwayFavorite = match.away_team_id === favoriteTeamId;
  if (!isHomeFavorite && !isAwayFavorite) return null;
  if (match.status !== "FINISHED") return null;

  if (isKnockoutStage(match.stage)) {
    // Knockout matches are decided — we care about advancement, not the
    // regulation outcome. A draw on the scoreboard always meant penalties,
    // so the "advancing" side is the real winner.
    const advancing = actualAdvancingSide(match);
    if (!advancing) return "draw";
    if (advancing === "HOME") return isHomeFavorite ? "win" : "loss";
    return isAwayFavorite ? "win" : "loss";
  }

  // Group stage: a real draw stays a draw.
  if (match.winner === "DRAW" || match.winner === null) return "draw";
  if (match.winner === "HOME") return isHomeFavorite ? "win" : "loss";
  return isAwayFavorite ? "win" : "loss";
}

const OUTCOME_STYLES: Record<
  Exclude<FavoriteOutcome, null>,
  { ring: string; text: string; label: string; emoji: string }
> = {
  win: {
    ring: "border-pitch bg-pitch/10",
    text: "text-pitch",
    label: "Your team won",
    emoji: "🎉",
  },
  draw: {
    ring: "border-mustard bg-mustard/10",
    text: "text-mustard",
    label: "Honors even",
    emoji: "🤝",
  },
  loss: {
    ring: "border-crimson bg-crimson/10",
    text: "text-crimson",
    label: "Tough one",
    emoji: "💔",
  },
};

interface MatchCardProps {
  match: Match;
  tracker: TrackerMap;
  showTrackerControls?: boolean;
  showPredictionControls?: boolean;
  prediction?: Prediction;
  /** Pass `null` to clear the current state back to unset. */
  onTrackerChange?: (state: TrackerState | null) => void;
  onPredictionSubmit?: (pick: MatchPick, advancingTeam: Side | null) => void;
}

function TeamRow({
  side,
  match,
}: {
  side: "HOME" | "AWAY";
  match: Match;
}) {
  const isHome = side === "HOME";
  const name = isHome ? match.home_team_name : match.away_team_name;
  const code = isHome ? match.home_team_code : match.away_team_code;
  const crest = isHome ? match.home_team_crest : match.away_team_crest;
  const lostInRegulation =
    match.status === "FINISHED" &&
    ((isHome && match.winner === "AWAY") ||
      (!isHome && match.winner === "HOME"));

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3 min-w-0",
        lostInRegulation && "opacity-60"
      )}
    >
      <TeamFlag
        crest={crest}
        code={code}
        name={name}
        size='lg'
        className='!h-10 !w-10 sm:!h-16 sm:!w-16'
      />
      <div className='min-w-0 flex-1'>
        <div className='font-display text-base sm:text-2xl tracking-wide leading-none truncate'>
          {name ?? "TBD"}
        </div>
        {code && (
          <div className='text-[11px] font-mono text-ink-soft mt-1 truncate'>
            {code}
          </div>
        )}
      </div>
    </div>
  );
}

export function MatchCard({
  match,
  tracker,
  showTrackerControls = false,
  showPredictionControls = false,
  prediction,
  onTrackerChange,
  onPredictionSubmit,
}: MatchCardProps) {
  const now = useNow(60_000);
  const { favoriteTeamId, pendingTrackerMatches, userDataLoaded } =
    useAppData();
  const trackerState = tracker[match.match_id];
  const trackerPending = pendingTrackerMatches.has(match.match_id);
  const hidden = shouldHideScore(match, trackerState);
  const past = isPast(match.kickoff_utc, now);
  const teamsAreKnown = teamsKnown(match);
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";

  const favoriteIsHome =
    favoriteTeamId !== null && match.home_team_id === favoriteTeamId;
  const favoriteIsAway =
    favoriteTeamId !== null && match.away_team_id === favoriteTeamId;
  const favoriteInMatch = favoriteIsHome || favoriteIsAway;

  // Outcome reaction only when the match is FINISHED and not spoiler-hidden.
  const favoriteOutcome: FavoriteOutcome =
    favoriteInMatch && !hidden ? favoriteOutcomeFor(match, favoriteTeamId) : null;
  const outcomeStyle =
    favoriteOutcome !== null ? OUTCOME_STYLES[favoriteOutcome] : null;
  const favoriteSideName = favoriteIsHome
    ? match.home_team_name
    : match.away_team_name;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-paper-edge",
        "bg-paper shadow-[0_2px_0_var(--paper-edge)]",
        "transition-transform duration-200 hover:-translate-y-0.5",
        isLive && "ring-2 ring-crimson",
        favoriteInMatch && "ring-2 ring-mustard/60"
      )}
    >
      {/*
        Subtle gold shimmer when the user's supported team is playing in this
        match. Reuses the same animation that powers the podium #1 step so the
        cue feels consistent. Sits behind the content; pointer-events:none so
        it doesn't interfere with clicks.
      */}
      {favoriteInMatch && (
        <div className='absolute inset-0 wc26-gold-shimmer pointer-events-none' />
      )}
      {/* Decorative corner band */}
      <div className='absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-crimson via-mustard to-pitch opacity-70' />

      <CardContent className='py-3 px-3 sm:py-4 sm:px-5 space-y-3 sm:space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-center gap-2 flex-wrap'>
            <span className='stage-chip text-crimson'>
              {stageLabel(match.stage)}
            </span>
            {match.group && (
              <span className='stage-chip text-ink'>
                {match.group.replace("GROUP_", "Group ")}
              </span>
            )}
            {past && match.status !== "FINISHED" && !isLive && (
              <LockedBadge reason='kickoff' />
            )}
            {isLive && (
              <span className='stage-chip text-crimson bg-crimson/10 animate-pulse'>
                ● Live
              </span>
            )}
            {favoriteInMatch && (
              <span
                className='stage-chip text-mustard bg-mustard/10'
                title={`Your team — ${favoriteSideName ?? ""}`}
              >
                <Heart className='h-3 w-3 fill-mustard' /> Your team
              </span>
            )}
          </div>
          <KickoffBadge kickoffUtc={match.kickoff_utc} />
        </div>

        {/* minmax(0,1fr) instead of 1fr lets the side columns shrink below
            their content's intrinsic min-width on narrow screens — otherwise
            the team name + code text forces the column wider than the
            container and the middle score column overlaps it. */}
        <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4'>
          <TeamRow side='HOME' match={match} />
          <MatchScore match={match} hidden={hidden} />
          <div className='flex justify-end min-w-0'>
            <div className='flex flex-row-reverse items-center gap-2 sm:gap-3 min-w-0 w-full'>
              <TeamFlag
                crest={match.away_team_crest}
                code={match.away_team_code}
                name={match.away_team_name}
                size='lg'
                className='!h-10 !w-10 sm:!h-16 sm:!w-16'
              />
              <div
                className={cn(
                  "min-w-0 flex-1 text-right",
                  match.status === "FINISHED" &&
                    match.winner === "HOME" &&
                    "opacity-60"
                )}
              >
                <div className='font-display text-base sm:text-2xl tracking-wide leading-none truncate'>
                  {match.away_team_name ?? "TBD"}
                </div>
                {match.away_team_code && (
                  <div className='text-[11px] font-mono text-ink-soft mt-1 truncate'>
                    {match.away_team_code}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {(showTrackerControls || showPredictionControls || hidden) && (
          <div className='pt-3 border-t border-paper-edge/60 space-y-2'>
            {/* Unified action bar: tracker buttons on the left, pick
                buttons on the right of the same row. On narrow screens
                the row wraps naturally. */}
            <div className='flex flex-wrap items-center gap-3'>
              {showTrackerControls && onTrackerChange && (
                <TrackerStateButtons
                  current={trackerState}
                  onChange={onTrackerChange}
                  pending={trackerPending}
                  disabled={!userDataLoaded}
                />
              )}
              {showPredictionControls &&
                onPredictionSubmit &&
                teamsAreKnown && (
                  <div className='sm:ml-auto'>
                    <PredictionPicker
                      match={match}
                      prediction={prediction}
                      // Disable until we know the user's existing picks —
                      // otherwise a click during the load races the
                      // incoming server payload and could overwrite an
                      // existing prediction the user already made.
                      disabled={past || !userDataLoaded}
                      onSubmit={onPredictionSubmit}
                      compact
                    />
                  </div>
                )}
            </div>

            {showPredictionControls &&
              onPredictionSubmit &&
              !teamsAreKnown && (
                <div className='flex items-center gap-2'>
                  <LockedBadge reason='bracket' />
                  <span className='text-xs text-ink-soft'>
                    Waiting for previous round.
                  </span>
                </div>
              )}

            {hidden && showTrackerControls && onTrackerChange && (
              <div className='flex gap-3 items-center flex-wrap'>
                <button
                  type='button'
                  className='text-xs underline text-crimson font-medium'
                  onClick={() => onTrackerChange("WATCHED")}
                >
                  I watched it — show me
                </button>
                <button
                  type='button'
                  className='text-xs underline text-ink-soft'
                  onClick={() => onTrackerChange("SKIP")}
                >
                  Skip — show me
                </button>
              </div>
            )}
          </div>
        )}

        {outcomeStyle && (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 -mx-1 rounded-sm border-2",
              outcomeStyle.ring
            )}
          >
            <span className='text-lg leading-none' aria-hidden>
              {outcomeStyle.emoji}
            </span>
            <span
              className={cn(
                "font-display tracking-widest uppercase text-xs",
                outcomeStyle.text
              )}
            >
              {outcomeStyle.label}
            </span>
            {favoriteSideName && (
              <span className='ml-auto font-display tracking-wide text-sm text-ink'>
                {favoriteSideName}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
