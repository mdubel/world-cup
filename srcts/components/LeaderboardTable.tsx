import { TeamFlag } from "@/components/TeamFlag";
import { Card, CardContent } from "@/components/ui/card";
import type { LeaderboardRow, Team } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  /**
   * The rank that the FIRST row in `rows` corresponds to. Used for the "#"
   * column so a podium-stripped table can start at #4.
   */
  startRank?: number;
  currentUserId?: string;
  masked: boolean;
  teamsById: Map<string, Team>;
  onSelectUser: (userId: string) => void;
}

function maskedValue(masked: boolean, value: number): string {
  return masked ? "••" : String(value);
}

export function LeaderboardTable({
  rows,
  startRank = 1,
  currentUserId,
  masked,
  teamsById,
  onSelectUser,
}: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <Card className='border-paper-edge bg-paper'>
        <CardContent className='py-10 text-center'>
          <p className='text-sm text-ink-soft'>
            No more entries below the podium yet.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className='border-paper-edge bg-paper'>
      <CardContent className='p-0'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-paper-edge text-left text-[10px] uppercase tracking-widest text-ink-soft'>
                <th className='py-2 px-3 w-10'>#</th>
                <th className='py-2 px-3'>User</th>
                <th className='py-2 px-3'>Champion pick</th>
                <th className='py-2 px-2 text-right'>Group</th>
                <th className='py-2 px-2 text-right'>KO</th>
                <th className='py-2 px-2 text-right'>Winner</th>
                <th
                  className='py-2 px-2 text-right'
                  title='Exact predictions (max-points hits) — used as the tiebreaker'
                >
                  Exact
                </th>
                <th className='py-2 px-3 text-right'>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const rank = startRank + idx;
                const isMe = row.user_id === currentUserId;
                const team = row.champion_pick_team_id
                  ? teamsById.get(row.champion_pick_team_id) ?? null
                  : null;
                return (
                  <tr
                    key={row.user_id}
                    className={cn(
                      "border-b last:border-0 border-paper-edge/40 hover:bg-paper-soft transition-colors cursor-pointer",
                      isMe && "bg-mustard/10"
                    )}
                    onClick={() => onSelectUser(row.user_id)}
                  >
                    <td className='py-2 px-3 font-mono text-ink-soft'>
                      {rank}
                    </td>
                    <td className='py-2 px-3'>
                      <div className='flex items-center gap-2'>
                        <span className='font-display tracking-wide text-base'>
                          {row.display_name}
                        </span>
                        {isMe && (
                          <span className='font-display tracking-widest uppercase text-[9px] text-crimson'>
                            you
                          </span>
                        )}
                      </div>
                    </td>
                    <td className='py-2 px-3'>
                      {team ? (
                        <div className='flex items-center gap-2 min-w-0'>
                          <TeamFlag
                            crest={team.team_crest}
                            code={team.team_code}
                            name={team.team_name}
                            size='xs'
                          />
                          <span className='font-display tracking-wide text-sm truncate'>
                            {team.team_name}
                          </span>
                        </div>
                      ) : row.champion_pick_team_name ? (
                        <span className='font-display tracking-wide text-sm text-ink-soft'>
                          {row.champion_pick_team_name}
                        </span>
                      ) : (
                        <span className='text-[10px] uppercase tracking-widest text-ink-soft'>
                          —
                        </span>
                      )}
                    </td>
                    <td className='py-2 px-2 text-right font-mono'>
                      {maskedValue(masked, row.group_pts)}
                    </td>
                    <td className='py-2 px-2 text-right font-mono'>
                      {maskedValue(masked, row.knockout_pts)}
                    </td>
                    <td className='py-2 px-2 text-right font-mono'>
                      {maskedValue(masked, row.tournament_pts)}
                    </td>
                    <td className='py-2 px-2 text-right font-mono'>
                      {maskedValue(masked, row.exact_predictions)}
                    </td>
                    <td className='py-2 px-3 text-right font-mono font-bold'>
                      {maskedValue(masked, row.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
