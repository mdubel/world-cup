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
  tz: string | null;
  theme: "light" | "dark" | null;
  favorite_team_id: string | null;
}

export interface SetTrackerPayload {
  match_id: string;
  state: TrackerState;
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
