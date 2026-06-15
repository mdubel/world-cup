import { EmptyState } from "@/components/EmptyState";
import { TeamFlag } from "@/components/TeamFlag";
import { Card, CardContent } from "@/components/ui/card";
import { useAppData } from "@/contexts/AppData";
import { useUserTz } from "@/contexts/Timezone";
import { stageLabel } from "@/lib/fixtures";
import { formatLocalDate } from "@/lib/time";
import type {
  GameStatsEntry,
  GameStatsScorer,
  GameStatsTimelineEntry,
  Match,
  MatchOutcome,
  Team,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";

const OUTCOME_COLOR: Record<MatchOutcome, string> = {
  HOME: "bg-crimson",
  DRAW: "bg-mustard",
  AWAY: "bg-pitch",
};

const OUTCOME_LABEL: Record<MatchOutcome, string> = {
  HOME: "home",
  DRAW: "draw",
  AWAY: "away",
};

// Context-aware label: when we know which match this is, render team
// codes (KOR / CZE) instead of generic HOME / AWAY so the user can scan
// who voted for whom without re-reading the match line. DRAW always
// renders as "Draw" since there's no team behind it. Falls back to the
// generic outcome label when the match isn't available (e.g. TBD slots).
function outcomeLabel(outcome: MatchOutcome, match: Match | null): string {
  if (outcome === "DRAW") return "Draw";
  if (!match) return OUTCOME_LABEL[outcome];
  if (outcome === "HOME") {
    return match.home_team_code ?? match.home_team_name ?? "Home";
  }
  return match.away_team_code ?? match.away_team_name ?? "Away";
}

// ------------------------------------------------------------ MatchHeadline

function MatchHeadline({ match }: { match: Match | null }) {
  if (!match) {
    return (
      <span className='font-display tracking-wide text-sm text-ink-soft'>
        Unknown match
      </span>
    );
  }
  return (
    <div className='flex items-center gap-2 min-w-0'>
      <TeamFlag
        crest={match.home_team_crest}
        code={match.home_team_code}
        name={match.home_team_name}
        size='xs'
      />
      <span className='font-display tracking-wide text-sm truncate'>
        {match.home_team_code ?? match.home_team_name ?? "TBD"}
        <span className='text-ink-soft mx-1'>vs</span>
        {match.away_team_code ?? match.away_team_name ?? "TBD"}
      </span>
      <TeamFlag
        crest={match.away_team_crest}
        code={match.away_team_code}
        name={match.away_team_name}
        size='xs'
      />
    </div>
  );
}

// ------------------------------------------------------------ DistributionBar

function DistributionBar({
  entry,
  outcome,
  match,
}: {
  entry: GameStatsEntry;
  outcome: MatchOutcome | null;
  match?: Match | null;
}) {
  const total = entry.total_picks;
  if (total === 0) {
    return <span className='text-[10px] text-ink-soft'>no picks</span>;
  }
  const segs: { key: MatchOutcome; count: number; label: string }[] = (
    ["HOME", "DRAW", "AWAY"] as const
  ).map((k) => ({
    key: k,
    count: entry.picks_by_choice[k] ?? 0,
    label: `${entry.picks_by_choice[k] ?? 0} picked ${outcomeLabel(k, match ?? null)}`,
  }));

  return (
    <div className='flex items-center gap-2 min-w-0'>
      <div className='h-3 w-full max-w-[200px] flex overflow-hidden rounded-sm border border-paper-edge'>
        {segs.map((s) => {
          if (s.count === 0) return null;
          const pct = (s.count / total) * 100;
          const won = outcome === s.key;
          return (
            <div
              key={s.key}
              className={cn(OUTCOME_COLOR[s.key], !won && "opacity-60")}
              style={{ width: `${pct}%` }}
              title={`${s.label}${won ? " — actual outcome" : ""}`}
            />
          );
        })}
      </div>
      <span className='font-mono text-[10px] text-ink-soft tabular-nums whitespace-nowrap'>
        {entry.picks_by_choice.HOME}/{entry.picks_by_choice.DRAW}/
        {entry.picks_by_choice.AWAY}
      </span>
    </div>
  );
}

// ------------------------------------------------------------ SuperlativeCard

interface SuperlativeCardProps {
  label: string;
  hint: string;
  accent: "pitch" | "crimson" | "mustard";
  entry: GameStatsEntry | null;
  match: Match | null;
  metricText: string;
}

function SuperlativeCard({
  label,
  hint,
  accent,
  entry,
  match,
  metricText,
}: SuperlativeCardProps) {
  const ringClass: Record<typeof accent, string> = {
    pitch: "border-pitch/60 ring-2 ring-pitch/15",
    crimson: "border-crimson/60 ring-2 ring-crimson/15",
    mustard: "border-mustard/60 ring-2 ring-mustard/15",
  };

  return (
    <Card className={cn("bg-paper", ringClass[accent])}>
      <CardContent className='p-4 space-y-2'>
        <div className='flex items-baseline justify-between gap-2'>
          <p className='font-display tracking-widest uppercase text-[10px] text-ink-soft'>
            {label}
          </p>
          <span
            className={cn(
              "font-mono text-xs font-bold",
              accent === "pitch" && "text-pitch",
              accent === "crimson" && "text-crimson",
              accent === "mustard" && "text-mustard"
            )}
          >
            {metricText}
          </span>
        </div>
        {entry ? (
          <>
            <MatchHeadline match={match} />
            <DistributionBar entry={entry} outcome={entry.outcome} match={match} />
            <p className='text-[10px] text-ink-soft leading-snug'>{hint}</p>
          </>
        ) : (
          <p className='text-xs text-ink-soft'>
            Waiting for a finished match.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------ Timeline chart

function PointsTimelineChart({
  timeline,
  matchById,
  tz,
}: {
  timeline: GameStatsTimelineEntry[];
  matchById: Map<string, Match>;
  tz: string;
}) {
  if (timeline.length === 0) return null;
  const max = Math.max(1, ...timeline.map((t) => t.total_points));
  // viewBox-based — width auto-fills via CSS. 4px gap between bars.
  const BAR_W = 18;
  const GAP = 4;
  const CHART_H = 120;
  const LABEL_H = 18;
  const totalW = timeline.length * (BAR_W + GAP) - GAP;

  return (
    <Card className='border-paper-edge bg-paper'>
      <CardContent className='p-4 space-y-3'>
        <div className='flex items-baseline justify-between flex-wrap gap-2'>
          <p className='font-display tracking-widest uppercase text-xs text-ink'>
            Points per match
          </p>
          <span className='text-[10px] text-ink-soft font-mono'>
            chronological · hover a bar for details
          </span>
        </div>
        <div className='overflow-x-auto -mx-4 px-4'>
          <svg
            viewBox={`0 0 ${Math.max(totalW, 1)} ${CHART_H + LABEL_H}`}
            width={Math.max(totalW, 1)}
            height={CHART_H + LABEL_H}
            preserveAspectRatio='xMinYMin meet'
            role='img'
            aria-label='Points awarded per match, chronological'
          >
            {timeline.map((t, idx) => {
              const x = idx * (BAR_W + GAP);
              const h = (t.total_points / max) * CHART_H;
              const y = CHART_H - h;
              const m = matchById.get(t.match_id) ?? null;
              const matchLabel = m
                ? `${m.home_team_code ?? m.home_team_name ?? "?"} v ${m.away_team_code ?? m.away_team_name ?? "?"}`
                : t.match_id;
              const tooltip = [
                matchLabel,
                formatLocalDate(t.kickoff_utc, tz),
                `${t.total_points} pts across ${t.n_scorers} of ${t.total_picks} pickers`,
                t.top_scorers_label && `Top: ${t.top_scorers_label}`,
              ]
                .filter(Boolean)
                .join("\n");
              return (
                <g key={t.match_id}>
                  <rect
                    x={x}
                    y={y}
                    width={BAR_W}
                    height={Math.max(h, 1)}
                    className='fill-pitch hover:fill-mustard transition-colors'
                  >
                    <title>{tooltip}</title>
                  </rect>
                  <text
                    x={x + BAR_W / 2}
                    y={CHART_H + LABEL_H - 4}
                    textAnchor='middle'
                    className='fill-ink-soft font-mono'
                    style={{ fontSize: "8px" }}
                  >
                    {m?.home_team_code ?? ""}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------ GameRow

function GameRow({
  entry,
  match,
  isHighlighted,
}: {
  entry: GameStatsEntry;
  match: Match | null;
  isHighlighted?: "obvious" | "surprising" | "split" | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const highlightLabel = isHighlighted
    ? {
        obvious: "Most obvious",
        surprising: "Most surprising",
        split: "Biggest split",
      }[isHighlighted]
    : null;

  return (
    <div className='border-t border-paper-edge/40'>
      <button
        type='button'
        onClick={() => setExpanded((e) => !e)}
        className='w-full flex items-center gap-3 px-3 py-2.5 hover:bg-paper-soft transition-colors text-left'
      >
        <div className='flex-1 min-w-0 space-y-1'>
          <div className='flex items-center gap-2 flex-wrap'>
            <MatchHeadline match={match} />
            {match?.stage && (
              <span className='font-display tracking-widest uppercase text-[9px] text-crimson'>
                {stageLabel(match.stage)}
              </span>
            )}
            {highlightLabel && (
              <span className='font-display tracking-widest uppercase text-[9px] px-1.5 py-0.5 rounded-sm bg-ink text-paper'>
                {highlightLabel}
              </span>
            )}
          </div>
          <DistributionBar entry={entry} outcome={entry.outcome} match={match} />
        </div>
        <div className='text-right font-mono text-xs whitespace-nowrap'>
          <div className='font-bold text-ink'>{entry.total_points} pts</div>
          <div className='text-[10px] text-ink-soft'>
            {entry.n_scorers}/{entry.total_picks} scored
          </div>
        </div>
        {expanded ? (
          <ChevronUp className='h-4 w-4 text-ink-soft shrink-0' />
        ) : (
          <ChevronDown className='h-4 w-4 text-ink-soft shrink-0' />
        )}
      </button>

      {expanded && (
        <div className='px-3 pb-3 pt-1 grid sm:grid-cols-2 gap-4 bg-paper-soft border-t border-paper-edge/40'>
          {/* Pickers per choice */}
          <div className='space-y-2'>
            <p className='font-display tracking-widest uppercase text-[10px] text-ink-soft'>
              Picks by side
            </p>
            {(["HOME", "DRAW", "AWAY"] as const).map((k) => {
              const names = entry.pickers_by_choice[k] ?? [];
              if (names.length === 0) return null;
              const won = entry.outcome === k;
              return (
                <div key={k} className='text-xs'>
                  <div className='flex items-center gap-1.5'>
                    <span
                      className={cn(
                        "w-2 h-3 rounded-sm",
                        OUTCOME_COLOR[k],
                        !won && "opacity-60"
                      )}
                    />
                    <span className='font-display tracking-widest uppercase text-[10px] text-ink-soft'>
                      {outcomeLabel(k, match)} · {names.length}
                      {won && (
                        <span className='ml-1 text-pitch'>· actual</span>
                      )}
                    </span>
                  </div>
                  <p className='text-[11px] text-ink leading-relaxed pl-3.5'>
                    {names.join(", ")}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Scorers */}
          <div className='space-y-2'>
            <p className='font-display tracking-widest uppercase text-[10px] text-ink-soft'>
              Scorers ({entry.n_scorers})
            </p>
            {entry.scorers.length === 0 ? (
              <p className='text-[11px] text-ink-soft italic'>Nobody scored.</p>
            ) : (
              <ul className='space-y-0.5'>
                {entry.scorers.map((s: GameStatsScorer, idx) => (
                  <li
                    key={`${s.user_id}-${idx}`}
                    className='flex items-baseline justify-between gap-2 text-[11px]'
                  >
                    <span className='font-display tracking-wide truncate'>
                      {s.display_name}
                    </span>
                    <span className='font-mono text-ink-soft tabular-nums whitespace-nowrap'>
                      +{s.points}
                      {s.pick && (
                        <span className='ml-1 text-[9px] uppercase'>
                          {outcomeLabel(s.pick, match)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ StatsTab

type SortKey = "chronological" | "obvious" | "surprising" | "split";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "chronological", label: "By date" },
  { key: "obvious", label: "Most obvious first" },
  { key: "surprising", label: "Most surprising first" },
  { key: "split", label: "Biggest split first" },
];

export function StatsTab() {
  const {
    fixtures: { matches, loaded: fxLoaded },
    gameStats: stats,
    gameStatsLoaded: loaded,
  } = useAppData();
  const tz = useUserTz();
  const [sort, setSort] = useState<SortKey>("chronological");

  const matchById = useMemo(() => {
    const m = new Map<string, Match>();
    for (const x of matches) m.set(x.match_id, x);
    return m;
  }, [matches]);

  const teamsById = useMemo(() => {
    // teams index isn't needed here directly but useful if we extend.
    return new Map<string, Team>();
  }, []);
  void teamsById;

  const sortedGames = useMemo(() => {
    if (!stats) return [];
    const entries = Object.values(stats.games);
    switch (sort) {
      case "obvious":
        return [...entries].sort(
          (a, b) => b.winners_fraction - a.winners_fraction
        );
      case "surprising":
        return [...entries].sort(
          (a, b) => a.winners_fraction - b.winners_fraction
        );
      case "split":
        return [...entries].sort((a, b) => b.pick_entropy - a.pick_entropy);
      case "chronological":
      default:
        return [...entries].sort((a, b) => {
          const ma = matchById.get(a.match_id);
          const mb = matchById.get(b.match_id);
          return (ma?.kickoff_utc ?? "").localeCompare(mb?.kickoff_utc ?? "");
        });
    }
  }, [stats, sort, matchById]);

  if (!fxLoaded || !loaded) {
    return <EmptyState title='Loading stats…' />;
  }
  // Server returns {error: "not_authorized"} when the user isn't on the
  // admin allowlist — shouldn't happen because the tab is hidden in that
  // case, but render a friendly message just in case the websocket gets
  // poked directly.
  if ((stats as unknown as { error?: string })?.error === "not_authorized") {
    return (
      <EmptyState
        title='Not authorised'
        description='Stats are in admin-only preview while we test.'
      />
    );
  }
  if (!stats || Object.keys(stats.games).length === 0) {
    return (
      <EmptyState
        title='No finished matches yet'
        description='Stats appear once the first group game wraps up.'
      />
    );
  }

  const sl = stats.superlatives;
  const obvious = sl.most_obvious ? stats.games[sl.most_obvious] ?? null : null;
  const surprising = sl.most_surprising
    ? stats.games[sl.most_surprising] ?? null
    : null;
  const split = sl.biggest_split ? stats.games[sl.biggest_split] ?? null : null;

  const fmtPct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className='space-y-5'>
      <div className='flex items-baseline gap-3 flex-wrap'>
        <h2 className='tournament-title text-2xl text-ink'>
          Pool <span className='text-mustard'>Stats</span>
        </h2>
        <span
          className='inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-crimson'
          title='Match outcomes and per-game scoring are shown here regardless of watch-later state.'
        >
          <EyeOff className='h-3 w-3' /> Spoilers ahead
        </span>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <SuperlativeCard
          label='Most obvious'
          hint='Highest share of pickers landed on the actual outcome.'
          accent='pitch'
          entry={obvious}
          match={obvious ? matchById.get(obvious.match_id) ?? null : null}
          metricText={obvious ? fmtPct(obvious.winners_fraction) : "—"}
        />
        <SuperlativeCard
          label='Most surprising'
          hint='Fewest pickers got the actual outcome — biggest collective miss.'
          accent='crimson'
          entry={surprising}
          match={
            surprising ? matchById.get(surprising.match_id) ?? null : null
          }
          metricText={surprising ? fmtPct(surprising.winners_fraction) : "—"}
        />
        <SuperlativeCard
          label='Biggest split'
          hint='Picks were spread most evenly across HOME / DRAW / AWAY.'
          accent='mustard'
          entry={split}
          match={split ? matchById.get(split.match_id) ?? null : null}
          metricText={split ? fmtPct(split.pick_entropy) : "—"}
        />
      </div>

      <PointsTimelineChart
        timeline={stats.points_timeline}
        matchById={matchById}
        tz={tz}
      />

      <Card className='border-paper-edge bg-paper'>
        <CardContent className='p-0'>
          <div className='flex flex-wrap items-center gap-2 px-3 py-2 border-b border-paper-edge/60'>
            <p className='font-display tracking-widest uppercase text-xs text-ink mr-2'>
              All finished matches
            </p>
            <div className='flex flex-wrap gap-1 ml-auto'>
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type='button'
                  onClick={() => setSort(o.key)}
                  className={cn(
                    "px-2 py-1 rounded-sm border-2 text-[10px] font-display tracking-wider uppercase transition-colors",
                    sort === o.key
                      ? "border-ink bg-ink text-paper"
                      : "border-paper-edge text-ink-soft hover:bg-paper-soft"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            {sortedGames.map((entry) => {
              const m = matchById.get(entry.match_id) ?? null;
              const highlight: "obvious" | "surprising" | "split" | null =
                entry.match_id === sl.most_obvious
                  ? "obvious"
                  : entry.match_id === sl.most_surprising
                    ? "surprising"
                    : entry.match_id === sl.biggest_split
                      ? "split"
                      : null;
              return (
                <GameRow
                  key={entry.match_id}
                  entry={entry}
                  match={m}
                  isHighlighted={highlight}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className='text-[10px] uppercase tracking-widest text-ink-soft text-center font-display'>
        Computed {stats.computed_at_utc}
      </p>
    </div>
  );
}
