import { EmptyState } from "@/components/EmptyState";
import { FunFactStrip } from "@/components/FunFactStrip";
import { GroupCard } from "@/components/GroupCard";
import { SpoilerBanner } from "@/components/SpoilerBanner";
import { ThirdPlaceTable } from "@/components/ThirdPlaceTable";
import { useAppData } from "@/contexts/AppData";
import { useSpoilers } from "@/contexts/Spoilers";
import {
  computeThirdPlaceTable,
  groupMatchesByGroup,
  groupSortKey,
} from "@/lib/standings";
import { useMemo } from "react";

export function GroupsTab() {
  const {
    fixtures: { matches, loaded },
    tracker,
  } = useAppData();
  const { revealed } = useSpoilers();

  const groups = useMemo(() => {
    const m = groupMatchesByGroup(matches);
    return Array.from(m.entries()).sort(([a], [b]) =>
      groupSortKey(a).localeCompare(groupSortKey(b))
    );
  }, [matches]);

  // A group's standings are "tainted" if any of its matches is WATCH_LATER —
  // P/W/D/L/GD/Pts on the unwatched match would reveal its outcome.
  const groupHasWatchLater = useMemo(() => {
    const out = new Map<string, boolean>();
    for (const [group, ms] of groups) {
      out.set(
        group,
        ms.some((m) => tracker[m.match_id] === "WATCH_LATER")
      );
    }
    return out;
  }, [groups, tracker]);

  const anyGroupTainted = Array.from(groupHasWatchLater.values()).some(
    Boolean
  );

  // Hide tainted groups from the cross-group 3rd-place ranking — including
  // them would reveal the unwatched in-group ordering once the user clicks
  // through. When the spoiler is explicitly revealed we include everything.
  const thirdPlaceRows = useMemo(() => {
    const filterMap = revealed
      ? new Map<string, boolean>()
      : groupHasWatchLater;
    return computeThirdPlaceTable(groups, filterMap);
  }, [groups, groupHasWatchLater, revealed]);

  if (!loaded) {
    return <EmptyState title='Loading groups…' />;
  }
  if (groups.length === 0) {
    return (
      <EmptyState
        title='No group fixtures yet'
        description='Wait for the schedule to load.'
      />
    );
  }

  return (
    <div className='space-y-5'>
      <div className='flex items-baseline justify-between flex-wrap gap-2'>
        <h2 className='tournament-title text-2xl text-ink'>
          Group <span className='text-crimson'>Stage</span>
        </h2>
        <p className='text-xs text-ink-soft max-w-md'>
          12 groups of 4. Top 2 advance automatically. The best 8 third-placed
          teams also go through to the round of 32.
        </p>
      </div>

      {anyGroupTainted && (
        <SpoilerBanner description='Standings reveal match outcomes via the points/W-L columns. Groups containing your unwatched matches are masked until you reveal.' />
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
        {groups.map(([group, matches]) => {
          const tainted = groupHasWatchLater.get(group) ?? false;
          return (
            <GroupCard
              key={group}
              group={group}
              matches={matches}
              tracker={tracker}
              masked={tainted && !revealed}
            />
          );
        })}
      </div>

      <div className='flex items-center gap-3 flex-wrap text-[10px] uppercase tracking-widest text-ink-soft'>
        <span className='inline-flex items-center gap-1'>
          <span className='w-2 h-3 rounded-sm bg-pitch' /> Top 2 advance
        </span>
        <span className='inline-flex items-center gap-1'>
          <span className='w-2 h-3 rounded-sm bg-mustard' /> 3rd — best 8 across
          groups also advance
        </span>
        <span className='inline-flex items-center gap-1'>
          <span className='w-2 h-3 rounded-sm bg-crimson/70' /> 4th — out
        </span>
      </div>

      <ThirdPlaceTable
        rows={thirdPlaceRows}
        totalGroups={groups.length}
      />

      <FunFactStrip />
    </div>
  );
}
