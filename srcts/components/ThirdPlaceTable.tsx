import { TeamFlag } from "@/components/TeamFlag";
import { Card, CardContent } from "@/components/ui/card";
import type { ThirdPlaceRow } from "@/lib/standings";
import { THIRD_PLACE_ADVANCING_SLOTS } from "@/lib/standings";
import { cn } from "@/lib/utils";

interface ThirdPlaceTableProps {
  rows: ThirdPlaceRow[];
  /** Total group count — used to render the "X of N groups visible" hint. */
  totalGroups: number;
}

export function ThirdPlaceTable({ rows, totalGroups }: ThirdPlaceTableProps) {
  if (rows.length === 0) return null;

  const hiddenGroups = totalGroups - rows.length;
  const anyMatchesPlayed = rows.some((r) => r.any_matches_played);

  return (
    <Card className='border-paper-edge bg-paper overflow-hidden'>
      <div className='h-1 w-full grid grid-cols-3'>
        <div className='bg-crimson' />
        <div className='bg-mustard' />
        <div className='bg-pitch' />
      </div>
      <CardContent className='p-0'>
        <div className='flex items-baseline justify-between gap-2 px-4 pt-3 pb-2 border-b border-paper-edge/60 flex-wrap'>
          <div className='flex items-baseline gap-2'>
            <span className='font-display text-lg sm:text-xl tracking-widest text-mustard'>
              3rd
            </span>
            <span className='font-display text-xs tracking-widest uppercase text-ink-soft'>
              place race · top {THIRD_PLACE_ADVANCING_SLOTS} advance
            </span>
          </div>
          {hiddenGroups > 0 && (
            <span
              className='font-mono text-[10px] uppercase tracking-wider text-ink-soft'
              title='Groups with unwatched matches are hidden so the cross-group ordering does not spoil them.'
            >
              {hiddenGroups} group{hiddenGroups === 1 ? "" : "s"} hidden
            </span>
          )}
        </div>

        {!anyMatchesPlayed ? (
          <div className='px-4 py-6 text-center text-xs text-ink-soft'>
            Fills in once group matches start.
          </div>
        ) : (
          <div className='px-2 pt-1 pb-2 overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-[10px] uppercase tracking-widest text-ink-soft'>
                  <th className='text-left font-medium pl-2 pr-2 py-1 w-9'>#</th>
                  <th className='text-left font-medium py-1 w-10'>Grp</th>
                  <th className='text-left font-medium py-1'>Team</th>
                  <th className='font-medium px-1 py-1 text-right'>P</th>
                  <th className='font-medium px-1 py-1 text-right hidden sm:table-cell'>
                    W
                  </th>
                  <th className='font-medium px-1 py-1 text-right hidden sm:table-cell'>
                    D
                  </th>
                  <th className='font-medium px-1 py-1 text-right hidden sm:table-cell'>
                    L
                  </th>
                  <th className='font-medium px-1 py-1 text-right'>GD</th>
                  <th className='font-medium px-2 py-1 text-right'>Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const rank = idx + 1;
                  const advancing = rank <= THIRD_PLACE_ADVANCING_SLOTS;
                  const bandClass = advancing ? "bg-pitch" : "bg-crimson/70";
                  const bandLabel = advancing
                    ? "Advancing (top 8)"
                    : "Out — below the line";
                  // Draw the cut-off line right under slot #8 so the eye
                  // catches the boundary between qualifiers and the rest.
                  const isCutoff = rank === THIRD_PLACE_ADVANCING_SLOTS;
                  return (
                    <tr
                      key={row.team_id}
                      className={cn(
                        "border-t border-paper-edge/40 hover:bg-paper-soft transition-colors",
                        isCutoff && "border-b-2 border-b-ink/40"
                      )}
                    >
                      <td className='pl-2 pr-2 py-2'>
                        <div className='flex items-center gap-1.5'>
                          <span
                            className={cn(
                              "w-1 h-5 rounded-sm shrink-0",
                              bandClass
                            )}
                            aria-label={bandLabel}
                            title={bandLabel}
                          />
                          <span className='font-mono text-xs text-ink-soft'>
                            {rank}
                          </span>
                        </div>
                      </td>
                      <td className='py-2'>
                        <span className='font-display text-base tracking-widest text-mustard'>
                          {row.group_label}
                        </span>
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
                        {row.played}
                      </td>
                      <td className='font-mono text-xs text-right px-1 hidden sm:table-cell'>
                        {row.won}
                      </td>
                      <td className='font-mono text-xs text-right px-1 hidden sm:table-cell'>
                        {row.drawn}
                      </td>
                      <td className='font-mono text-xs text-right px-1 hidden sm:table-cell'>
                        {row.lost}
                      </td>
                      <td
                        className={cn(
                          "font-mono text-xs text-right px-1",
                          row.goal_diff > 0 && "text-pitch",
                          row.goal_diff < 0 && "text-crimson"
                        )}
                      >
                        {row.goal_diff > 0 ? "+" : ""}
                        {row.goal_diff}
                      </td>
                      <td className='font-mono text-sm text-right px-2 font-bold'>
                        {row.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className='px-4 py-2 text-[10px] uppercase tracking-widest text-ink-soft border-t border-paper-edge/60 flex items-center gap-3 flex-wrap'>
          <span className='inline-flex items-center gap-1'>
            <span className='w-2 h-3 rounded-sm bg-pitch' /> Top 8 — qualify
            directly
          </span>
          <span className='inline-flex items-center gap-1'>
            <span className='w-2 h-3 rounded-sm bg-crimson/70' /> Below the
            line — out
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
