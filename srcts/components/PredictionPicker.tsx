import { TeamFlag } from "@/components/TeamFlag";
import { isKnockoutStage } from "@/lib/fixtures";
import type { Match, Pick as MatchPick, Prediction, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PredictionPickerProps {
  match: Match;
  prediction: Prediction | undefined;
  disabled: boolean;
  onSubmit: (pick: MatchPick, advancingTeam: Side | null) => void;
  /**
   * `compact` shrinks the picker into a HOME/DRAW/AWAY label row that fits
   * alongside the tracker buttons inside a MatchCard's action bar. The
   * non-compact form (default) renders team flags + names inside the
   * buttons — used by BracketDialog where there's more room and the user
   * benefits from seeing who's playing without scrolling back up.
   */
  compact?: boolean;
}

interface PickButtonProps {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  variant: "team" | "draw";
  compact?: boolean;
  children: React.ReactNode;
}

function PickButton({
  active,
  disabled,
  onClick,
  variant,
  compact,
  children,
}: PickButtonProps) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-w-0 rounded-sm border-2 transition-all",
        "font-display tracking-wider uppercase",
        "disabled:cursor-not-allowed disabled:opacity-50",
        compact
          ? "px-2.5 py-1.5 text-xs"
          : "flex-1 px-3 py-2.5 text-sm",
        active
          ? variant === "team"
            ? "border-crimson bg-crimson text-paper shadow-[0_2px_0_var(--ink)]"
            : "border-mustard bg-mustard text-ink shadow-[0_2px_0_var(--ink)]"
          : "border-paper-edge bg-paper text-ink hover:border-ink hover:bg-paper-soft"
      )}
    >
      {children}
    </button>
  );
}

export function PredictionPicker({
  match,
  prediction,
  disabled,
  onSubmit,
  compact = false,
}: PredictionPickerProps) {
  const isKnockout = isKnockoutStage(match.stage);
  const homeName = match.home_team_name ?? "Home";
  const awayName = match.away_team_name ?? "Away";

  const currentPick = prediction?.pick;
  const currentAdvancing = prediction?.advancing_team ?? null;

  const handlePickClick = (pick: MatchPick) => {
    if (disabled) return;
    if (!isKnockout) {
      onSubmit(pick, null);
      return;
    }
    if (pick === "HOME") onSubmit("HOME", "HOME");
    else if (pick === "AWAY") onSubmit("AWAY", "AWAY");
    else {
      // Preserve an existing advancing pick when re-clicking DRAW, but
      // do NOT auto-default to HOME when the user picks DRAW for the
      // first time — that used to highlight one side automatically and
      // the user could miss that it was already submitted on their
      // behalf. With null, the advancing sub-row appears with neither
      // side selected; the user has to explicitly click one to claim
      // the +1 bonus.
      onSubmit("DRAW", currentAdvancing ?? null);
    }
  };

  const handleAdvancingClick = (side: Side) => {
    if (disabled) return;
    onSubmit("DRAW", side);
  };

  const showAdvancingPicker = isKnockout && currentPick === "DRAW";

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      <div className='flex flex-wrap gap-1.5 sm:gap-2'>
        <PickButton
          variant='team'
          active={currentPick === "HOME"}
          disabled={disabled}
          compact={compact}
          onClick={() => handlePickClick("HOME")}
        >
          {compact ? (
            // Use the 3-letter team code (already shown under the name at
            // the top of the card) so the button labels are unambiguous —
            // "Home" / "Away" forced users to re-read which side was
            // which. Codes are fixed-width so the layout stays stable
            // regardless of team name length. Falls back to "Home" only
            // when the code is missing (TBD bracket slots).
            <span aria-label={`Pick ${homeName}`}>
              {match.home_team_code ?? "Home"}
            </span>
          ) : (
            <span className='inline-flex items-center gap-2'>
              <TeamFlag
                crest={match.home_team_crest}
                code={match.home_team_code}
                name={homeName}
                size='sm'
                framed={false}
              />
              <span className='truncate'>{homeName}</span>
            </span>
          )}
        </PickButton>
        <PickButton
          variant='draw'
          active={currentPick === "DRAW"}
          disabled={disabled}
          compact={compact}
          onClick={() => handlePickClick("DRAW")}
        >
          {compact
            ? isKnockout
              ? "Draw → PKs"
              : "Draw"
            : isKnockout
              ? "Draw → PKs"
              : "Draw"}
        </PickButton>
        <PickButton
          variant='team'
          active={currentPick === "AWAY"}
          disabled={disabled}
          compact={compact}
          onClick={() => handlePickClick("AWAY")}
        >
          {compact ? (
            <span aria-label={`Pick ${awayName}`}>
              {match.away_team_code ?? "Away"}
            </span>
          ) : (
            <span className='inline-flex items-center gap-2'>
              <TeamFlag
                crest={match.away_team_crest}
                code={match.away_team_code}
                name={awayName}
                size='sm'
                framed={false}
              />
              <span className='truncate'>{awayName}</span>
            </span>
          )}
        </PickButton>
      </div>
      {showAdvancingPicker && (
        <div className='flex flex-col gap-2 pl-1'>
          <span
            className={cn(
              "font-display text-xs tracking-widest uppercase",
              currentAdvancing === null
                ? "text-crimson"
                : "text-ink-soft"
            )}
          >
            {currentAdvancing === null
              ? "Pick one — who advances on penalties?"
              : "Who advances on penalties?"}
          </span>
          <div className='flex gap-2'>
            <button
              type='button'
              disabled={disabled}
              onClick={() => handleAdvancingClick("HOME")}
              aria-label={`Advances on PKs: ${homeName}`}
              className={cn(
                "px-3 py-1.5 rounded-sm border-2 text-xs font-display tracking-wider uppercase",
                currentAdvancing === "HOME"
                  ? "border-pitch bg-pitch text-paper"
                  : "border-paper-edge text-ink-soft hover:bg-paper-soft"
              )}
            >
              {compact ? (match.home_team_code ?? homeName) : homeName}
            </button>
            <button
              type='button'
              disabled={disabled}
              onClick={() => handleAdvancingClick("AWAY")}
              aria-label={`Advances on PKs: ${awayName}`}
              className={cn(
                "px-3 py-1.5 rounded-sm border-2 text-xs font-display tracking-wider uppercase",
                currentAdvancing === "AWAY"
                  ? "border-pitch bg-pitch text-paper"
                  : "border-paper-edge text-ink-soft hover:bg-paper-soft"
              )}
            >
              {compact ? (match.away_team_code ?? awayName) : awayName}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
