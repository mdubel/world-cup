# Admin dashboard — adoption stats restricted to a small allowlist.
#
# Who counts as an admin is controlled by the WC26_ADMINS env var on the
# Connect content item (comma-separated list of usernames). Locally, the
# dev fallback honours SHINY_DEV_USER for the same list, so you can set
# WC26_ADMINS=dev:alice for local testing.

is_admin <- function(user) {
  uid <- if (is.list(user)) user$id else user
  if (is.null(uid) || !nzchar(uid)) return(FALSE)
  admins <- Sys.getenv("WC26_ADMINS", unset = "")
  if (!nzchar(admins)) return(FALSE)
  admin_list <- trimws(strsplit(admins, ",")[[1]])
  uid %in% admin_list
}

# Build the adoption snapshot. Iterates per-user predictions and tracker
# pins; for our office-pool scale (~50 users) this is acceptable when only
# the admin tab is observing. We deliberately avoid wiring this into the
# regular invalidators so it doesn't recompute on every other user's click.
compute_admin_stats <- function(fixtures_df, users_df, tpicks_df) {
  empty <- list(
    total_users = 0L,
    users = list(),
    counts = list(
      with_tracker = 0L,
      with_group_picks = 0L,
      with_knockout_picks = 0L,
      with_favorite = 0L,
      with_champion = 0L,
      active = 0L,
      dormant = 0L,
      inactive = 0L
    ),
    kicked_off_count = 0L,
    computed_at_utc = iso_utc(now_utc())
  )

  if (is.null(users_df) || nrow(users_df) == 0) {
    return(empty)
  }

  # Pre-compute the set of matches whose kickoff is in the past — these are
  # the matches where picks are LOCKED, i.e. anyone who didn't pick by now
  # missed the scoring window. Categorisation hinges on whether each user
  # placed a pick for every such match.
  now <- now_utc()
  kicked_off_ids <- if (!is.null(fixtures_df) && nrow(fixtures_df) > 0) {
    fixtures_df$match_id[fixtures_df$kickoff_utc <= now &
                          !is.na(fixtures_df$kickoff_utc)]
  } else {
    character()
  }
  kicked_off_count <- length(kicked_off_ids)

  n <- nrow(users_df)
  rows <- vector("list", n)

  for (i in seq_len(n)) {
    uid <- users_df$user_id[i]
    preds <- read_predictions(uid)
    track <- read_tracker(uid)

    # Split predictions by stage so we can show progress against the
    # 72 group + 32 knockout totals separately.
    group_picks <- 0L
    knockout_picks <- 0L
    total_picks <- if (is.null(preds)) 0L else as.integer(nrow(preds))
    picks_kicked_off <- 0L
    if (!is.null(preds) && nrow(preds) > 0 &&
        !is.null(fixtures_df) && nrow(fixtures_df) > 0) {
      lookup <- fixtures_df[, c("match_id", "stage")]
      merged <- merge(preds[, "match_id", drop = FALSE], lookup,
                      by = "match_id", all.x = TRUE)
      knockout_picks <- as.integer(sum(is_knockout_stage(merged$stage),
                                        na.rm = TRUE))
      group_picks <- as.integer(nrow(merged) - knockout_picks)
      picks_kicked_off <- as.integer(sum(preds$match_id %in% kicked_off_ids))
    }

    # Categorisation:
    #   active   — picked every match that has already kicked off (full
    #              opportunity to score). With zero kicked-off matches yet,
    #              having any forward-looking pick counts as engaged.
    #   dormant  — placed some picks but missed at least one locked match.
    #   inactive — opened the app (touch_user wrote a users-pin row) but
    #              never submitted a single prediction.
    category <- if (total_picks == 0L) {
      "inactive"
    } else if (kicked_off_count == 0L ||
               picks_kicked_off >= kicked_off_count) {
      "active"
    } else {
      "dormant"
    }

    wl <- if (!is.null(track) && nrow(track) > 0)
      sum(track$state == "WATCH_LATER", na.rm = TRUE) else 0L
    wd <- if (!is.null(track) && nrow(track) > 0)
      sum(track$state == "WATCHED", na.rm = TRUE) else 0L
    sk <- if (!is.null(track) && nrow(track) > 0)
      sum(track$state == "SKIP", na.rm = TRUE) else 0L

    tpick <- if (!is.null(tpicks_df) && nrow(tpicks_df) > 0) {
      row <- tpicks_df[tpicks_df$user_id == uid, , drop = FALSE]
      if (nrow(row) > 0) row[1, , drop = FALSE] else NULL
    } else NULL

    favorite_id <- if (is.na(users_df$favorite_team_id[i])) NA_character_
                   else users_df$favorite_team_id[i]
    favorite_name <- NA_character_
    if (!is.na(favorite_id) && !is.null(fixtures_df) && nrow(fixtures_df) > 0) {
      home_hit <- fixtures_df$home_team_id == favorite_id &
        !is.na(fixtures_df$home_team_id)
      away_hit <- fixtures_df$away_team_id == favorite_id &
        !is.na(fixtures_df$away_team_id)
      if (any(home_hit, na.rm = TRUE)) {
        favorite_name <- fixtures_df$home_team_name[which(home_hit)[1]]
      } else if (any(away_hit, na.rm = TRUE)) {
        favorite_name <- fixtures_df$away_team_name[which(away_hit)[1]]
      }
    }

    rows[[i]] <- list(
      user_id = uid,
      display_name = users_df$display_name[i],
      first_seen_utc = iso_utc(users_df$first_seen_utc[i]),
      last_seen_utc = iso_utc(users_df$last_seen_utc[i]),
      tz = if (is.na(users_df$tz[i])) NA_character_ else users_df$tz[i],
      theme = if (is.na(users_df$theme[i])) NA_character_ else users_df$theme[i],
      favorite_team_id = favorite_id,
      favorite_team_name = favorite_name,
      group_picks = group_picks,
      knockout_picks = knockout_picks,
      picks_kicked_off = picks_kicked_off,
      tracker_watch_later = as.integer(wl),
      tracker_watched = as.integer(wd),
      tracker_skipped = as.integer(sk),
      champion_pick_team_id = if (is.null(tpick)) NA_character_ else tpick$team_id,
      champion_pick_team_name = if (is.null(tpick)) NA_character_ else tpick$team_name,
      champion_pick_at_utc = if (is.null(tpick)) NA_character_
                              else iso_utc(tpick$updated_at_utc),
      category = category
    )
  }

  counts <- list(
    with_tracker = as.integer(sum(vapply(rows, function(r)
      (r$tracker_watch_later + r$tracker_watched + r$tracker_skipped) > 0,
      logical(1)))),
    with_group_picks = as.integer(sum(vapply(rows, function(r)
      r$group_picks > 0, logical(1)))),
    with_knockout_picks = as.integer(sum(vapply(rows, function(r)
      r$knockout_picks > 0, logical(1)))),
    with_favorite = as.integer(sum(vapply(rows, function(r)
      !is.na(r$favorite_team_id) && nzchar(r$favorite_team_id),
      logical(1)))),
    with_champion = as.integer(sum(vapply(rows, function(r)
      !is.na(r$champion_pick_team_id), logical(1)))),
    active = as.integer(sum(vapply(rows, function(r)
      identical(r$category, "active"), logical(1)))),
    dormant = as.integer(sum(vapply(rows, function(r)
      identical(r$category, "dormant"), logical(1)))),
    inactive = as.integer(sum(vapply(rows, function(r)
      identical(r$category, "inactive"), logical(1))))
  )

  list(
    total_users = as.integer(n),
    users = rows,
    counts = counts,
    kicked_off_count = as.integer(kicked_off_count),
    computed_at_utc = iso_utc(now_utc())
  )
}
