import { useUserTz } from "@/contexts/Timezone";
import { useNow } from "@/hooks/useNow";
import { countdown, formatLocalDate, formatLocalTime, isPast } from "@/lib/time";

interface KickoffBadgeProps {
  kickoffUtc: string;
}

export function KickoffBadge({ kickoffUtc }: KickoffBadgeProps) {
  const tz = useUserTz();
  const now = useNow(1000);
  const past = isPast(kickoffUtc, now);
  return (
    <div className='flex flex-col items-end text-right shrink-0'>
      <span className='font-display text-base tracking-wide leading-tight'>
        {formatLocalDate(kickoffUtc, tz)}
      </span>
      <span className='font-mono text-[11px] text-ink-soft'>
        {formatLocalTime(kickoffUtc, tz)}
      </span>
      {!past && (
        <span className='font-mono text-[10px] text-crimson mt-0.5'>
          {countdown(kickoffUtc, now)}
        </span>
      )}
    </div>
  );
}
