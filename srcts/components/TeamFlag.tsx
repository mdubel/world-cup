import { cn } from "@/lib/utils";

interface TeamFlagProps {
  crest?: string | null;
  code?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  framed?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<TeamFlagProps["size"]>, string> = {
  xs: "h-5 w-5 text-[8px]",
  sm: "h-7 w-7 text-[9px]",
  md: "h-10 w-10 text-[11px]",
  lg: "h-16 w-16 text-sm",
  xl: "h-24 w-24 text-base",
};

/**
 * Renders a team's crest (from football-data.org) at a sized box. When the
 * crest URL is missing — common for knockout-bracket TBD slots — falls back to
 * the 3-letter code or a question mark inside a stamped-paper looking placeholder.
 */
export function TeamFlag({
  crest,
  code,
  name,
  size = "md",
  className,
  framed = true,
}: TeamFlagProps) {
  const sizeClass = SIZE_CLASSES[size];
  const label = code ?? "?";
  const altText = name ?? code ?? "Team";

  return (
    <div
      title={name ?? code ?? undefined}
      className={cn(
        "shrink-0 inline-flex items-center justify-center overflow-hidden",
        framed && "ring-2 ring-ink/15 bg-paper-soft rounded-sm shadow-sm",
        sizeClass,
        className
      )}
    >
      {crest ? (
        <img
          src={crest}
          alt={altText}
          className='h-full w-full object-contain p-[10%]'
          loading='lazy'
          draggable={false}
        />
      ) : (
        <span className='font-display tracking-wider text-ink-soft'>
          {label}
        </span>
      )}
    </div>
  );
}
