import type { Match } from "./types";

export interface StandingsRow {
  team_id: string;
  team_name: string;
  team_code: string | null;
  team_crest: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

export type QualificationState =
  | "advancing"      // top 2 — through to next round
  | "playoff"        // 3rd — possibly through (best 8 of 12 third-placed teams in 2026)
  | "eliminated"     // 4th — out
  | "neutral";       // not enough info yet (no matches played)

export function computeGroupStandings(matches: Match[]): StandingsRow[] {
  const byTeam = new Map<string, StandingsRow>();

  function ensure(
    id: string | null,
    name: string | null,
    code: string | null,
    crest: string | null
  ) {
    if (!id) return null;
    const existing = byTeam.get(id);
    if (existing) {
      // Backfill metadata from later matches if it was missing earlier.
      if (!existing.team_crest && crest) existing.team_crest = crest;
      if (!existing.team_code && code) existing.team_code = code;
      return existing;
    }
    const row: StandingsRow = {
      team_id: id,
      team_name: name ?? id,
      team_code: code,
      team_crest: crest,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_diff: 0,
      points: 0,
    };
    byTeam.set(id, row);
    return row;
  }

  // First pass: register every team in this group, even if they haven't played
  // yet, so the card shows all four rows from kickoff onwards.
  for (const m of matches) {
    ensure(m.home_team_id, m.home_team_name, m.home_team_code, m.home_team_crest);
    ensure(m.away_team_id, m.away_team_name, m.away_team_code, m.away_team_crest);
  }

  // Second pass: accumulate results from finished matches.
  for (const m of matches) {
    if (m.status !== "FINISHED") continue;
    if (m.home_score_ft === null || m.away_score_ft === null) continue;
    const h = byTeam.get(m.home_team_id ?? "");
    const a = byTeam.get(m.away_team_id ?? "");
    if (!h || !a) continue;

    h.played++;
    a.played++;
    h.goals_for += m.home_score_ft;
    h.goals_against += m.away_score_ft;
    a.goals_for += m.away_score_ft;
    a.goals_against += m.home_score_ft;

    if (m.winner === "HOME") {
      h.won++;
      a.lost++;
      h.points += 3;
    } else if (m.winner === "AWAY") {
      a.won++;
      h.lost++;
      a.points += 3;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
    h.goal_diff = h.goals_for - h.goals_against;
    a.goal_diff = a.goals_for - a.goals_against;
  }

  return [...byTeam.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.goal_diff !== x.goal_diff) return y.goal_diff - x.goal_diff;
    if (y.goals_for !== x.goals_for) return y.goals_for - x.goals_for;
    return x.team_name.localeCompare(y.team_name);
  });
}

export function qualificationState(
  rank: number,
  anyMatchesPlayed: boolean
): QualificationState {
  if (!anyMatchesPlayed) return "neutral";
  if (rank <= 2) return "advancing";
  if (rank === 3) return "playoff";
  return "eliminated";
}

export function groupMatchesByGroup(matches: Match[]): Map<string, Match[]> {
  const out = new Map<string, Match[]>();
  for (const m of matches) {
    if (m.stage !== "GROUP_STAGE" || !m.group) continue;
    if (!out.has(m.group)) out.set(m.group, []);
    out.get(m.group)!.push(m);
  }
  // Sort matches within a group chronologically.
  for (const arr of out.values()) {
    arr.sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc));
  }
  return out;
}

export function groupSortKey(group: string): string {
  // "GROUP_A" → "A", "GROUP_AA" → "AA"; sorts alphabetically.
  return group.replace(/^GROUP_/, "");
}

export function groupShortLabel(group: string): string {
  return group.replace(/^GROUP_/, "");
}

export interface ThirdPlaceRow extends StandingsRow {
  group: string;
  group_label: string;
  any_matches_played: boolean;
}

/**
 * Cross-group ranking of the 3rd-placed team in every group. In WC 2026 the
 * top 8 of these 12 teams qualify directly for the round of 32 — no playoff,
 * they just join the bracket. Tiebreakers mirror FIFA's published rules as
 * close as we can with the data we have: points, goal difference, goals
 * scored. (Fair-play points and drawing of lots are out of reach.)
 *
 * Groups whose matches the user has marked WATCH_LATER are dropped from the
 * returned list — including them would reveal the in-group ordering. The
 * caller can compare returned.length to expected group count to show a
 * "some groups hidden" hint.
 */
export function computeThirdPlaceTable(
  groups: Array<[string, Match[]]>,
  groupTainted: Map<string, boolean>
): ThirdPlaceRow[] {
  const rows: ThirdPlaceRow[] = [];
  for (const [group, ms] of groups) {
    if (groupTainted.get(group)) continue;
    const standings = computeGroupStandings(ms);
    const third = standings[2];
    if (!third) continue;
    rows.push({
      ...third,
      group,
      group_label: groupShortLabel(group),
      any_matches_played: standings.some((r) => r.played > 0),
    });
  }
  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.goal_diff !== x.goal_diff) return y.goal_diff - x.goal_diff;
    if (y.goals_for !== x.goals_for) return y.goals_for - x.goals_for;
    return x.team_name.localeCompare(y.team_name);
  });
  return rows;
}

// Top 8 of the 12 third-placed teams advance directly in WC 2026.
export const THIRD_PLACE_ADVANCING_SLOTS = 8;
