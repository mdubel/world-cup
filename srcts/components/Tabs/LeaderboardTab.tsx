import { EmptyState } from "@/components/EmptyState";
import { FunFactStrip } from "@/components/FunFactStrip";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { LeaderboardUserDetail } from "@/components/LeaderboardUserDetail";
import { Podium } from "@/components/Podium";
import { SpoilerBanner } from "@/components/SpoilerBanner";
import { useAppData } from "@/contexts/AppData";
import { useSpoilers } from "@/contexts/Spoilers";
import { useUserTz } from "@/contexts/Timezone";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLeaderboardDetail } from "@/hooks/useLeaderboard";
import { shouldMaskLeaderboard } from "@/lib/spoiler";
import { formatLocal } from "@/lib/time";
import type { Match, Team } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function LeaderboardTab() {
  const user = useCurrentUser();
  const tz = useUserTz();
  const {
    leaderboard: { rows, computedAtUtc, loaded },
    tracker,
    fixtures: { matches, teams },
  } = useAppData();
  const { detail, selectUser } = useLeaderboardDetail();
  const { revealed } = useSpoilers();

  const shouldMask = shouldMaskLeaderboard(tracker);
  const masked = shouldMask && !revealed;

  const [openUserId, setOpenUserId] = useState<string | null>(null);

  useEffect(() => {
    if (openUserId) {
      selectUser(openUserId);
    } else {
      selectUser(null);
    }
  }, [openUserId, selectUser]);

  const matchById = useMemo(() => {
    const m = new Map<string, Match>();
    for (const match of matches) {
      m.set(match.match_id, match);
    }
    return m;
  }, [matches]);

  const teamsById = useMemo(() => {
    const t = new Map<string, Team>();
    for (const team of teams) {
      t.set(team.team_id, team);
    }
    return t;
  }, [teams]);

  if (!loaded) {
    return <EmptyState title='Loading leaderboard…' />;
  }

  const openDisplayName =
    rows.find((r) => r.user_id === openUserId)?.display_name ?? openUserId ?? "";

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const noPlayersYet = rows.length === 0;

  return (
    <div className='space-y-5'>
      {shouldMask && (
        <SpoilerBanner description='Some of your matches are unwatched. Point totals can reveal results.' />
      )}

      {noPlayersYet ? (
        <EmptyState
          title='Nobody has scored yet'
          description='As soon as someone makes a prediction, they show up here.'
        />
      ) : (
        <>
          <Podium
            rows={top3}
            currentUserId={user?.id}
            masked={masked}
            teamsById={teamsById}
            onSelectUser={(uid) => setOpenUserId(uid)}
          />

          {rest.length > 0 && (
            <div className='space-y-2'>
              <h2 className='tournament-title text-xl text-ink'>
                The <span className='text-crimson'>Pack</span>
              </h2>
              <LeaderboardTable
                rows={rest}
                startRank={4}
                currentUserId={user?.id}
                masked={masked}
                teamsById={teamsById}
                onSelectUser={(uid) => setOpenUserId(uid)}
              />
            </div>
          )}
        </>
      )}

      {computedAtUtc && (
        <p className='text-[10px] uppercase tracking-widest text-ink-soft text-center font-display'>
          Computed {formatLocal(computedAtUtc, undefined, tz)}
        </p>
      )}

      <FunFactStrip />

      <LeaderboardUserDetail
        open={openUserId !== null}
        onOpenChange={(o) => !o && setOpenUserId(null)}
        displayName={openDisplayName}
        rows={detail.rows}
        groupPts={detail.groupPts}
        knockoutPts={detail.knockoutPts}
        tournamentPts={detail.tournamentPts}
        total={detail.total}
        tournamentPick={detail.tournamentPick}
        selfTracker={openUserId === user?.id ? tracker : null}
        matchById={matchById}
      />
    </div>
  );
}
