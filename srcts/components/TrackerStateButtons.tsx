import { cn } from "@/lib/utils";
import type { TrackerState } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface TrackerStateButtonsProps {
  current: TrackerState | undefined;
  onChange: (state: TrackerState | null) => void;
  /**
   * When true, an in-flight write exists for this match. Renders a small
   * spinner on the currently-active button and disables clicks until the
   * server round-trips.
   */
  pending?: boolean;
  /**
   * Force all buttons disabled (no spinner). Used while the user-specific
   * tracker payload is still loading — clicking before it lands would
   * blindly overwrite existing state with the user's snap judgement.
   */
  disabled?: boolean;
}

interface StateOption {
  state: TrackerState;
  label: string;
  activeClass: string;
}

const OPTIONS: StateOption[] = [
  {
    state: "WATCH_LATER",
    label: "Watch later",
    activeClass: "bg-mustard text-ink border-mustard",
  },
  {
    state: "WATCHED",
    label: "Watched",
    activeClass: "bg-pitch text-paper border-pitch",
  },
  {
    state: "SKIP",
    label: "Skip",
    activeClass: "bg-ink text-paper border-ink",
  },
];

export function TrackerStateButtons({
  current,
  onChange,
  pending = false,
  disabled = false,
}: TrackerStateButtonsProps) {
  return (
    <div className='flex flex-wrap gap-2'>
      {OPTIONS.map((opt) => {
        const active = current === opt.state;
        const showSpinner = pending && active;
        const isDisabled = pending || disabled;
        return (
          <button
            key={opt.state}
            type='button'
            disabled={isDisabled}
            onClick={() => onChange(active ? null : opt.state)}
            title={
              disabled
                ? "Loading your tracker state…"
                : active
                  ? "Click again to clear this match's state"
                  : `Mark as "${opt.label}"`
            }
            aria-pressed={active}
            className={cn(
              "font-display tracking-wider text-xs uppercase",
              "inline-flex items-center gap-1.5",
              "px-3 py-1.5 rounded-sm border-2 transition-colors",
              pending && "disabled:cursor-progress",
              disabled && !pending && "disabled:cursor-wait disabled:opacity-50",
              active
                ? opt.activeClass
                : "border-paper-edge text-ink-soft hover:bg-paper-soft"
            )}
          >
            {showSpinner && (
              <Loader2 className='h-3 w-3 animate-spin' aria-hidden />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
