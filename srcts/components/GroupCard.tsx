import { TeamFlag } from "@/components/TeamFlag";
import { Card, CardContent } from "@/components/ui/card";
import { useUserTz } from "@/contexts/Timezone";
import { shouldHideScore } from "@/lib/spoiler";
import {
  computeGroupStandings,
  groupShortLabel,
  qualificationState,
  type QualificationState,
} from "@/lib/standings";
import { formatLocalDate, formatLocalTime } from "@/lib/time";
import type { Match, TrackerMap } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

interface GroupCardProps {
  group: string;
  matches: Match[];
  tracker?: TrackerMap;
  /**
   * When true, hide the numerical standings (replace with `••`). Used by the
   * GroupsTab when the user has any WATCH_LATER match in this group AND the
   * spoiler banner hasn't been revealed.
   */
  masked?: boolean;
}

function maskedNumber(masked: boolean, value: number): string {
  return masked ? "••" : String(value);
}

const QUAL_BAND: Record<QualificationState, string> = {
  advancing: "bg-pitch",
  playoff: "bg-mustard",
  eliminated: "bg-crimson/70",
  neutral: "bg-paper-edge",
};

const QUAL_LABEL: Record<QualificationState, string> = {
  advancing: "Through",
  playoff: "3rd — top 8 advance",
  eliminated: "Out",
  neutral: "—",
};

export function GroupCard({
  group,
  matches,
  tracker,
  masked = false,
}: GroupCardProps) {
  const tz = useUserTz();
  const [expanded, setExpanded] = useState(false);

  const standings = useMemo(
    () => computeGroupStandings(matches),
    [matches]
  );
  const anyMatchesPlayed = standings.some((r) => r.played > 0);

  return (
    <Card className='border-paper-edge bg-paper overflow-hidden'>
      {/* Tri-color accent strip */}
      <div className='h-1 w-full grid grid-cols-3'>
        <div className='bg-crimson' />
        <div className='bg-mustard' />
        <div className='bg-pitch' />
      </div>
      <CardContent className='p-0'>
        <div className='flex items-center justify-between px-4 pt-3 pb-2 border-b border-paper-edge/60'>
          <div className='flex items-baseline gap-2'>
            <span className='font-display text-3xl tracking-widest text-mustard'>
              {groupShortLabel(group)}
            </span>
            <span className='font-display text-xs tracking-widest uppercase text-ink-soft'>
              Group
            </span>
          </div>
          {anyMatchesPlayed && (
            <span className='font-mono text-[10px] uppercase tracking-wider text-ink-soft'>
              {masked
                ? "•• of •• played"
                : `${standings.reduce((s, r) => s + r.played, 0) / 2} of ${matches.length} played`}
            </span>
          )}
        </div>

        <div className='px-2 pt-1 pb-2'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-[10px] uppercase tracking-widest text-ink-soft'>
                <th className='text-left font-medium pl-2 pr-2 py-1 w-9'>#</th>
                <th className='text-left font-medium py-1'>Team</th>
                <th className='font-medium px-1 py-1 text-right'>P</th>
                <th className='font-medium px-1 py-1 text-right'>W</th>
                <th className='font-medium px-1 py-1 text-right'>D</th>
                <th className='font-medium px-1 py-1 text-right'>L</th>
                <th className='font-medium px-1 py-1 text-right'>GD</th>
                <th className='font-medium px-2 py-1 text-right'>Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, idx) => {
                const rank = idx + 1;
                const qual = qualificationState(rank, anyMatchesPlayed);
                // When masked, render the qualification band as neutral so it
                // doesn't reveal who's through / out.
                const bandClass = masked ? QUAL_BAND.neutral : QUAL_BAND[qual];
                const bandLabel = masked ? "Hidden" : QUAL_LABEL[qual];
                return (
                  <tr
                    key={row.team_id}
                    className='border-t border-paper-edge/40 hover:bg-paper-soft transition-colors'
                  >
                    <td className='pl-2 pr-2 py-2'>
                      <div className='flex items-center gap-1.5'>
                        <span
                          className={cn("w-1 h-5 rounded-sm shrink-0", bandClass)}
                          aria-label={bandLabel}
                          title={bandLabel}
                        />
                        <span className='font-mono text-xs text-ink-soft'>
                          {rank}
                        </span>
                      </div>
                    </td>
                    <td className='py-2'>
                      <div className='flex items-center gap-2 min-w-0'>
                        <TeamFlag
                          crest={row.team_crest}
                          code={row.team_code}
                          name={row.team_name}
                          size='xs'
                        />
                        <span className='font-display text-base tracking-wide truncate'>
                          {row.team_name}
                        </span>
                      </div>
                    </td>
                    <td className='font-mono text-xs text-right px-1'>
                      {maskedNumber(masked, row.played)}
                    </td>
                    <td className='font-mono text-xs text-right px-1'>
                      {maskedNumber(masked, row.won)}
                    </td>
                    <td className='font-mono text-xs text-right px-1'>
                      {maskedNumber(masked, row.drawn)}
                    </td>
                    <td className='font-mono text-xs text-right px-1'>
                      {maskedNumber(masked, row.lost)}
                    </td>
                    <td
                      className={cn(
                        "font-mono text-xs text-right px-1",
                        !masked && row.goal_diff > 0 && "text-pitch",
                        !masked && row.goal_diff < 0 && "text-crimson"
                      )}
                    >
                      {masked
                        ? "••"
                        : `${row.goal_diff > 0 ? "+" : ""}${row.goal_diff}`}
                    </td>
                    <td className='font-mono text-sm text-right px-2 font-bold'>
                      {maskedNumber(masked, row.points)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type='button'
          onClick={() => setExpanded((e) => !e)}
          className='w-full px-4 py-2 text-[10px] uppercase tracking-widest font-display text-ink-soft hover:bg-paper-soft border-t border-paper-edge/60 flex items-center justify-center gap-1'
        >
          {expanded ? "Hide matches" : "Show matches"}
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>

        {expanded && (
          <div className='border-t border-paper-edge/60 bg-paper-soft px-3 py-2 space-y-1.5'>
            {matches.map((m) => {
              const finished = m.status === "FINISHED";
              const hidden = masked || shouldHideScore(m, tracker?.[m.match_id]);
              const homeGoals = m.home_score_ft;
              const awayGoals = m.away_score_ft;
              return (
                <div
                  key={m.match_id}
                  className='flex items-center gap-2 text-xs py-1'
                >
                  <span className='font-mono text-[10px] text-ink-soft w-20 shrink-0'>
                    {formatLocalDate(m.kickoff_utc, tz)}
                  </span>
                  <span className='font-mono text-[10px] text-ink-soft w-10 shrink-0'>
                    {formatLocalTime(m.kickoff_utc, tz)}
                  </span>
                  <div className='flex items-center gap-1.5 flex-1 min-w-0 justify-end text-right'>
                    <span
                      className={cn(
                        "font-display text-sm tracking-wide truncate",
                        !hidden && finished && m.winner === "AWAY" && "opacity-50"
                      )}
                    >
                      {m.home_team_code ?? m.home_team_name ?? "TBD"}
                    </span>
                    <TeamFlag
                      crest={m.home_team_crest}
                      code={m.home_team_code}
                      name={m.home_team_name}
                      size='xs'
                    />
                  </div>
                  <span
                    className={cn(
                      "font-mono text-sm w-14 text-center shrink-0",
                      hidden && "text-mustard"
                    )}
                  >
                    {hidden
                      ? "? – ?"
                      : finished && homeGoals !== null && awayGoals !== null
                        ? `${homeGoals} – ${awayGoals}`
                        : "vs"}
                  </span>
                  <div className='flex items-center gap-1.5 flex-1 min-w-0'>
                    <TeamFlag
                      crest={m.away_team_crest}
                      code={m.away_team_code}
                      name={m.away_team_name}
                      size='xs'
                    />
                    <span
                      className={cn(
                        "font-display text-sm tracking-wide truncate",
                        !hidden && finished && m.winner === "HOME" && "opacity-50"
                      )}
                    >
                      {m.away_team_code ?? m.away_team_name ?? "TBD"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
