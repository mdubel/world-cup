import { FilterPopover, type FilterOption } from "@/components/FilterPopover";
import { TeamFlag } from "@/components/TeamFlag";
import {
  CONFEDERATIONS,
  CONFEDERATION_ORDER,
  metaForTeam,
  type Confederation,
} from "@/data/teams";
import { stageLabel } from "@/lib/fixtures";
import type { Match, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Heart, X } from "lucide-react";
import { useMemo } from "react";

export interface ScheduleFilterState {
  groups: Set<string>;
  stages: Set<string>;
  teams: Set<string>;
}

export const EMPTY_FILTERS: ScheduleFilterState = {
  groups: new Set(),
  stages: new Set(),
  teams: new Set(),
};

export function filtersAreEmpty(f: ScheduleFilterState): boolean {
  return f.groups.size === 0 && f.stages.size === 0 && f.teams.size === 0;
}

export function matchPassesFilters(
  m: Match,
  f: ScheduleFilterState
): boolean {
  if (f.groups.size > 0) {
    if (!m.group || !f.groups.has(m.group)) return false;
  }
  if (f.stages.size > 0) {
    if (!m.stage || !f.stages.has(m.stage)) return false;
  }
  if (f.teams.size > 0) {
    const homeMatch = m.home_team_id !== null && f.teams.has(m.home_team_id);
    const awayMatch = m.away_team_id !== null && f.teams.has(m.away_team_id);
    if (!homeMatch && !awayMatch) return false;
  }
  return true;
}

interface ScheduleFiltersProps {
  matches: Match[];
  filters: ScheduleFilterState;
  onChange: (next: ScheduleFilterState) => void;
  favoriteTeam: Team | null;
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ScheduleFilters({
  matches,
  filters,
  onChange,
  favoriteTeam,
}: ScheduleFiltersProps) {
  // Derive the option sets from actual fixtures so we never offer a filter
  // value that would always match zero rows.
  const groupOptions = useMemo<FilterOption[]>(() => {
    const seen = new Set<string>();
    for (const m of matches) {
      if (m.group) seen.add(m.group);
    }
    return Array.from(seen)
      .sort()
      .map((g) => ({
        value: g,
        label: g.replace(/^GROUP_/, "Group "),
      }));
  }, [matches]);

  const stageOptions = useMemo<FilterOption[]>(() => {
    const order = [
      "GROUP_STAGE",
      "LAST_32",
      "LAST_16",
      "QUARTER_FINALS",
      "SEMI_FINALS",
      "THIRD_PLACE",
      "FINAL",
    ];
    const seen = new Set<string>();
    for (const m of matches) {
      if (m.stage) seen.add(m.stage);
    }
    return order
      .filter((s) => seen.has(s))
      .map((s) => ({ value: s, label: stageLabel(s) }));
  }, [matches]);

  const { teamOptions, teamLookup } = useMemo(() => {
    const teams = new Map<string, Team>();
    for (const m of matches) {
      if (m.home_team_id) {
        teams.set(m.home_team_id, {
          team_id: m.home_team_id,
          team_name: m.home_team_name ?? m.home_team_id,
          team_code: m.home_team_code,
          team_crest: m.home_team_crest,
        });
      }
      if (m.away_team_id) {
        teams.set(m.away_team_id, {
          team_id: m.away_team_id,
          team_name: m.away_team_name ?? m.away_team_id,
          team_code: m.away_team_code,
          team_crest: m.away_team_crest,
        });
      }
    }
    const list = Array.from(teams.values()).sort((a, b) =>
      a.team_name.localeCompare(b.team_name)
    );

    // Sort by confederation, then by name within each. Teams without
    // confederation metadata fall under "Other".
    const byConf = new Map<Confederation | "OTHER", Team[]>();
    for (const t of list) {
      const meta = metaForTeam(t.team_id);
      const key = (meta?.confederation as Confederation) ?? "OTHER";
      if (!byConf.has(key)) byConf.set(key, []);
      byConf.get(key)!.push(t);
    }

    const opts: FilterOption[] = [];
    for (const conf of CONFEDERATION_ORDER) {
      const arr = byConf.get(conf);
      if (!arr || arr.length === 0) continue;
      for (const t of arr) {
        const meta = metaForTeam(t.team_id);
        opts.push({
          value: t.team_id,
          label: (
            <span className='inline-flex items-center gap-2'>
              <TeamFlag
                crest={t.team_crest}
                code={t.team_code}
                name={t.team_name}
                size='xs'
              />
              <span>{t.team_name}</span>
              {t.team_code && (
                <span className='font-mono text-[10px] text-ink-soft'>
                  {t.team_code}
                </span>
              )}
            </span>
          ),
          hint: meta?.nickname,
          group: CONFEDERATIONS[conf].name,
        });
      }
    }
    const other = byConf.get("OTHER");
    if (other && other.length > 0) {
      for (const t of other) {
        opts.push({
          value: t.team_id,
          label: (
            <span className='inline-flex items-center gap-2'>
              <TeamFlag
                crest={t.team_crest}
                code={t.team_code}
                name={t.team_name}
                size='xs'
              />
              <span>{t.team_name}</span>
            </span>
          ),
          group: "Other",
        });
      }
    }
    return { teamOptions: opts, teamLookup: teams };
  }, [matches]);

  const toggleGroup = (g: string) =>
    onChange({ ...filters, groups: toggleInSet(filters.groups, g) });
  const toggleStage = (s: string) =>
    onChange({ ...filters, stages: toggleInSet(filters.stages, s) });
  const toggleTeam = (t: string) =>
    onChange({ ...filters, teams: toggleInSet(filters.teams, t) });

  const clearGroups = () => onChange({ ...filters, groups: new Set() });
  const clearStages = () => onChange({ ...filters, stages: new Set() });
  const clearTeams = () => onChange({ ...filters, teams: new Set() });

  const favoriteSelected =
    favoriteTeam !== null && filters.teams.has(favoriteTeam.team_id);
  const toggleFavoriteFilter = () => {
    if (!favoriteTeam) return;
    toggleTeam(favoriteTeam.team_id);
  };

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2 flex-wrap'>
        <FilterPopover
          label='Groups'
          options={groupOptions}
          selected={filters.groups}
          onToggle={toggleGroup}
          onClear={clearGroups}
          contentClassName='w-56'
          emptyText='No groups in the schedule yet.'
        />
        <FilterPopover
          label='Stages'
          options={stageOptions}
          selected={filters.stages}
          onToggle={toggleStage}
          onClear={clearStages}
          contentClassName='w-56'
          emptyText='No stages in the schedule yet.'
        />
        <FilterPopover
          label='Teams'
          options={teamOptions}
          selected={filters.teams}
          onToggle={toggleTeam}
          onClear={clearTeams}
          contentClassName='w-[320px]'
          emptyText='No teams in the schedule yet.'
          topAction={
            favoriteTeam ? (
              <button
                type='button'
                onClick={toggleFavoriteFilter}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm",
                  "font-display tracking-wider uppercase text-xs",
                  "border-2 transition-colors",
                  favoriteSelected
                    ? "border-mustard bg-mustard text-ink"
                    : "border-mustard/40 bg-paper text-ink hover:bg-mustard/15"
                )}
              >
                <Heart
                  className={cn(
                    "h-3.5 w-3.5",
                    favoriteSelected && "fill-ink"
                  )}
                />
                {favoriteSelected ? "Your team is filtered" : "Pin my team"}
                <span className='ml-auto inline-flex items-center gap-1.5'>
                  <TeamFlag
                    crest={favoriteTeam.team_crest}
                    code={favoriteTeam.team_code}
                    name={favoriteTeam.team_name}
                    size='xs'
                    framed={false}
                  />
                  <span className='font-mono text-[10px]'>
                    {favoriteTeam.team_code ?? "—"}
                  </span>
                </span>
              </button>
            ) : null
          }
        />

        {favoriteTeam && (
          <button
            type='button'
            onClick={toggleFavoriteFilter}
            title={`Toggle filter to ${favoriteTeam.team_name} only`}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5",
              "rounded-sm border-2 transition-colors",
              "font-display tracking-wider uppercase text-xs",
              favoriteSelected
                ? "border-mustard bg-mustard text-ink"
                : "border-mustard/50 bg-paper text-ink hover:bg-mustard/15"
            )}
          >
            <Heart
              className={cn(
                "h-3.5 w-3.5",
                favoriteSelected && "fill-ink"
              )}
            />
            Your team
            <TeamFlag
              crest={favoriteTeam.team_crest}
              code={favoriteTeam.team_code}
              name={favoriteTeam.team_name}
              size='xs'
              framed={false}
            />
          </button>
        )}

        {!filtersAreEmpty(filters) && (
          <button
            type='button'
            onClick={() => onChange(EMPTY_FILTERS)}
            className='ml-auto font-display tracking-widest uppercase text-[10px] text-ink-soft hover:text-crimson underline'
          >
            Clear all
          </button>
        )}
      </div>

      {!filtersAreEmpty(filters) && (
        <div className='flex items-center gap-1.5 flex-wrap'>
          {Array.from(filters.groups)
            .sort()
            .map((g) => (
              <ActiveChip
                key={`g-${g}`}
                label={g.replace(/^GROUP_/, "Group ")}
                onRemove={() => toggleGroup(g)}
              />
            ))}
          {Array.from(filters.stages).map((s) => (
            <ActiveChip
              key={`s-${s}`}
              label={stageLabel(s)}
              onRemove={() => toggleStage(s)}
            />
          ))}
          {Array.from(filters.teams).map((tid) => {
            const t = teamLookup.get(tid);
            return (
              <ActiveChip
                key={`t-${tid}`}
                label={
                  <span className='inline-flex items-center gap-1.5'>
                    {t && (
                      <TeamFlag
                        crest={t.team_crest}
                        code={t.team_code}
                        name={t.team_name}
                        size='xs'
                        framed={false}
                      />
                    )}
                    <span>{t?.team_code ?? t?.team_name ?? tid}</span>
                  </span>
                }
                onRemove={() => toggleTeam(tid)}
                tone={
                  favoriteTeam?.team_id === tid ? "mustard" : "default"
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActiveChip({
  label,
  onRemove,
  tone = "default",
}: {
  label: React.ReactNode;
  onRemove: () => void;
  tone?: "default" | "mustard";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-sm",
        "font-display tracking-wider uppercase text-[10px]",
        "border-2",
        tone === "mustard"
          ? "border-mustard bg-mustard/20 text-ink"
          : "border-paper-edge bg-paper-soft text-ink"
      )}
    >
      {label}
      <button
        type='button'
        onClick={onRemove}
        className='inline-flex items-center justify-center h-4 w-4 rounded-sm hover:bg-crimson hover:text-paper transition-colors'
        aria-label='Remove filter'
      >
        <X className='h-3 w-3' />
      </button>
    </span>
  );
}
