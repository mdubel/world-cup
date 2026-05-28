import { cn } from "@/lib/utils";
import type { TrackerState } from "@/lib/types";

interface TrackerStateButtonsProps {
  current: TrackerState | undefined;
  onChange: (state: TrackerState) => void;
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
}: TrackerStateButtonsProps) {
  return (
    <div className='flex flex-wrap gap-2'>
      {OPTIONS.map((opt) => {
        const active = current === opt.state;
        return (
          <button
            key={opt.state}
            type='button'
            onClick={() => onChange(opt.state)}
            className={cn(
              "font-display tracking-wider text-xs uppercase",
              "px-3 py-1.5 rounded-sm border-2 transition-colors",
              active
                ? opt.activeClass
                : "border-paper-edge text-ink-soft hover:bg-paper-soft"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
