import { TeamFlag } from "@/components/TeamFlag";
import type { LeaderboardRow, Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Medal, Trophy } from "lucide-react";

interface PodiumProps {
  rows: LeaderboardRow[];
  currentUserId?: string;
  masked: boolean;
  teamsById: Map<string, Team>;
  onSelectUser: (userId: string) => void;
}

interface PodiumStepProps {
  rank: 1 | 2 | 3;
  row: LeaderboardRow;
  isMe: boolean;
  masked: boolean;
  team: Team | null;
  onClick: () => void;
}

const STEP_THEME: Record<
  PodiumStepProps["rank"],
  {
    container: string;
    accent: string;
    label: string;
    icon: typeof Trophy;
    height: string;
    iconClass: string;
    rankBgClass: string;
  }
> = {
  1: {
    container: "border-mustard ring-2 ring-mustard/40 bg-paper",
    accent: "from-mustard/30 to-mustard/0",
    label: "Champion",
    icon: Trophy,
    height: "min-h-[230px] sm:min-h-[260px]",
    iconClass: "text-mustard",
    rankBgClass: "bg-mustard text-ink",
  },
  2: {
    container: "border-ink/40 ring-2 ring-ink/15 bg-paper",
    accent: "from-ink/15 to-ink/0",
    label: "Runner-up",
    icon: Medal,
    height: "min-h-[200px] sm:min-h-[220px]",
    iconClass: "text-ink",
    rankBgClass: "bg-ink text-paper",
  },
  3: {
    container: "border-bronze/60 ring-2 ring-bronze/25 bg-paper",
    accent: "from-bronze/25 to-bronze/0",
    label: "Third",
    icon: Medal,
    height: "min-h-[180px] sm:min-h-[200px]",
    iconClass: "text-bronze",
    rankBgClass: "bg-bronze text-paper",
  },
};

function PodiumStep({ rank, row, isMe, masked, team, onClick }: PodiumStepProps) {
  const theme = STEP_THEME[rank];
  const Icon = theme.icon;

  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        "relative w-full overflow-hidden rounded-sm border-2",
        "shadow-[0_3px_0_var(--paper-edge)] hover:-translate-y-0.5 transition-transform",
        "text-left",
        theme.container,
        theme.height
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-24 bg-gradient-to-b pointer-events-none",
          theme.accent
        )}
      />
      {rank === 1 && (
        <div className='absolute inset-0 wc26-gold-shimmer pointer-events-none' />
      )}
      <div className='relative p-4 flex flex-col h-full gap-3'>
        <div className='flex items-center justify-between gap-2'>
          <span
            className={cn(
              "font-display tracking-widest text-xs uppercase px-2 py-0.5 rounded-sm",
              theme.rankBgClass
            )}
          >
            {theme.label}
          </span>
          <Icon className={cn("h-7 w-7", theme.iconClass)} strokeWidth={1.5} />
        </div>

        <div className='flex items-baseline gap-2'>
          <span className='font-display text-5xl tracking-widest leading-none text-ink'>
            #{rank}
          </span>
          {isMe && (
            <span className='font-display tracking-widest uppercase text-[10px] text-crimson'>
              you
            </span>
          )}
        </div>

        <div className='font-display text-2xl tracking-wide truncate'>
          {row.display_name}
        </div>

        <div className='flex items-baseline gap-2 mt-auto'>
          <span className='font-mono text-3xl font-bold tabular-nums'>
            {masked ? "••" : row.total}
          </span>
          <span className='font-display tracking-widest uppercase text-[10px] text-ink-soft'>
            pts
          </span>
          {!masked && row.exact_predictions > 0 && (
            <span
              className='ml-auto font-mono text-[11px] text-mustard tabular-nums'
              title='Exact predictions — tiebreaker'
            >
              {row.exact_predictions} exact
            </span>
          )}
        </div>

        {team || row.champion_pick_team_name ? (
          <div className='flex items-center gap-2 pt-2 border-t border-paper-edge/60'>
            {team && (
              <TeamFlag
                crest={team.team_crest}
                code={team.team_code}
                name={team.team_name}
                size='sm'
              />
            )}
            <div className='min-w-0'>
              <div className='font-display tracking-widest text-[9px] uppercase text-ink-soft leading-tight'>
                Champion pick
              </div>
              <div className='font-display tracking-wide text-sm truncate leading-tight'>
                {team?.team_name ?? row.champion_pick_team_name}
              </div>
            </div>
          </div>
        ) : (
          <div className='pt-2 border-t border-paper-edge/60 text-[10px] text-ink-soft uppercase tracking-widest'>
            No champion pick
          </div>
        )}
      </div>
    </button>
  );
}

export function Podium({
  rows,
  currentUserId,
  masked,
  teamsById,
  onSelectUser,
}: PodiumProps) {
  const [first, second, third] = rows;
  if (!first) return null;

  return (
    <div className='space-y-3'>
      <h2 className='tournament-title text-2xl text-ink'>
        On the <span className='text-mustard'>Podium</span>
      </h2>
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 sm:items-end'>
        {/* Visual order on >=sm: silver | gold | bronze */}
        {second ? (
          <div className='order-2 sm:order-1'>
            <PodiumStep
              rank={2}
              row={second}
              isMe={second.user_id === currentUserId}
              masked={masked}
              team={
                second.champion_pick_team_id
                  ? teamsById.get(second.champion_pick_team_id) ?? null
                  : null
              }
              onClick={() => onSelectUser(second.user_id)}
            />
          </div>
        ) : (
          <div className='order-2 sm:order-1' />
        )}
        <div className='order-1 sm:order-2'>
          <PodiumStep
            rank={1}
            row={first}
            isMe={first.user_id === currentUserId}
            masked={masked}
            team={
              first.champion_pick_team_id
                ? teamsById.get(first.champion_pick_team_id) ?? null
                : null
            }
            onClick={() => onSelectUser(first.user_id)}
          />
        </div>
        {third ? (
          <div className='order-3'>
            <PodiumStep
              rank={3}
              row={third}
              isMe={third.user_id === currentUserId}
              masked={masked}
              team={
                third.champion_pick_team_id
                  ? teamsById.get(third.champion_pick_team_id) ?? null
                  : null
              }
              onClick={() => onSelectUser(third.user_id)}
            />
          </div>
        ) : (
          <div className='order-3' />
        )}
      </div>
    </div>
  );
}
