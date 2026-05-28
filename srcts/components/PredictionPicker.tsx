import { TeamFlag } from "@/components/TeamFlag";
import { isKnockoutStage } from "@/lib/fixtures";
import type { Match, Pick as MatchPick, Prediction, Side } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PredictionPickerProps {
  match: Match;
  prediction: Prediction | undefined;
  disabled: boolean;
  onSubmit: (pick: MatchPick, advancingTeam: Side | null) => void;
}

interface PickButtonProps {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  variant: "team" | "draw";
  children: React.ReactNode;
}

function PickButton({
  active,
  disabled,
  onClick,
  variant,
  children,
}: PickButtonProps) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex-1 min-w-0 px-3 py-2.5 rounded-sm border-2 transition-all",
        "font-display tracking-wider uppercase text-sm",
        "disabled:cursor-not-allowed disabled:opacity-50",
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
      const adv = currentAdvancing ?? "HOME";
      onSubmit("DRAW", adv);
    }
  };

  const handleAdvancingClick = (side: Side) => {
    if (disabled) return;
    onSubmit("DRAW", side);
  };

  const showAdvancingPicker = isKnockout && currentPick === "DRAW";

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap gap-2'>
        <PickButton
          variant='team'
          active={currentPick === "HOME"}
          disabled={disabled}
          onClick={() => handlePickClick("HOME")}
        >
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
        </PickButton>
        <PickButton
          variant='draw'
          active={currentPick === "DRAW"}
          disabled={disabled}
          onClick={() => handlePickClick("DRAW")}
        >
          {isKnockout ? "Draw → PKs" : "Draw"}
        </PickButton>
        <PickButton
          variant='team'
          active={currentPick === "AWAY"}
          disabled={disabled}
          onClick={() => handlePickClick("AWAY")}
        >
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
        </PickButton>
      </div>
      {showAdvancingPicker && (
        <div className='flex flex-col gap-2 pl-1'>
          <span className='font-display text-xs tracking-widest uppercase text-ink-soft'>
            Who advances on penalties?
          </span>
          <div className='flex gap-2'>
            <button
              type='button'
              disabled={disabled}
              onClick={() => handleAdvancingClick("HOME")}
              className={cn(
                "px-3 py-1.5 rounded-sm border-2 text-xs font-display tracking-wider uppercase",
                currentAdvancing === "HOME"
                  ? "border-pitch bg-pitch text-paper"
                  : "border-paper-edge text-ink-soft hover:bg-paper-soft"
              )}
            >
              {homeName}
            </button>
            <button
              type='button'
              disabled={disabled}
              onClick={() => handleAdvancingClick("AWAY")}
              className={cn(
                "px-3 py-1.5 rounded-sm border-2 text-xs font-display tracking-wider uppercase",
                currentAdvancing === "AWAY"
                  ? "border-pitch bg-pitch text-paper"
                  : "border-paper-edge text-ink-soft hover:bg-paper-soft"
              )}
            >
              {awayName}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
