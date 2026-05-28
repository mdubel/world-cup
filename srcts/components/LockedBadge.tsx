interface LockedBadgeProps {
  reason: "kickoff" | "bracket" | "tournament";
}

const LABELS: Record<LockedBadgeProps["reason"], string> = {
  kickoff: "Locked at kickoff",
  bracket: "Awaiting bracket",
  tournament: "Tournament started",
};

export function LockedBadge({ reason }: LockedBadgeProps) {
  return (
    <span className='stage-chip text-ink-soft border-ink-soft/40'>
      {LABELS[reason]}
    </span>
  );
}
