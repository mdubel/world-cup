score_group <- function(pick, winner) {
  if (length(pick) == 0 || length(winner) == 0) return(0L)
  if (is.na(pick) || is.na(winner)) return(0L)
  if (pick == winner) return(3L)
  if (pick == "DRAW" && winner != "DRAW") return(1L)
  if (pick != "DRAW" && winner == "DRAW") return(1L)
  0L
}

score_knockout <- function(pick, advancing_team_pick, winner, advancing_team_actual) {
  base <- score_group(pick, winner)
  bonus <- 0L
  if (length(advancing_team_pick) > 0 && length(advancing_team_actual) > 0 &&
      !is.na(advancing_team_pick) && !is.na(advancing_team_actual) &&
      advancing_team_pick == advancing_team_actual) {
    bonus <- 1L
  }
  base + bonus
}

TOURNAMENT_BONUS <- 26L

score_tournament <- function(pick_team_id, champion_team_id) {
  if (length(pick_team_id) == 0 || length(champion_team_id) == 0) return(0L)
  if (is.na(pick_team_id) || is.na(champion_team_id)) return(0L)
  if (pick_team_id == champion_team_id) return(TOURNAMENT_BONUS)
  0L
}

actual_advancing_team <- function(match_row) {
  if (!isTRUE(match_row$status == "FINISHED")) return(NA_character_)
  pk <- match_row$pk_winner
  if (!is.null(pk) && !is.na(pk) && nzchar(pk)) return(pk)
  w <- match_row$winner
  if (is.null(w) || is.na(w)) return(NA_character_)
  if (w %in% c("HOME", "AWAY")) return(w)
  NA_character_
}

champion_team_id <- function(fixtures_df) {
  if (is.null(fixtures_df) || nrow(fixtures_df) == 0) return(NA_character_)
  finals <- fixtures_df[fixtures_df$stage == "FINAL" &
                          !is.na(fixtures_df$status) &
                          fixtures_df$status == "FINISHED", , drop = FALSE]
  if (nrow(finals) == 0) return(NA_character_)
  m <- finals[1, , drop = FALSE]
  adv <- actual_advancing_team(m)
  if (is.na(adv)) return(NA_character_)
  if (adv == "HOME") return(m$home_team_id)
  if (adv == "AWAY") return(m$away_team_id)
  NA_character_
}

is_knockout_stage <- function(stage) {
  stage %in% c("LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS",
               "THIRD_PLACE", "FINAL")
}

score_user <- function(predictions_df, tournament_pick, fixtures_df) {
  per_match <- data.frame(
    match_id = character(),
    stage = character(),
    pick = character(),
    advancing_team = character(),
    winner_actual = character(),
    advancing_actual = character(),
    points = integer(),
    stringsAsFactors = FALSE
  )

  group_pts <- 0L
  knockout_pts <- 0L
  # "Exact" = a prediction that scored the maximum for its stage:
  # 3 pts for a group match, 4 pts for a knockout match (base 3 + advancing
  # bonus 1). Used as the leaderboard tiebreaker.
  exact_predictions <- 0L

  if (!is.null(predictions_df) && nrow(predictions_df) > 0 &&
      !is.null(fixtures_df) && nrow(fixtures_df) > 0) {
    finished <- fixtures_df[!is.na(fixtures_df$status) &
                              fixtures_df$status == "FINISHED", , drop = FALSE]
    for (i in seq_len(nrow(predictions_df))) {
      p <- predictions_df[i, , drop = FALSE]
      m <- finished[finished$match_id == p$match_id, , drop = FALSE]
      if (nrow(m) == 0) next
      m <- m[1, , drop = FALSE]
      adv_actual <- actual_advancing_team(m)
      is_ko <- is_knockout_stage(m$stage)
      pts <- if (is_ko) {
        score_knockout(p$pick, p$advancing_team, m$winner, adv_actual)
      } else {
        score_group(p$pick, m$winner)
      }
      if (is_ko) {
        knockout_pts <- knockout_pts + pts
        if (pts == 4L) exact_predictions <- exact_predictions + 1L
      } else {
        group_pts <- group_pts + pts
        if (pts == 3L) exact_predictions <- exact_predictions + 1L
      }
      per_match <- rbind(per_match, data.frame(
        match_id = p$match_id,
        stage = m$stage,
        pick = p$pick,
        advancing_team = if (is.na(p$advancing_team)) NA_character_ else p$advancing_team,
        winner_actual = m$winner,
        advancing_actual = adv_actual,
        points = as.integer(pts),
        stringsAsFactors = FALSE
      ))
    }
  }

  champion <- champion_team_id(fixtures_df)
  tp_team <- if (!is.null(tournament_pick) && length(tournament_pick$team_id) > 0) {
    tournament_pick$team_id
  } else {
    NA_character_
  }
  tournament_pts <- score_tournament(tp_team, champion)

  list(
    group_pts = as.integer(group_pts),
    knockout_pts = as.integer(knockout_pts),
    tournament_pts = as.integer(tournament_pts),
    total = as.integer(group_pts + knockout_pts + tournament_pts),
    exact_predictions = as.integer(exact_predictions),
    per_match = per_match
  )
}

build_leaderboard <- function(fixtures_df, users_df, predictions_loader, tournament_picks_df) {
  if (is.null(users_df) || nrow(users_df) == 0) {
    return(list(
      rows = data.frame(
        user_id = character(),
        display_name = character(),
        total = integer(),
        group_pts = integer(),
        knockout_pts = integer(),
        tournament_pts = integer(),
        exact_predictions = integer(),
        champion_pick_team_id = character(),
        champion_pick_team_name = character(),
        stringsAsFactors = FALSE
      ),
      computed_at_utc = iso_utc(now_utc())
    ))
  }

  rows <- vector("list", nrow(users_df))
  for (i in seq_len(nrow(users_df))) {
    uid <- users_df$user_id[i]
    preds <- predictions_loader(uid)
    tpick <- if (!is.null(tournament_picks_df) && nrow(tournament_picks_df) > 0) {
      tp <- tournament_picks_df[tournament_picks_df$user_id == uid, , drop = FALSE]
      if (nrow(tp) == 0) NULL else as.list(tp[1, , drop = FALSE])
    } else NULL
    s <- score_user(preds, tpick, fixtures_df)
    rows[[i]] <- data.frame(
      user_id = uid,
      display_name = users_df$display_name[i] %||% uid,
      champion_pick_team_id = if (is.null(tpick) || is.null(tpick$team_id))
        NA_character_ else tpick$team_id,
      champion_pick_team_name = if (is.null(tpick) || is.null(tpick$team_name))
        NA_character_ else tpick$team_name,
      total = s$total,
      group_pts = s$group_pts,
      knockout_pts = s$knockout_pts,
      tournament_pts = s$tournament_pts,
      exact_predictions = s$exact_predictions,
      stringsAsFactors = FALSE
    )
  }

  out <- do.call(rbind, rows)
  if (!is.null(out) && nrow(out) > 0) {
    # Tiebreaker: higher total → more exact predictions → name (alphabetical).
    out <- out[order(-out$total, -out$exact_predictions, out$display_name),
               , drop = FALSE]
    rownames(out) <- NULL
  }

  list(
    rows = out,
    computed_at_utc = iso_utc(now_utc())
  )
}
