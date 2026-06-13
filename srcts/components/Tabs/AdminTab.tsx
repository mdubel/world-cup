import { EmptyState } from "@/components/EmptyState";
import { TeamFlag } from "@/components/TeamFlag";
import { Card, CardContent } from "@/components/ui/card";
import { useAppData } from "@/contexts/AppData";
import { useUserTz } from "@/contexts/Timezone";
import { useAdminStats } from "@/hooks/useAdminStats";
import { formatLocal } from "@/lib/time";
import type { AdminCategory, AdminUserRow, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

const PRIZE_THRESHOLD = 26;

interface SummaryCardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "ink" | "crimson" | "mustard" | "pitch";
}

const ACCENT_BG: Record<NonNullable<SummaryCardProps["accent"]>, string> = {
  ink: "border-paper-edge",
  crimson: "border-crimson/60 ring-2 ring-crimson/20",
  mustard: "border-mustard/60 ring-2 ring-mustard/20",
  pitch: "border-pitch/60 ring-2 ring-pitch/20",
};

function SummaryCard({ label, value, hint, accent = "ink" }: SummaryCardProps) {
  return (
    <Card className={cn("bg-paper", ACCENT_BG[accent])}>
      <CardContent className='p-4'>
        <p className='font-display tracking-widest uppercase text-[10px] text-ink-soft'>
          {label}
        </p>
        <p className='font-display text-3xl tracking-wide text-ink mt-1'>
          {value}
        </p>
        {hint && (
          <p className='text-[10px] text-ink-soft mt-1 leading-snug'>{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

type SortKey =
  | "category"
  | "display_name"
  | "first_seen_utc"
  | "last_seen_utc"
  | "group_picks"
  | "knockout_picks"
  | "tracker_total"
  | "champion_pick";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

// active first, then dormant, then inactive — used both as the always-on
// primary sort and as the explicit "category" sort.
const CATEGORY_ORDER: Record<AdminCategory, number> = {
  active: 0,
  dormant: 1,
  inactive: 2,
};

const CATEGORY_LABEL: Record<AdminCategory, string> = {
  active: "Active",
  dormant: "Dormant",
  inactive: "Inactive",
};

// Tailwind classes for the badge (left) and the row's left border (right).
const CATEGORY_STYLE: Record<AdminCategory, { badge: string; row: string }> = {
  active: {
    badge: "bg-pitch/15 text-pitch border border-pitch/40",
    row: "border-l-4 border-l-pitch",
  },
  dormant: {
    badge: "bg-mustard/20 text-ink border border-mustard/60",
    row: "border-l-4 border-l-mustard",
  },
  inactive: {
    badge: "bg-paper-soft text-ink-soft border border-paper-edge",
    row: "border-l-4 border-l-paper-edge",
  },
};

function compareUsers(
  a: AdminUserRow,
  b: AdminUserRow,
  sort: SortState
): number {
  // Category always groups first — the user asked for active → dormant →
  // inactive ordering. Within a category, the explicit sort key applies.
  const ca = CATEGORY_ORDER[a.category] ?? 99;
  const cb = CATEGORY_ORDER[b.category] ?? 99;
  if (ca !== cb) return ca - cb;

  const dir = sort.dir === "asc" ? 1 : -1;
  const get = (r: AdminUserRow): string | number | null => {
    switch (sort.key) {
      case "category":
        // Already grouped by category above; tie-break by last_seen desc
        // (newest first) so the most recently active user surfaces.
        return r.last_seen_utc ?? "";
      case "display_name":
        return r.display_name.toLowerCase();
      case "first_seen_utc":
      case "last_seen_utc":
        return r[sort.key] ?? "";
      case "group_picks":
        return r.group_picks;
      case "knockout_picks":
        return r.knockout_picks;
      case "tracker_total":
        return (
          r.tracker_watch_later + r.tracker_watched + r.tracker_skipped
        );
      case "champion_pick":
        return r.champion_pick_team_name ?? "";
    }
  };
  // "category" sort secondary defaults to last_seen DESC regardless of dir
  // so clicking the column header twice doesn't reverse the grouping.
  const effectiveDir = sort.key === "category" ? -1 : dir;
  const va = get(a);
  const vb = get(b);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  if (va < vb) return -1 * effectiveDir;
  if (va > vb) return 1 * effectiveDir;
  return 0;
}

interface HeaderProps {
  label: string;
  sortKey: SortKey;
  current: SortState;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}

function Th({ label, sortKey, current, onSort, align = "left" }: HeaderProps) {
  const active = current.key === sortKey;
  const Arrow = current.dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <th
      className={cn(
        "py-2 px-2 font-display tracking-widest uppercase text-[10px] text-ink-soft",
        "cursor-pointer select-none hover:text-ink",
        align === "right" ? "text-right" : "text-left"
      )}
      onClick={() => onSort(sortKey)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-0.5",
          align === "right" ? "justify-end w-full" : ""
        )}
      >
        {label}
        {active && <Arrow className='h-3 w-3' />}
      </span>
    </th>
  );
}

export function AdminTab() {
  const { stats, loading, refresh } = useAdminStats();
  const {
    fixtures: { teams },
  } = useAppData();
  const tz = useUserTz();

  // Default to the category column so the visible ordering matches the
  // grouping (compareUsers already always groups by category first).
  const [sort, setSort] = useState<SortState>({
    key: "category",
    dir: "asc",
  });

  const onSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const teamsById = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.team_id, t);
    return m;
  }, [teams]);

  const sortedUsers = useMemo<AdminUserRow[]>(() => {
    if (!stats?.users) return [];
    return [...stats.users].sort((a, b) => compareUsers(a, b, sort));
  }, [stats, sort]);

  if (stats?.error === "not_authorized") {
    return (
      <EmptyState
        title='Not authorised'
        description='Admin dashboard is restricted.'
      />
    );
  }

  if (!stats) {
    return <EmptyState title='Loading admin stats…' />;
  }

  const total = stats.total_users;
  const c = stats.counts;
  const pct = (n: number) =>
    total > 0 ? `${Math.round((n / total) * 100)}% of ${total}` : "—";
  const towardPrize = (n: number) =>
    `${n} / ${PRIZE_THRESHOLD} threshold`;

  return (
    <div className='space-y-5'>
      <div className='flex items-baseline justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-3'>
          <ShieldCheck className='h-8 w-8 text-crimson' strokeWidth={1.5} />
          <div>
            <h2 className='tournament-title text-2xl text-ink'>
              Admin <span className='text-crimson'>Dashboard</span>
            </h2>
            <p className='text-xs text-ink-soft mt-1'>
              Adoption metrics across the office pool. Visible only to
              accounts on the WC26_ADMINS allowlist.
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={refresh}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm",
            "border-2 border-paper-edge bg-paper hover:border-ink",
            "font-display tracking-wider text-xs uppercase",
            "disabled:opacity-60 disabled:cursor-progress"
          )}
        >
          {loading ? (
            <Loader2 className='h-3.5 w-3.5 animate-spin' />
          ) : (
            <RefreshCw className='h-3.5 w-3.5' />
          )}
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Engagement card spans full width on its own row — it's the row the
          user is most likely to glance at first, and the three coloured
          numbers don't fit cleanly into the small SummaryCard grid. */}
      <Card className='border-paper-edge bg-paper'>
        <CardContent className='p-4'>
          <div className='flex items-baseline justify-between flex-wrap gap-2'>
            <p className='font-display tracking-widest uppercase text-xs text-ink'>
              Engagement
            </p>
            <span className='text-[10px] text-ink-soft font-mono'>
              {stats.kicked_off_count}{" "}
              {stats.kicked_off_count === 1 ? "match" : "matches"} kicked off
              so far
            </span>
          </div>
          <div className='grid grid-cols-3 gap-2 sm:gap-3 mt-3'>
            {(
              [
                {
                  key: "active",
                  value: c.active,
                  hint: "picked every locked match",
                },
                {
                  key: "dormant",
                  value: c.dormant,
                  hint: "missed at least one",
                },
                {
                  key: "inactive",
                  value: c.inactive,
                  hint: "no picks yet",
                },
              ] as const
            ).map(({ key, value, hint }) => {
              const style = CATEGORY_STYLE[key];
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-sm px-2 sm:px-3 py-2 bg-paper-soft",
                    style.row
                  )}
                >
                  <div className='flex flex-wrap items-baseline justify-between gap-1 sm:gap-2'>
                    <span
                      className={cn(
                        "inline-block px-1.5 py-0.5 rounded-sm font-display tracking-wider uppercase text-[10px]",
                        style.badge
                      )}
                    >
                      {CATEGORY_LABEL[key]}
                    </span>
                    <span className='font-display text-xl sm:text-2xl tracking-wide text-ink tabular-nums'>
                      {value}
                    </span>
                  </div>
                  <p className='text-[10px] text-ink-soft mt-1 leading-snug'>
                    {hint}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
        <SummaryCard
          label='Total users'
          value={total}
          hint='People who have ever opened the app'
          accent='ink'
        />
        <SummaryCard
          label='Marked schedule'
          value={c.with_tracker}
          hint={pct(c.with_tracker)}
          accent='mustard'
        />
        <SummaryCard
          label='Group picks'
          value={c.with_group_picks}
          hint={towardPrize(c.with_group_picks)}
          accent={c.with_group_picks >= PRIZE_THRESHOLD ? "pitch" : "crimson"}
        />
        <SummaryCard
          label='Knockout picks'
          value={c.with_knockout_picks}
          hint={towardPrize(c.with_knockout_picks)}
          accent={c.with_knockout_picks >= PRIZE_THRESHOLD ? "pitch" : "crimson"}
        />
        <SummaryCard
          label='Champion picks'
          value={c.with_champion}
          hint={pct(c.with_champion)}
          accent='pitch'
        />
      </div>

      {/* Prize-threshold progress */}
      <Card className='border-paper-edge bg-paper'>
        <CardContent className='p-4 space-y-3'>
          <div className='flex items-baseline justify-between flex-wrap gap-2'>
            <p className='font-display tracking-widest uppercase text-xs text-ink'>
              LEGO Trophy threshold
            </p>
            <span className='text-[10px] text-ink-soft font-mono'>
              need {PRIZE_THRESHOLD} in both group + knockout
            </span>
          </div>
          {(["group", "knockout"] as const).map((kind) => {
            const value =
              kind === "group" ? c.with_group_picks : c.with_knockout_picks;
            const pctNum = Math.min(100, (value / PRIZE_THRESHOLD) * 100);
            const hit = value >= PRIZE_THRESHOLD;
            return (
              <div key={kind} className='space-y-1'>
                <div className='flex items-center justify-between text-xs'>
                  <span className='font-display tracking-wider uppercase text-ink-soft'>
                    {kind === "group" ? "Group stage" : "Knockout stage"}
                  </span>
                  <span className='font-mono'>
                    {value} / {PRIZE_THRESHOLD}{" "}
                    {hit && (
                      <span className='text-pitch font-display tracking-widest uppercase text-[10px] ml-1'>
                        unlocked
                      </span>
                    )}
                  </span>
                </div>
                <div className='h-2 bg-paper-soft rounded-sm overflow-hidden border border-paper-edge'>
                  <div
                    className={cn(
                      "h-full transition-all",
                      hit ? "bg-pitch" : "bg-mustard"
                    )}
                    style={{ width: `${pctNum}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Users table */}
      <Card className='border-paper-edge bg-paper'>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='border-b border-paper-edge'>
                <tr>
                  <Th
                    label='Group'
                    sortKey='category'
                    current={sort}
                    onSort={onSort}
                  />
                  <Th
                    label='User'
                    sortKey='display_name'
                    current={sort}
                    onSort={onSort}
                  />
                  <Th
                    label='First seen'
                    sortKey='first_seen_utc'
                    current={sort}
                    onSort={onSort}
                  />
                  <Th
                    label='Last seen'
                    sortKey='last_seen_utc'
                    current={sort}
                    onSort={onSort}
                  />
                  <Th
                    label='Group picks'
                    sortKey='group_picks'
                    current={sort}
                    onSort={onSort}
                    align='right'
                  />
                  <Th
                    label='KO'
                    sortKey='knockout_picks'
                    current={sort}
                    onSort={onSort}
                    align='right'
                  />
                  <Th
                    label='Schedule'
                    sortKey='tracker_total'
                    current={sort}
                    onSort={onSort}
                    align='right'
                  />
                  <th className='py-2 px-2 font-display tracking-widest uppercase text-[10px] text-ink-soft text-left'>
                    Favorite
                  </th>
                  <Th
                    label='Champion'
                    sortKey='champion_pick'
                    current={sort}
                    onSort={onSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className='py-6 text-center text-ink-soft text-sm'
                    >
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((u) => {
                    const trackerTotal =
                      u.tracker_watch_later +
                      u.tracker_watched +
                      u.tracker_skipped;
                    const favorite = u.favorite_team_id
                      ? teamsById.get(u.favorite_team_id) ?? null
                      : null;
                    const champion = u.champion_pick_team_id
                      ? teamsById.get(u.champion_pick_team_id) ?? null
                      : null;
                    const style = CATEGORY_STYLE[u.category];
                    const dormantTitle =
                      u.category === "dormant" && stats.kicked_off_count > 0
                        ? `${u.picks_kicked_off} of ${stats.kicked_off_count} locked matches picked`
                        : undefined;
                    return (
                      <tr
                        key={u.user_id}
                        className={cn(
                          "border-t border-paper-edge/40 hover:bg-paper-soft transition-colors",
                          style.row,
                          u.category === "inactive" && "opacity-70"
                        )}
                      >
                        <td className='py-2 px-2'>
                          <span
                            className={cn(
                              "inline-block px-1.5 py-0.5 rounded-sm font-display tracking-wider uppercase text-[10px] whitespace-nowrap",
                              style.badge
                            )}
                            title={dormantTitle}
                          >
                            {CATEGORY_LABEL[u.category]}
                          </span>
                        </td>
                        <td className='py-2 px-2'>
                          <div className='font-display tracking-wide text-sm'>
                            {u.display_name}
                          </div>
                          <div className='font-mono text-[10px] text-ink-soft truncate max-w-[180px]'>
                            {u.user_id}
                          </div>
                        </td>
                        <td className='py-2 px-2 font-mono text-[10px] text-ink-soft whitespace-nowrap'>
                          {formatLocal(u.first_seen_utc, undefined, tz)}
                        </td>
                        <td className='py-2 px-2 font-mono text-[10px] text-ink-soft whitespace-nowrap'>
                          {formatLocal(u.last_seen_utc, undefined, tz)}
                        </td>
                        <td className='py-2 px-2 text-right font-mono tabular-nums'>
                          {u.group_picks}
                        </td>
                        <td className='py-2 px-2 text-right font-mono tabular-nums'>
                          {u.knockout_picks}
                        </td>
                        <td className='py-2 px-2 text-right'>
                          {trackerTotal > 0 ? (
                            <div className='inline-flex items-center gap-1 font-mono text-[10px]'>
                              <span
                                className='text-mustard'
                                title={`${u.tracker_watch_later} watch later`}
                              >
                                {u.tracker_watch_later}
                              </span>
                              <span className='text-ink-soft'>/</span>
                              <span
                                className='text-pitch'
                                title={`${u.tracker_watched} watched`}
                              >
                                {u.tracker_watched}
                              </span>
                              <span className='text-ink-soft'>/</span>
                              <span
                                className='text-ink-soft'
                                title={`${u.tracker_skipped} skipped`}
                              >
                                {u.tracker_skipped}
                              </span>
                            </div>
                          ) : (
                            <span className='text-ink-soft text-[10px]'>—</span>
                          )}
                        </td>
                        <td className='py-2 px-2'>
                          {favorite || u.favorite_team_name ? (
                            <div className='flex items-center gap-1.5 min-w-0'>
                              {favorite && (
                                <TeamFlag
                                  crest={favorite.team_crest}
                                  code={favorite.team_code}
                                  name={favorite.team_name}
                                  size='xs'
                                />
                              )}
                              <span className='font-display tracking-wide text-sm truncate'>
                                {favorite?.team_name ??
                                  u.favorite_team_name ??
                                  ""}
                              </span>
                            </div>
                          ) : (
                            <span className='text-ink-soft text-[10px]'>—</span>
                          )}
                        </td>
                        <td className='py-2 px-2'>
                          {champion || u.champion_pick_team_name ? (
                            <div className='flex items-center gap-1.5 min-w-0'>
                              {champion && (
                                <TeamFlag
                                  crest={champion.team_crest}
                                  code={champion.team_code}
                                  name={champion.team_name}
                                  size='xs'
                                />
                              )}
                              <span className='font-display tracking-wide text-sm truncate'>
                                {champion?.team_name ??
                                  u.champion_pick_team_name ??
                                  ""}
                              </span>
                            </div>
                          ) : (
                            <span className='text-ink-soft text-[10px]'>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className='text-[10px] uppercase tracking-widest text-ink-soft text-center font-display'>
        Computed {formatLocal(stats.computed_at_utc, undefined, tz)}
      </p>
    </div>
  );
}
