import { TeamFlag } from "@/components/TeamFlag";
import { useAppData } from "@/contexts/AppData";
import { useUserTz } from "@/contexts/Timezone";
import { useNow } from "@/hooks/useNow";
import { stageLabel } from "@/lib/fixtures";
import { countdown, formatLocalDate, formatLocalTime } from "@/lib/time";
import type { Match } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const MAX_TILES = 8;

function MarqueeTile({ match, now, tz }: { match: Match; now: number; tz: string }) {
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const cd = countdown(match.kickoff_utc, now);

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-md border-2 border-paper-edge bg-paper-soft shrink-0",
        "min-w-[220px] sm:min-w-[280px]",
        isLive && "border-crimson bg-crimson/5"
      )}
    >
      <TeamFlag
        crest={match.home_team_crest}
        code={match.home_team_code}
        name={match.home_team_name}
        size='sm'
      />
      <div className='flex flex-col items-center text-[10px] uppercase tracking-wider text-ink-soft'>
        <span className='font-display text-base text-ink leading-none'>
          {match.home_team_code ?? "TBD"}
        </span>
        <span>vs</span>
        <span className='font-display text-base text-ink leading-none'>
          {match.away_team_code ?? "TBD"}
        </span>
      </div>
      <TeamFlag
        crest={match.away_team_crest}
        code={match.away_team_code}
        name={match.away_team_name}
        size='sm'
      />
      <div className='ml-auto flex flex-col items-end text-right'>
        <span className='font-display text-xs tracking-widest text-crimson'>
          {stageLabel(match.stage)}
        </span>
        <span className='font-mono text-[10px] text-ink-soft'>
          {formatLocalDate(match.kickoff_utc, tz)} ·{" "}
          {formatLocalTime(match.kickoff_utc, tz)}
        </span>
        {isLive ? (
          <span className='font-mono text-[10px] text-crimson font-bold'>
            ● Live now
          </span>
        ) : (
          <span className='font-mono text-[10px] text-mustard font-semibold'>
            {cd}
          </span>
        )}
      </div>
    </div>
  );
}

export function MatchMarquee() {
  const {
    fixtures: { matches, loaded },
  } = useAppData();
  const tz = useUserTz();
  const now = useNow(1000);

  const upcoming = useMemo(() => {
    return matches
      .filter((m) => {
        if (m.status === "FINISHED" || m.status === "CANCELLED") return false;
        const t = new Date(m.kickoff_utc).getTime();
        return !isNaN(t);
      })
      .sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc))
      .slice(0, MAX_TILES);
  }, [matches]);

  if (!loaded || upcoming.length === 0) return null;

  // Duplicate the tiles so the auto-scroll keyframe (translateX -50%) loops
  // seamlessly. Pauses on hover via the wc26-marquee-track CSS rule.
  return (
    <div className='border-t-2 border-b-2 border-ink/10 bg-paper-soft overflow-hidden'>
      <div className='flex items-center gap-3 py-2'>
        <span className='font-display text-xs tracking-widest text-ink-soft uppercase shrink-0 hidden sm:block pl-4'>
          Up next →
        </span>
        <div className='flex gap-3 wc26-marquee-track'>
          {upcoming.map((m) => (
            <MarqueeTile key={m.match_id} match={m} now={now} tz={tz} />
          ))}
          {/* Duplicate set for seamless loop */}
          {upcoming.map((m) => (
            <MarqueeTile
              key={`${m.match_id}-dup`}
              match={m}
              now={now}
              tz={tz}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
