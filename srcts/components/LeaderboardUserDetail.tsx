import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stageLabel } from "@/lib/fixtures";
import type {
  LeaderboardDetailRow,
  Match,
  TrackerMap,
} from "@/lib/types";

interface LeaderboardUserDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  rows: LeaderboardDetailRow[];
  groupPts: number;
  knockoutPts: number;
  tournamentPts: number;
  total: number;
  tournamentPick: { team_id: string; team_name: string } | null;
  /**
   * If viewing your own detail, hide rows for matches the current user has
   * marked WATCH_LATER (so the detail view doesn't reveal scores). Pass null
   * when viewing someone else's detail.
   */
  selfTracker?: TrackerMap | null;
  matchById: Map<string, Match>;
}

export function LeaderboardUserDetail({
  open,
  onOpenChange,
  displayName,
  rows,
  groupPts,
  knockoutPts,
  tournamentPts,
  total,
  tournamentPick,
  selfTracker,
  matchById,
}: LeaderboardUserDetailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
          <DialogDescription>
            {total} pts · group {groupPts} · knockout {knockoutPts} · winner{" "}
            {tournamentPts}
          </DialogDescription>
        </DialogHeader>
        {tournamentPick && (
          <div className='text-sm'>
            Tournament winner pick:{" "}
            <Badge variant='secondary'>{tournamentPick.team_name}</Badge>
          </div>
        )}
        <div className='mt-2 max-h-[60vh] overflow-y-auto'>
          {rows.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No scored predictions yet.
            </p>
          ) : (
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left border-b text-xs text-muted-foreground'>
                  <th className='py-2 px-2'>Match</th>
                  <th className='py-2 px-2'>Stage</th>
                  <th className='py-2 px-2'>Pick</th>
                  <th className='py-2 px-2'>Result</th>
                  <th className='py-2 px-2 text-right'>Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const m = matchById.get(r.match_id);
                  const matchups = m
                    ? `${m.home_team_code ?? m.home_team_name ?? "?"} vs ${
                        m.away_team_code ?? m.away_team_name ?? "?"
                      }`
                    : r.match_id;
                  const hideForSelf =
                    selfTracker && selfTracker[r.match_id] === "WATCH_LATER";
                  return (
                    <tr key={r.match_id} className='border-b last:border-0'>
                      <td className='py-2 px-2'>{matchups}</td>
                      <td className='py-2 px-2 text-xs text-muted-foreground'>
                        {stageLabel(r.stage)}
                      </td>
                      <td className='py-2 px-2'>
                        {hideForSelf ? "—" : r.pick}
                        {!hideForSelf && r.advancing_team
                          ? ` (→ ${r.advancing_team})`
                          : ""}
                      </td>
                      <td className='py-2 px-2'>
                        {hideForSelf ? "[ HIDDEN ]" : r.winner_actual ?? "—"}
                        {!hideForSelf && r.advancing_actual
                          ? ` (→ ${r.advancing_actual})`
                          : ""}
                      </td>
                      <td className='py-2 px-2 text-right font-mono font-semibold'>
                        {hideForSelf ? "••" : r.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
