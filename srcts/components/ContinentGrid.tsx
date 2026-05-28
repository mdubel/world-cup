import { TeamFlag } from "@/components/TeamFlag";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CONFEDERATIONS,
  CONFEDERATION_ORDER,
  metaForTeam,
  type Confederation,
} from "@/data/teams";
import type { Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
import { useMemo } from "react";

interface ContinentGridProps {
  teams: Team[];
  selectedTeamId?: string | null;
  disabled?: boolean;
  onSelect: (teamId: string) => void;
}

interface TeamTileProps {
  team: Team;
  selected: boolean;
  disabled: boolean;
  locked: boolean;
  onSelect: () => void;
}

function TeamTile({ team, selected, disabled, locked, onSelect }: TeamTileProps) {
  const meta = metaForTeam(team.team_id);

  const tile = (
    <button
      type='button'
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "group relative flex flex-col items-center justify-between gap-2",
        "px-2 pt-3 pb-2 w-full h-full min-h-[120px]",
        "border-2 rounded-sm bg-paper transition-all",
        "shadow-[0_2px_0_var(--paper-edge)]",
        "disabled:cursor-not-allowed",
        selected
          ? "border-mustard ring-2 ring-mustard shadow-[0_3px_0_var(--ink)] scale-[1.02]"
          : disabled
            ? "border-paper-edge opacity-40"
            : "border-paper-edge hover:border-ink hover:bg-paper-soft hover:-translate-y-0.5"
      )}
    >
      {selected && (
        <span
          className={cn(
            "absolute -top-2 left-1/2 -translate-x-1/2",
            "flex items-center gap-1 px-2 py-0.5 rounded-sm",
            "bg-mustard text-ink",
            "font-display tracking-widest uppercase text-[9px]",
            "shadow-[0_1px_0_var(--ink)]"
          )}
        >
          <Crown className='h-2.5 w-2.5' /> Your pick
        </span>
      )}
      <TeamFlag
        crest={team.team_crest}
        code={team.team_code}
        name={team.team_name}
        size='lg'
      />
      <div className='flex flex-col items-center min-w-0 w-full'>
        <span className='font-display tracking-wide text-xs text-center truncate w-full leading-tight'>
          {team.team_name}
        </span>
        {meta?.nickname && (
          <span className='text-[10px] italic text-ink-soft text-center truncate w-full leading-tight'>
            {meta.nickname}
          </span>
        )}
      </div>
      {locked && selected && (
        <span className='absolute bottom-1 right-1 font-display tracking-widest uppercase text-[8px] text-mustard'>
          locked in
        </span>
      )}
    </button>
  );

  if (!meta?.fact) {
    return tile;
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{tile}</TooltipTrigger>
      <TooltipContent
        side='top'
        className='bg-ink text-paper border border-mustard max-w-[260px] text-xs leading-relaxed font-body normal-case tracking-normal'
      >
        <span className='font-display tracking-widest text-mustard text-[10px] uppercase mb-1 block'>
          Did you know?
        </span>
        {meta.fact}
      </TooltipContent>
    </Tooltip>
  );
}

export function ContinentGrid({
  teams,
  selectedTeamId,
  disabled = false,
  onSelect,
}: ContinentGridProps) {
  const byConfederation = useMemo(() => {
    const out = new Map<Confederation, Team[]>();
    for (const conf of CONFEDERATION_ORDER) {
      out.set(conf, []);
    }
    const unknown: Team[] = [];
    for (const t of teams) {
      const meta = metaForTeam(t.team_id);
      if (meta) {
        out.get(meta.confederation)!.push(t);
      } else {
        unknown.push(t);
      }
    }
    for (const arr of out.values()) {
      arr.sort((a, b) => a.team_name.localeCompare(b.team_name));
    }
    unknown.sort((a, b) => a.team_name.localeCompare(b.team_name));
    return { groups: out, unknown };
  }, [teams]);

  return (
    <div className='space-y-6'>
      {CONFEDERATION_ORDER.map((conf) => {
        const list = byConfederation.groups.get(conf) ?? [];
        if (list.length === 0) return null;
        const meta = CONFEDERATIONS[conf];
        return (
          <section key={conf} className='space-y-3'>
            <header className='flex items-baseline gap-3 flex-wrap pb-1 border-b-2 border-paper-edge/50'>
              <span
                className='font-display text-2xl tracking-widest'
                style={{ color: meta.accent }}
              >
                {meta.name}
              </span>
              <span className='text-xs uppercase tracking-widest text-ink-soft'>
                {meta.region}
              </span>
              <span className='ml-auto font-mono text-[10px] text-ink-soft'>
                {list.length} {list.length === 1 ? "team" : "teams"}
              </span>
            </header>
            <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3'>
              {list.map((t) => {
                const isSelected = selectedTeamId === t.team_id;
                return (
                  <TeamTile
                    key={t.team_id}
                    team={t}
                    selected={isSelected}
                    disabled={disabled && !isSelected}
                    locked={disabled}
                    onSelect={() => onSelect(t.team_id)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      {byConfederation.unknown.length > 0 && (
        <section className='space-y-3'>
          <header className='flex items-baseline gap-3 pb-1 border-b-2 border-paper-edge/50'>
            <span className='font-display text-2xl tracking-widest text-ink-soft'>
              Other
            </span>
            <span className='text-xs uppercase tracking-widest text-ink-soft'>
              Not yet categorised
            </span>
          </header>
          <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3'>
            {byConfederation.unknown.map((t) => {
              const isSelected = selectedTeamId === t.team_id;
              return (
                <TeamTile
                  key={t.team_id}
                  team={t}
                  selected={isSelected}
                  disabled={disabled && !isSelected}
                  locked={disabled}
                  onSelect={() => onSelect(t.team_id)}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
