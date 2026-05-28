empty_predictions_df <- function() {
  data.frame(
    match_id = character(),
    pick = character(),
    advancing_team = character(),
    submitted_at_utc = as.POSIXct(character(), tz = "UTC"),
    updated_at_utc = as.POSIXct(character(), tz = "UTC"),
    stringsAsFactors = FALSE
  )
}

predictions_pin_for <- function(uid) {
  pin_name(paste0("predictions_", safe_user_pin_suffix(uid)))
}

read_predictions <- function(uid) {
  pin_read_or(predictions_pin_for(uid), empty_predictions_df())
}

predictions_to_payload <- function(df) {
  if (is.null(df) || nrow(df) == 0) {
    return(setNames(list(), character(0)))
  }
  out <- list()
  for (i in seq_len(nrow(df))) {
    row <- df[i, , drop = FALSE]
    out[[row$match_id]] <- list(
      pick = row$pick,
      advancing_team = if (is.na(row$advancing_team)) NULL else row$advancing_team,
      submitted_at_utc = iso_utc(row$submitted_at_utc),
      updated_at_utc = iso_utc(row$updated_at_utc)
    )
  }
  out
}

validate_pick <- function(pick) {
  isTRUE(pick %in% c("HOME", "AWAY", "DRAW"))
}

validate_advancing <- function(advancing_team, pick, is_knockout) {
  if (!is_knockout) {
    return(TRUE)
  }
  if (pick %in% c("HOME", "AWAY")) {
    return(is.null(advancing_team) || is.na(advancing_team) ||
             advancing_team == pick)
  }
  isTRUE(advancing_team %in% c("HOME", "AWAY"))
}

write_prediction <- function(uid, payload, fixtures) {
  if (is.null(payload$match_id) || !nzchar(payload$match_id)) {
    return(list(ok = FALSE, reason = "missing_match_id"))
  }
  if (!validate_pick(payload$pick)) {
    return(list(ok = FALSE, reason = "invalid_pick"))
  }

  match <- fixtures[fixtures$match_id == payload$match_id, , drop = FALSE]
  if (nrow(match) == 0) {
    return(list(ok = FALSE, reason = "unknown_match"))
  }
  match <- match[1, , drop = FALSE]

  if (is_locked(match$kickoff_utc)) {
    return(list(ok = FALSE, reason = "locked",
                kickoff_utc = iso_utc(match$kickoff_utc)))
  }

  if (is.na(match$home_team_id) || !nzchar(match$home_team_id) ||
      is.na(match$away_team_id) || !nzchar(match$away_team_id)) {
    return(list(ok = FALSE, reason = "bracket_pending"))
  }

  is_ko <- is_knockout_stage(match$stage)
  advancing_team <- payload$advancing_team
  if (is.null(advancing_team) || identical(advancing_team, "") ||
      isTRUE(is.na(advancing_team))) {
    advancing_team <- if (is_ko && payload$pick %in% c("HOME", "AWAY")) {
      payload$pick
    } else {
      NA_character_
    }
  }

  if (!validate_advancing(advancing_team, payload$pick, is_ko)) {
    return(list(ok = FALSE, reason = "invalid_advancing_team"))
  }

  # No lock: per-user pin, only written by its owner. See write_tracker for
  # the rationale — eliminates 4 pin ops + ~75ms sleep per click.
  df <- read_predictions(uid)
  now <- now_utc()
  existing <- df[df$match_id == payload$match_id, , drop = FALSE]
  submitted <- if (nrow(existing) > 0) existing$submitted_at_utc[1] else now
  new_row <- data.frame(
    match_id = payload$match_id,
    pick = payload$pick,
    advancing_team = if (is.na(advancing_team)) NA_character_ else advancing_team,
    submitted_at_utc = submitted,
    updated_at_utc = now,
    stringsAsFactors = FALSE
  )
  df <- upsert_row(df, new_row, key = "match_id")
  pin_write_safe(predictions_pin_for(uid), df)

  list(ok = TRUE, match_id = payload$match_id)
}

empty_tournament_picks_df <- function() {
  data.frame(
    user_id = character(),
    team_id = character(),
    team_name = character(),
    submitted_at_utc = as.POSIXct(character(), tz = "UTC"),
    updated_at_utc = as.POSIXct(character(), tz = "UTC"),
    stringsAsFactors = FALSE
  )
}

read_tournament_picks <- function() {
  pin_read_or(pin_name("tournament_picks"), empty_tournament_picks_df())
}

read_tournament_pick <- function(uid) {
  df <- read_tournament_picks()
  if (nrow(df) == 0) return(NULL)
  row <- df[df$user_id == uid, , drop = FALSE]
  if (nrow(row) == 0) return(NULL)
  row <- row[1, , drop = FALSE]
  list(
    team_id = row$team_id,
    team_name = row$team_name,
    submitted_at_utc = iso_utc(row$submitted_at_utc),
    updated_at_utc = iso_utc(row$updated_at_utc)
  )
}

tournament_lock_time <- function(fixtures) {
  if (is.null(fixtures) || nrow(fixtures) == 0) return(NA)
  min(fixtures$kickoff_utc, na.rm = TRUE)
}

write_tournament_pick <- function(uid, team_id, fixtures) {
  if (is.null(team_id) || !nzchar(team_id)) {
    return(list(ok = FALSE, reason = "missing_team_id"))
  }

  lock_time <- tournament_lock_time(fixtures)
  if (is_locked(lock_time)) {
    return(list(ok = FALSE, reason = "locked",
                lock_time_utc = iso_utc(lock_time)))
  }

  teams <- list_unique_teams(fixtures)
  if (length(teams) == 0) {
    return(list(ok = FALSE, reason = "no_teams_yet"))
  }
  team_idx <- match(team_id, teams$team_id)
  if (is.na(team_idx)) {
    return(list(ok = FALSE, reason = "unknown_team"))
  }
  team_name <- teams$team_name[team_idx]

  with_lock("tournament_picks", {
    df <- read_tournament_picks()
    now <- now_utc()
    existing <- df[df$user_id == uid, , drop = FALSE]
    submitted <- if (nrow(existing) > 0) existing$submitted_at_utc[1] else now
    new_row <- data.frame(
      user_id = uid,
      team_id = team_id,
      team_name = team_name,
      submitted_at_utc = submitted,
      updated_at_utc = now,
      stringsAsFactors = FALSE
    )
    df <- upsert_row(df, new_row, key = "user_id")
    pin_write_safe(pin_name("tournament_picks"), df)
  })

  list(ok = TRUE, team_id = team_id, team_name = team_name)
}
