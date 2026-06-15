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

# Per-game stats: for each FINISHED match, who picked what + who scored,
# plus three "superlative" pointers (most-obvious / most-surprising / biggest
# split) and a chronological points-per-match timeline for the chart.
#
# Game-type-agnostic by design — "obvious" / "surprising" only look at
# `points > 0`, so the +1 advancing bonus for knockout matches folds into
# the same metric as group results. Pick entropy is over the three buckets
# HOME / DRAW / AWAY regardless of stage.
#
# Output is structured to be JSON-friendly via render_json: nested data
# frames are flattened to column-major lists so the React side can use
# the existing columnarToRows helper to reconstruct.
build_game_stats <- function(fixtures_df,
                              users_df,
                              predictions_loader,
                              tournament_picks_df) {
  empty <- list(
    games = list(),
    superlatives = list(
      most_obvious = NULL,
      most_surprising = NULL,
      biggest_split = NULL
    ),
    points_timeline = list(),
    computed_at_utc = iso_utc(now_utc())
  )

  if (is.null(fixtures_df) || nrow(fixtures_df) == 0 ||
      is.null(users_df) || nrow(users_df) == 0) {
    return(empty)
  }

  # Only finished matches with known teams. TBD bracket slots and
  # postponed/cancelled matches are skipped — no meaningful "who scored"
  # to surface.
  finished <- fixtures_df[
    !is.na(fixtures_df$status) & fixtures_df$status == "FINISHED" &
    !is.na(fixtures_df$home_team_id) & !is.na(fixtures_df$away_team_id),
    , drop = FALSE
  ]
  if (nrow(finished) == 0) return(empty)

  name_for <- setNames(users_df$display_name, users_df$user_id)

  # Accumulate per-match buckets. Keyed by match_id; each entry holds the
  # picker lists by choice and a growing scorers data frame.
  init_bucket <- function() {
    list(
      pickers_by_choice = list(
        HOME = character(),
        DRAW = character(),
        AWAY = character()
      ),
      scorers = data.frame(
        user_id        = character(),
        display_name   = character(),
        pick           = character(),
        advancing_team = character(),
        points         = integer(),
        stringsAsFactors = FALSE
      )
    )
  }
  per_game <- setNames(
    lapply(finished$match_id, function(.) init_bucket()),
    finished$match_id
  )

  # One full per-user pass — identical fan-out cost to build_leaderboard,
  # so we get this for free as long as the refresh job calls both.
  for (uid in users_df$user_id) {
    preds <- predictions_loader(uid)
    if (is.null(preds) || nrow(preds) == 0) next

    tpick_row <- if (!is.null(tournament_picks_df) &&
                     nrow(tournament_picks_df) > 0) {
      tp <- tournament_picks_df[tournament_picks_df$user_id == uid, ,
                                 drop = FALSE]
      if (nrow(tp) == 0) NULL else as.list(tp[1, , drop = FALSE])
    } else NULL

    s <- score_user(preds, tpick_row, finished)
    per_match <- s$per_match
    if (is.null(per_match) || nrow(per_match) == 0) next

    dn <- name_for[[uid]] %||% uid

    for (i in seq_len(nrow(per_match))) {
      m_id <- per_match$match_id[i]
      bucket <- per_game[[m_id]]
      if (is.null(bucket)) next

      pk <- per_match$pick[i]
      if (!is.na(pk) && pk %in% c("HOME", "DRAW", "AWAY")) {
        bucket$pickers_by_choice[[pk]] <-
          c(bucket$pickers_by_choice[[pk]], dn)
      }

      pts <- per_match$points[i]
      if (!is.na(pts) && pts > 0) {
        bucket$scorers <- rbind(
          bucket$scorers,
          data.frame(
            user_id        = uid,
            display_name   = dn,
            pick           = if (is.na(pk)) NA_character_ else pk,
            advancing_team = if (is.null(per_match$advancing_team[i]) ||
                                 isTRUE(is.na(per_match$advancing_team[i])))
                               NA_character_
                             else per_match$advancing_team[i],
            points         = as.integer(pts),
            stringsAsFactors = FALSE
          )
        )
      }
      per_game[[m_id]] <- bucket
    }
  }

  # Compute per-game aggregates + metrics.
  games_out <- list()
  for (m_id in names(per_game)) {
    pg <- per_game[[m_id]]
    counts <- vapply(pg$pickers_by_choice, length, integer(1))
    total_picks <- sum(counts)
    if (total_picks == 0) next   # no one picked this game — skip

    n_scored <- nrow(pg$scorers)
    total_points <- if (n_scored == 0) 0L else sum(pg$scorers$points)

    # Obvious vs surprising: same axis, opposite ends. We use "fraction of
    # pickers who picked the ACTUAL outcome" (HOME / DRAW / AWAY from the
    # fixture's winner column) rather than "fraction who scored anything"
    # — the latter would be ~1.0 on most games because group rules pay
    # 1pt for predicted-winner-actual-draw partial credit. Outcome-based
    # picks are the cleaner consensus-correctness signal.
    fx_row <- finished[finished$match_id == m_id, , drop = FALSE]
    outcome <- if (nrow(fx_row) == 0) NA_character_ else fx_row$winner[1]
    winners_count <- if (!is.na(outcome) &&
                         outcome %in% c("HOME", "DRAW", "AWAY"))
                       as.integer(counts[[outcome]])
                     else 0L
    winners_fraction <- if (total_picks == 0) 0
                        else winners_count / total_picks

    # Pick entropy normalised over the three choice buckets — fully even
    # 1/3 / 1/3 / 1/3 → 1.0; everyone picked the same → 0.0.
    probs <- counts[counts > 0] / total_picks
    pick_entropy <- if (length(probs) <= 1) 0
                    else -sum(probs * log(probs)) / log(3)

    # Sort scorers by points desc then name for the per-game expand view.
    sc <- pg$scorers
    if (nrow(sc) > 0) {
      sc <- sc[order(-sc$points, sc$display_name), , drop = FALSE]
      rownames(sc) <- NULL
    }

    games_out[[m_id]] <- list(
      match_id          = m_id,
      outcome           = if (is.na(outcome)) NA_character_ else outcome,
      picks_by_choice   = as.list(counts),
      pickers_by_choice = pg$pickers_by_choice,
      # Column-major for cheap JSON serialisation; columnarToRows
      # reconstructs on the React side.
      scorers           = as.list(sc),
      total_picks       = as.integer(total_picks),
      n_scorers         = as.integer(n_scored),
      total_points      = as.integer(total_points),
      winners_count     = winners_count,
      winners_fraction  = winners_fraction,
      pick_entropy      = pick_entropy
    )
  }
  if (length(games_out) == 0) return(empty)

  # Superlatives. which.max returns the first by name when tied; that's
  # acceptable for a stats display.
  wf <- vapply(games_out, function(g) g$winners_fraction, numeric(1))
  pe <- vapply(games_out, function(g) g$pick_entropy, numeric(1))
  superlatives <- list(
    most_obvious    = names(games_out)[which.max(wf)],
    most_surprising = names(games_out)[which.min(wf)],
    biggest_split   = names(games_out)[which.max(pe)]
  )

  # Chronological points timeline for the bar chart. One row per game.
  timeline_rows <- lapply(names(games_out), function(m_id) {
    fx_row <- finished[finished$match_id == m_id, , drop = FALSE]
    if (nrow(fx_row) == 0) return(NULL)
    g <- games_out[[m_id]]
    sc <- pg <- per_game[[m_id]]$scorers
    if (nrow(sc) > 0) {
      sc <- sc[order(-sc$points), , drop = FALSE]
      top3 <- head(sc, 3)
      top_label <- paste(sprintf("%s (+%d)", top3$display_name, top3$points),
                         collapse = ", ")
    } else {
      top_label <- ""
    }
    data.frame(
      match_id         = m_id,
      kickoff_utc      = fx_row$kickoff_utc[1],
      total_points     = g$total_points,
      n_scorers        = g$n_scorers,
      total_picks      = g$total_picks,
      top_scorers_label = top_label,
      stringsAsFactors = FALSE
    )
  })
  timeline_df <- do.call(rbind, Filter(Negate(is.null), timeline_rows))
  if (!is.null(timeline_df) && nrow(timeline_df) > 0) {
    timeline_df <- timeline_df[order(timeline_df$kickoff_utc), , drop = FALSE]
    timeline_df$kickoff_utc <- iso_utc(timeline_df$kickoff_utc)
    rownames(timeline_df) <- NULL
  }

  list(
    games          = games_out,
    superlatives   = superlatives,
    points_timeline = if (is.null(timeline_df)) list() else as.list(timeline_df),
    computed_at_utc = iso_utc(now_utc())
  )
}
