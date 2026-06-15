export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED"
  | string;

export type MatchStage =
  | "GROUP_STAGE"
  | "LAST_32"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "THIRD_PLACE"
  | "FINAL"
  | string;

export type Side = "HOME" | "AWAY";
export type Pick = "HOME" | "AWAY" | "DRAW";
export type TrackerState = "WATCH_LATER" | "WATCHED" | "SKIP";

export interface Match {
  match_id: string;
  stage: MatchStage;
  group: string | null;
  kickoff_utc: string;
  home_team_id: string | null;
  home_team_name: string | null;
  home_team_code: string | null;
  home_team_crest: string | null;
  away_team_id: string | null;
  away_team_name: string | null;
  away_team_code: string | null;
  away_team_crest: string | null;
  status: MatchStatus;
  home_score_ft: number | null;
  away_score_ft: number | null;
  home_score_et: number | null;
  away_score_et: number | null;
  home_score_pk: number | null;
  away_score_pk: number | null;
  winner: "HOME" | "AWAY" | "DRAW" | null;
  pk_winner: Side | null;
  last_api_update: string | null;
}

export interface Team {
  team_id: string;
  team_name: string;
  team_code: string | null;
  team_crest: string | null;
}

export interface FixturesPayload {
  rows: Record<string, unknown[]> | unknown[];
  teams: Record<string, unknown[]> | unknown[];
  tournament_lock_utc: string | null;
  server_now_utc: string;
}

export interface Prediction {
  pick: Pick;
  advancing_team: Side | null;
  submitted_at_utc: string;
  updated_at_utc: string;
}

export type PredictionsMap = Record<string, Prediction>;
export type TrackerMap = Record<string, TrackerState>;

export interface TournamentPick {
  team_id: string | null;
  team_name?: string | null;
  submitted_at_utc?: string;
  updated_at_utc?: string;
}

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  total: number;
  group_pts: number;
  knockout_pts: number;
  tournament_pts: number;
  /** Count of predictions that hit the maximum points (3 in group, 4 in KO). */
  exact_predictions: number;
  champion_pick_team_id: string | null;
  champion_pick_team_name: string | null;
}

export interface LeaderboardPayload {
  rows: Record<string, unknown[]> | LeaderboardRow[];
  computed_at_utc: string;
}

export interface LeaderboardDetailRow {
  match_id: string;
  stage: MatchStage;
  pick: Pick;
  advancing_team: Side | null;
  winner_actual: "HOME" | "AWAY" | "DRAW" | null;
  advancing_actual: Side | null;
  points: number;
}

export interface LeaderboardDetail {
  user_id: string | null;
  group_pts: number;
  knockout_pts: number;
  tournament_pts: number;
  total: number;
  exact_predictions: number;
  per_match: Record<string, unknown[]> | LeaderboardDetailRow[];
  tournament_pick: { team_id: string; team_name: string } | null;
}

export interface CurrentUser {
  id: string;
  display_name: string;
  is_dev: boolean;
  is_admin: boolean;
  tz: string | null;
  theme: "light" | "dark" | null;
  favorite_team_id: string | null;
}

export type AdminCategory = "active" | "dormant" | "inactive";

export interface AdminUserRow {
  user_id: string;
  display_name: string;
  first_seen_utc: string;
  last_seen_utc: string;
  tz: string | null;
  theme: string | null;
  favorite_team_id: string | null;
  favorite_team_name: string | null;
  group_picks: number;
  knockout_picks: number;
  picks_kicked_off: number;
  tracker_watch_later: number;
  tracker_watched: number;
  tracker_skipped: number;
  champion_pick_team_id: string | null;
  champion_pick_team_name: string | null;
  champion_pick_at_utc: string | null;
  category: AdminCategory;
}

export interface AdminStats {
  total_users: number;
  users: AdminUserRow[];
  counts: {
    with_tracker: number;
    with_group_picks: number;
    with_knockout_picks: number;
    with_favorite: number;
    with_champion: number;
    active: number;
    dormant: number;
    inactive: number;
  };
  kicked_off_count: number;
  computed_at_utc: string;
  error?: string;
}

export type MatchOutcome = "HOME" | "DRAW" | "AWAY";

export interface GameStatsScorer {
  user_id: string;
  display_name: string;
  pick: MatchOutcome | null;
  advancing_team: "HOME" | "AWAY" | null;
  points: number;
}

export interface GameStatsLeaderboardRow {
  rank: number;
  display_name: string;
  /** Cumulative pool points after this match (base only — no champion bonus). */
  total: number;
  /** Points gained on THIS exact match. */
  delta: number;
}

export interface GameStatsEntry {
  match_id: string;
  outcome: MatchOutcome | null;
  picks_by_choice: Record<MatchOutcome, number>;
  pickers_by_choice: Record<MatchOutcome, string[]>;
  scorers: GameStatsScorer[];
  /**
   * Pool standings AFTER this match — base points only (group + knockout).
   * Sorted by total desc, with the user who jumped most on this match
   * floating above ties.
   */
  leaderboard_after: GameStatsLeaderboardRow[];
  total_picks: number;
  n_scorers: number;
  total_points: number;
  /** Pickers who picked the actual outcome — the obviousness numerator. */
  winners_count: number;
  /** winners_count / total_picks, in [0, 1]. */
  winners_fraction: number;
  /** Shannon entropy over {HOME, DRAW, AWAY} normalised by log(3) → [0, 1]. */
  pick_entropy: number;
}

export interface GameStatsTimelineEntry {
  match_id: string;
  kickoff_utc: string;
  total_points: number;
  n_scorers: number;
  total_picks: number;
  top_scorers_label: string;
}

export interface GameStats {
  games: Record<string, GameStatsEntry>;
  superlatives: {
    most_obvious: string | null;
    most_surprising: string | null;
    biggest_split: string | null;
  };
  points_timeline: GameStatsTimelineEntry[];
  computed_at_utc: string;
}

export interface SetTrackerPayload {
  match_id: string;
  /**
   * `null` means "clear this match's watch-state entry" — the opposite of
   * setting one of the three concrete values. The button row uses this to
   * un-toggle an already-active state back to the default.
   */
  state: TrackerState | null;
}

export interface SetPredictionPayload {
  match_id: string;
  pick: Pick;
  advancing_team: Side | null;
}

export interface SetTournamentPickPayload {
  team_id: string;
}

export type ServerResultMessage =
  | { ok: true; [k: string]: unknown }
  | { ok: false; reason: string; [k: string]: unknown };
