import { ContinentGrid } from "@/components/ContinentGrid";
import { EmptyState } from "@/components/EmptyState";
import { FunFactStrip } from "@/components/FunFactStrip";
import { Card, CardContent } from "@/components/ui/card";
import { useAppData } from "@/contexts/AppData";
import { useUserTz } from "@/contexts/Timezone";
import { useNow } from "@/hooks/useNow";
import { metaForTeam } from "@/data/teams";
import { countdown, formatLocal, isPast } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Crown, Lock } from "lucide-react";
import { useMemo } from "react";

export function TournamentPickTab() {
  const {
    fixtures: { teams, tournamentLockUtc, loaded },
    tournamentPick: pick,
    setTournamentPick: setPick,
    userDataLoaded,
  } = useAppData();
  const tz = useUserTz();
  const now = useNow(1000);

  const locked = useMemo(
    () => (tournamentLockUtc ? isPast(tournamentLockUtc, now) : !loaded),
    [tournamentLockUtc, now, loaded]
  );

  const pickedTeam = useMemo(
    () => teams.find((t) => t.team_id === pick?.team_id) ?? null,
    [teams, pick]
  );
  const pickedMeta = pickedTeam ? metaForTeam(pickedTeam.team_id) : null;

  if (!loaded) {
    return <EmptyState title='Loading…' />;
  }
  if (teams.length === 0) {
    return (
      <EmptyState
        title="Teams aren't loaded yet"
        description='Wait for the next refresh to populate the fixture list.'
      />
    );
  }

  return (
    <div className='space-y-5'>
      {/* Hero summary card */}
      <Card
        className={cn(
          "border-paper-edge bg-paper overflow-hidden",
          pick && "ring-2 ring-mustard/40"
        )}
      >
        <div className='h-1 w-full grid grid-cols-3'>
          <div className='bg-crimson' />
          <div className='bg-mustard' />
          <div className='bg-pitch' />
        </div>
        <CardContent className='p-5 flex items-center gap-5 flex-wrap'>
          <div className='flex items-center justify-center h-20 w-20 rounded-sm bg-mustard/15 border-2 border-mustard'>
            <Crown className='h-10 w-10 text-mustard' strokeWidth={1.5} />
          </div>
          <div className='flex-1 min-w-[200px]'>
            <h2 className='tournament-title text-3xl text-ink'>
              World <span className='text-crimson'>Champion</span>
            </h2>
            <p className='text-sm text-ink-soft mt-1 max-w-md'>
              Pick the country you think will lift the trophy. Worth{" "}
              <span className='font-bold text-mustard'>+26 points</span> if
              you call it. Locks at the kickoff of the opening match.
            </p>
          </div>
          <div className='ml-auto flex flex-col items-end gap-1.5 text-right'>
            {tournamentLockUtc && (
              <div className='font-mono text-xs text-ink-soft'>
                {locked ? (
                  <span className='inline-flex items-center gap-1 text-crimson'>
                    <Lock className='h-3 w-3' /> Locked
                  </span>
                ) : (
                  <span>Locks {countdown(tournamentLockUtc, now)}</span>
                )}
              </div>
            )}
            {pickedTeam ? (
              <div className='flex items-center gap-2'>
                <span className='font-display text-xs uppercase tracking-widest text-ink-soft'>
                  Your pick
                </span>
                <span className='font-display text-lg tracking-wide'>
                  {pickedTeam.team_name}
                </span>
              </div>
            ) : (
              <span className='font-display text-xs uppercase tracking-widest text-ink-soft'>
                No pick yet
              </span>
            )}
            {pick && pick.updated_at_utc && (
              <span className='font-mono text-[10px] text-ink-soft'>
                saved {formatLocal(pick.updated_at_utc, undefined, tz)}
              </span>
            )}
          </div>
        </CardContent>
        {pickedMeta?.fact && (
          <div className='border-t border-paper-edge/60 bg-mustard/10 px-5 py-3'>
            <span className='font-display tracking-widest text-mustard text-xs uppercase mr-2'>
              Why {pickedTeam?.team_name}
            </span>
            <span className='text-sm text-ink'>{pickedMeta.fact}</span>
          </div>
        )}
      </Card>

      <ContinentGrid
        teams={teams}
        selectedTeamId={pick?.team_id ?? null}
        // Gate on userDataLoaded too — otherwise a quick click during
        // the initial websocket load could submit a champion pick before
        // the user's existing pick has arrived, silently overwriting it.
        disabled={locked || !userDataLoaded}
        onSelect={(teamId) => setPick(teamId)}
      />

      <FunFactStrip />
    </div>
  );
}
