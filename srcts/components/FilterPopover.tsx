import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { type ReactNode } from "react";

export interface FilterOption {
  value: string;
  label: ReactNode;
  /** Optional second-line hint shown in the popover (e.g. nickname). */
  hint?: string;
  /** Optional grouping key — items with the same group get a header. */
  group?: string;
}

interface FilterPopoverProps {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  /**
   * Optional content rendered at the very top of the popover (above the option
   * list). Use for quick-actions like "Pin my team".
   */
  topAction?: ReactNode;
  /** Optional text shown when nothing matches the search. */
  emptyText?: string;
  /** Width of the popover content panel. */
  contentClassName?: string;
}

/**
 * A trigger button + popover that holds a list of toggleable options. Used by
 * the Schedule tab to multi-select groups, stages, and teams.
 *
 * The trigger shows the label and a count when at least one option is on.
 * The popover groups options under headers when `option.group` is set.
 * Selection state is owned by the parent — this component just dispatches
 * toggle/clear callbacks.
 */
export function FilterPopover({
  label,
  options,
  selected,
  onToggle,
  onClear,
  topAction,
  emptyText = "Nothing here yet.",
  contentClassName,
}: FilterPopoverProps) {
  const count = selected.size;
  const hasSelection = count > 0;

  // Group preserving the input order: first occurrence of a group key
  // determines its position in the rendered list.
  const grouped: { group: string | null; items: FilterOption[] }[] = [];
  const idx = new Map<string | null, number>();
  for (const opt of options) {
    const key = opt.group ?? null;
    let i = idx.get(key);
    if (i === undefined) {
      i = grouped.length;
      idx.set(key, i);
      grouped.push({ group: key, items: [] });
    }
    grouped[i].items.push(opt);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5",
            "rounded-sm border-2 transition-colors",
            "font-display tracking-wider uppercase text-xs",
            hasSelection
              ? "border-crimson bg-crimson text-paper"
              : "border-paper-edge bg-paper text-ink hover:border-ink"
          )}
        >
          {label}
          {hasSelection && (
            <span className='inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-sm bg-paper text-crimson font-mono text-[10px]'>
              {count}
            </span>
          )}
          <ChevronDown className='h-3.5 w-3.5 opacity-70' />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0 bg-paper border-2 border-paper-edge max-h-[60vh] overflow-hidden flex flex-col",
          contentClassName
        )}
        align='start'
      >
        {topAction && (
          <div className='px-3 py-2 border-b border-paper-edge bg-paper-soft'>
            {topAction}
          </div>
        )}
        <div className='overflow-y-auto py-1'>
          {options.length === 0 ? (
            <p className='px-3 py-4 text-xs text-ink-soft text-center'>
              {emptyText}
            </p>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group ?? "__default__"}>
                {group && (
                  <div className='px-3 pt-2 pb-1 font-display tracking-widest uppercase text-[10px] text-ink-soft sticky top-0 bg-paper'>
                    {group}
                  </div>
                )}
                {items.map((opt) => {
                  const on = selected.has(opt.value);
                  return (
                    <button
                      type='button'
                      key={opt.value}
                      onClick={() => onToggle(opt.value)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-left",
                        "hover:bg-paper-soft transition-colors",
                        on && "bg-mustard/10"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center",
                          "h-4 w-4 rounded-sm border-2 shrink-0",
                          on
                            ? "border-crimson bg-crimson text-paper"
                            : "border-paper-edge bg-paper"
                        )}
                        aria-hidden
                      >
                        {on && <Check className='h-3 w-3' strokeWidth={3} />}
                      </span>
                      <span className='flex-1 min-w-0'>
                        <span className='block truncate font-display tracking-wide text-sm'>
                          {opt.label}
                        </span>
                        {opt.hint && (
                          <span className='block truncate text-[10px] text-ink-soft italic'>
                            {opt.hint}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        {hasSelection && (
          <div className='border-t border-paper-edge bg-paper-soft px-3 py-2 flex items-center justify-between'>
            <span className='font-mono text-[10px] text-ink-soft'>
              {count} selected
            </span>
            <button
              type='button'
              onClick={onClear}
              className='font-display tracking-widest uppercase text-[10px] text-crimson underline'
            >
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
