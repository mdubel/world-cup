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
   * `compact` shrinks the picker into a single-row label set that fits
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
  const homeCode = match.home_team_code ?? "Home";
  const awayCode = match.away_team_code ?? "Away";

  const currentPick = prediction?.pick;
  const currentAdvancing = prediction?.advancing_team ?? null;

  // Group stage: simple 3-button picker (no advancing concept).
  if (!isKnockout) {
    return (
      <div className='flex flex-wrap gap-1.5 sm:gap-2'>
        <PickButton
          variant='team'
          active={currentPick === "HOME"}
          disabled={disabled}
          compact={compact}
          onClick={() => onSubmit("HOME", null)}
        >
          {compact ? (
            <span aria-label={`Pick ${homeName}`}>{homeCode}</span>
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
          onClick={() => onSubmit("DRAW", null)}
        >
          Draw
        </PickButton>
        <PickButton
          variant='team'
          active={currentPick === "AWAY"}
          disabled={disabled}
          compact={compact}
          onClick={() => onSubmit("AWAY", null)}
        >
          {compact ? (
            <span aria-label={`Pick ${awayName}`}>{awayCode}</span>
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
    );
  }

  // Knockout stage: 4-option flat picker — no expanding sub-row.
  // The previous 3-button + advancing-sub-row design had a UX trap where
  // clicking DRAW for the first time either silently auto-saved with a
  // default advancing team (the user could miss it) or — after the no-
  // default fix — left the prediction in an invalid 'DRAW with no
  // advancing' state that the server rejected. Flattening to four atomic
  // single-click buttons removes both failure modes: each button submits
  // a fully-valid (pick, advancing_team) tuple, and the active highlight
  // tells the user exactly what's currently saved.
  const isHome = currentPick === "HOME";
  const isDrawHome = currentPick === "DRAW" && currentAdvancing === "HOME";
  const isDrawAway = currentPick === "DRAW" && currentAdvancing === "AWAY";
  const isAway = currentPick === "AWAY";

  return (
    <div className='flex flex-wrap gap-1.5 sm:gap-2'>
      <PickButton
        variant='team'
        active={isHome}
        disabled={disabled}
        compact={compact}
        onClick={() => onSubmit("HOME", "HOME")}
      >
        {compact ? (
          <span aria-label={`Pick ${homeName} to win`}>{homeCode}</span>
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
        active={isDrawHome}
        disabled={disabled}
        compact={compact}
        onClick={() => onSubmit("DRAW", "HOME")}
      >
        <span aria-label={`Draw — ${homeName} advances on penalties`}>
          Draw → {homeCode}
        </span>
      </PickButton>
      <PickButton
        variant='draw'
        active={isDrawAway}
        disabled={disabled}
        compact={compact}
        onClick={() => onSubmit("DRAW", "AWAY")}
      >
        <span aria-label={`Draw — ${awayName} advances on penalties`}>
          Draw → {awayCode}
        </span>
      </PickButton>
      <PickButton
        variant='team'
        active={isAway}
        disabled={disabled}
        compact={compact}
        onClick={() => onSubmit("AWAY", "AWAY")}
      >
        {compact ? (
          <span aria-label={`Pick ${awayName} to win`}>{awayCode}</span>
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
  );
}
