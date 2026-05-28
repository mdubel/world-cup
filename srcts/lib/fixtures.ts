import type { Match, MatchStage, Team } from "./types";

const KNOCKOUT_STAGES: ReadonlySet<string> = new Set([
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
]);

export const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Group Stage",
  LAST_32: "Round of 32",
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals",
  SEMI_FINALS: "Semi-finals",
  THIRD_PLACE: "Third place",
  FINAL: "Final",
};

const STAGE_ORDER: Record<string, number> = {
  GROUP_STAGE: 0,
  LAST_32: 1,
  LAST_16: 2,
  QUARTER_FINALS: 3,
  SEMI_FINALS: 4,
  THIRD_PLACE: 5,
  FINAL: 6,
};

export function isKnockoutStage(stage: MatchStage | string | null): boolean {
  if (!stage) return false;
  return KNOCKOUT_STAGES.has(stage);
}

export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return "";
  return STAGE_LABELS[stage] ?? stage;
}

export function compareStages(a: string, b: string): number {
  return (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99);
}

function isColumnar(value: unknown): value is Record<string, unknown[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  return keys.every((k) => Array.isArray(obj[k]));
}

export function columnarToRows<T = Record<string, unknown>>(
  data: unknown
): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!isColumnar(data)) return [];
  const cols = Object.keys(data);
  const n = cols.length > 0 ? data[cols[0]].length : 0;
  const rows: T[] = [];
  for (let i = 0; i < n; i++) {
    const r: Record<string, unknown> = {};
    for (const c of cols) {
      r[c] = data[c][i];
    }
    rows.push(r as T);
  }
  return rows;
}

function normalizeNullable<T>(v: unknown, fallback: T | null = null): T | null {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string" && v === "NA") return fallback;
  if (typeof v === "number" && Number.isNaN(v)) return fallback;
  return v as T;
}

export function rowsToMatches(rows: Record<string, unknown>[]): Match[] {
  return rows.map((r) => ({
    match_id: String(r.match_id ?? ""),
    stage: String(r.stage ?? "") as MatchStage,
    group: normalizeNullable<string>(r.group),
    kickoff_utc: String(r.kickoff_utc ?? ""),
    home_team_id: normalizeNullable<string>(r.home_team_id),
    home_team_name: normalizeNullable<string>(r.home_team_name),
    home_team_code: normalizeNullable<string>(r.home_team_code),
    home_team_crest: normalizeNullable<string>(r.home_team_crest),
    away_team_id: normalizeNullable<string>(r.away_team_id),
    away_team_name: normalizeNullable<string>(r.away_team_name),
    away_team_code: normalizeNullable<string>(r.away_team_code),
    away_team_crest: normalizeNullable<string>(r.away_team_crest),
    status: String(r.status ?? ""),
    home_score_ft: normalizeNullable<number>(r.home_score_ft),
    away_score_ft: normalizeNullable<number>(r.away_score_ft),
    home_score_et: normalizeNullable<number>(r.home_score_et),
    away_score_et: normalizeNullable<number>(r.away_score_et),
    home_score_pk: normalizeNullable<number>(r.home_score_pk),
    away_score_pk: normalizeNullable<number>(r.away_score_pk),
    winner: normalizeNullable<"HOME" | "AWAY" | "DRAW">(r.winner),
    pk_winner: normalizeNullable<"HOME" | "AWAY">(r.pk_winner),
    last_api_update: normalizeNullable<string>(r.last_api_update),
  }));
}

export function rowsToTeams(rows: Record<string, unknown>[]): Team[] {
  return rows.map((r) => ({
    team_id: String(r.team_id ?? ""),
    team_name: String(r.team_name ?? ""),
    team_code: normalizeNullable<string>(r.team_code),
    team_crest: normalizeNullable<string>(r.team_crest),
  }));
}

export function sortByKickoff(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const stageDiff = compareStages(a.stage, b.stage);
    if (stageDiff !== 0) return stageDiff;
    return a.kickoff_utc.localeCompare(b.kickoff_utc);
  });
}

export function groupByDay(
  matches: Match[],
  tz?: string
): Map<string, Match[]> {
  const out = new Map<string, Match[]>();
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  for (const m of matches) {
    const d = new Date(m.kickoff_utc);
    const key = isNaN(d.getTime()) ? "—" : fmt.format(d);
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(m);
  }
  return out;
}

export function partitionByStage(matches: Match[]): Map<string, Match[]> {
  const out = new Map<string, Match[]>();
  for (const m of matches) {
    if (!out.has(m.stage)) out.set(m.stage, []);
    out.get(m.stage)!.push(m);
  }
  return out;
}

export function isFinal(m: Match): boolean {
  return m.status === "FINISHED";
}

export function hasResult(m: Match): boolean {
  return (
    m.status === "FINISHED" ||
    m.status === "IN_PLAY" ||
    m.status === "PAUSED" ||
    m.home_score_ft !== null
  );
}

export function teamsKnown(m: Match): boolean {
  return Boolean(m.home_team_id && m.away_team_id);
}

export function actualAdvancingSide(m: Match): "HOME" | "AWAY" | null {
  if (m.status !== "FINISHED") return null;
  if (m.pk_winner) return m.pk_winner;
  if (m.winner === "HOME" || m.winner === "AWAY") return m.winner;
  return null;
}
