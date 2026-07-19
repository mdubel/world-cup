REFRESH_LOG_LIMIT <- 100L

# Live-window minutes after kickoff during which we KEEP polling for score
# changes. Group: 90 reg + ~15 stoppage + 5 buffer = 110. Knockout: 90 reg
# + 30 ET + ~60 buffer to cover PK shootout + post-match ceremony = 180.
GROUP_LIVE_WINDOW_MIN <- 110L
KNOCKOUT_LIVE_WINDOW_MIN <- 180L
# Start watching this many minutes BEFORE kickoff so we capture lineups /
# status changes the moment the match goes live.
PRE_KICKOFF_LIVE_MIN <- 2L
# Re-hit the football-data API only this often. ESPN is our primary live
# source and runs every tick; football-data is the slower 'truth' fallback,
# safe to hit every ~10 min even during a match. The free tier rate limit
# is 10 req/min, so this is generous; the throttle is mostly about not
# spamming a free service we depend on.
FOOTBALL_DATA_THROTTLE_MIN <- 10L

# Single-value pin holding the last successful football-data fetch time.
# Each cron tick is a fresh Rscript process, so we can't keep this in
# in-process state — has to round-trip through pins.
LAST_FD_PIN_SUFFIX <- "last_football_data_at"

read_last_football_data_at <- function() {
  v <- pin_read_or(pin_name(LAST_FD_PIN_SUFFIX), NULL)
  if (is.null(v) || length(v) == 0) return(NULL)
  parsed <- tryCatch(parse_iso_utc(as.character(v)),
                     error = function(e) NULL)
  if (is.null(parsed) || isTRUE(is.na(parsed))) return(NULL)
  parsed
}

write_last_football_data_at <- function(t) {
  pin_write_safe(pin_name(LAST_FD_PIN_SUFFIX), iso_utc(t))
}

# Returns TRUE if any match is currently live OR about to kick off OR
# inside its post-kickoff "expect goals" window. The full refresh is gated
# on this so an every-minute cron costs nothing when no match is on.
is_live_window <- function(fx, now) {
  if (is.null(fx) || nrow(fx) == 0) return(FALSE)
  # In-progress matches keep the window open regardless of clock — handles
  # long stoppages, suspended-and-resumed, and football-data's various
  # transitional labels. "LIVE" is one they use during ET (observed on
  # the WC 2026 Final — Spain vs Argentina — where the pin captured
  # status=LIVE, our gate didn't recognise it, and by the time football-
  # data flipped to FINISHED 25 min later the KO-window clock had
  # expired). Include EXTRA_TIME/PENALTY as safety belts — cheap to
  # enumerate, expensive to miss.
  in_progress_statuses <- c(
    "IN_PLAY", "PAUSED", "LIVE",
    "EXTRA_TIME", "PENALTY_SHOOTOUT"
  )
  if (any(fx$status %in% in_progress_statuses, na.rm = TRUE)) return(TRUE)
  is_ko <- is_knockout_stage(fx$stage)
  window_min <- ifelse(is_ko, KNOCKOUT_LIVE_WINDOW_MIN, GROUP_LIVE_WINDOW_MIN)
  terminal <- fx$status %in% c("FINISHED", "CANCELLED", "POSTPONED", "AWARDED")
  window_lo <- fx$kickoff_utc - PRE_KICKOFF_LIVE_MIN * 60
  window_hi <- fx$kickoff_utc + window_min * 60
  in_window <- !terminal &
               !is.na(fx$kickoff_utc) &
               now >= window_lo &
               now <= window_hi
  any(in_window, na.rm = TRUE)
}

# Returns TRUE if there's a TBD-team KO fixture kicking off in the next
# PRE_KO_LOOKAHEAD_DAYS days. We use this to keep the refresh job firing
# during the group-stage-end → KO-start window so ESPN's earlier team
# assignments land in our fixtures pin within minutes instead of waiting
# for the first KO match's live window to open.
PRE_KO_LOOKAHEAD_DAYS <- 14L
has_pending_tbd_ko <- function(fx, now) {
  if (is.null(fx) || nrow(fx) == 0) return(FALSE)
  is_ko <- is_knockout_stage(fx$stage)
  tbd <- is.na(fx$home_team_id) | !nzchar(fx$home_team_id %||% "") |
         is.na(fx$away_team_id) | !nzchar(fx$away_team_id %||% "")
  upcoming <- !is.na(fx$kickoff_utc) &
              fx$kickoff_utc >= now &
              fx$kickoff_utc <= now + PRE_KO_LOOKAHEAD_DAYS * 24 * 3600
  any(is_ko & tbd & upcoming, na.rm = TRUE)
}

# Decide whether to run the refresh on this tick AND in what mode. Modes:
#   "full"     — live or live-imminent match: do football-data + ESPN +
#                fixtures write + leaderboard + game_stats + admin_stats
#   "pre_ko"   — TBD-team KO match coming up: do football-data (throttled)
#                + ESPN (incl. team-assignment injection) + fixtures write,
#                SKIP per-user fan-outs since assignments don't affect
#                scoring
#   FALSE      — nothing to do, exit silently
should_run_refresh <- function(fx, now = now_utc()) {
  if (is.null(fx) || nrow(fx) == 0) {
    return(list(run = TRUE, mode = "full", reason = "bootstrap"))
  }
  if (is_live_window(fx, now)) {
    return(list(run = TRUE, mode = "full", reason = "in_live_window"))
  }
  if (has_pending_tbd_ko(fx, now)) {
    return(list(run = TRUE, mode = "pre_ko", reason = "pending_tbd_ko"))
  }
  list(run = FALSE, mode = NA_character_, reason = "no_live_match")
}

empty_refresh_log_df <- function() {
  data.frame(
    started_at_utc = as.POSIXct(character(), tz = "UTC"),
    finished_at_utc = as.POSIXct(character(), tz = "UTC"),
    status = character(),
    n_fixtures = integer(),
    error_msg = character(),
    stringsAsFactors = FALSE
  )
}

append_refresh_log <- function(started, finished, status, n_fixtures, error_msg = "") {
  with_lock("refresh_log", {
    df <- pin_read_or(pin_name("refresh_log"), empty_refresh_log_df())
    df <- rbind(df, data.frame(
      started_at_utc = started,
      finished_at_utc = finished,
      status = status,
      n_fixtures = as.integer(n_fixtures),
      error_msg = as.character(error_msg %||% ""),
      stringsAsFactors = FALSE
    ))
    if (nrow(df) > REFRESH_LOG_LIMIT) {
      df <- tail(df, REFRESH_LOG_LIMIT)
    }
    pin_write_safe(pin_name("refresh_log"), df)
  })
}

# `force = TRUE` is the bypass for the in-app "manual refresh" button —
# skips both the live-window gate and the football-data throttle. The
# scheduled cron always calls run_refresh() with defaults.
run_refresh <- function(transport = default_transport,
                        espn_transport = espn_default_transport,
                        force = FALSE) {
  started <- now_utc()

  # Step 0: gate. Read fixtures and decide whether to do anything on this
  # tick. Idle ticks (no live match) exit silently — no API calls, no
  # leaderboard rebuild, no refresh_log entry. Each cron tick still pays
  # ONE pin_read for fixtures, but that's cheap and avoids hitting the
  # external APIs unnecessarily.
  fx_existing <- read_fixtures()
  decision <- should_run_refresh(fx_existing, started)
  if (!force && !decision$run) {
    message(sprintf("[refresh %s] SKIPPED — %s",
                    iso_utc(started), decision$reason))
    return(list(ok = TRUE, skipped = TRUE, reason = decision$reason))
  }

  # Decide whether to hit football-data this tick. ESPN runs every time.
  last_fd <- read_last_football_data_at()
  fetch_fd <- force ||
              is.null(last_fd) ||
              (decision$reason == "bootstrap") ||
              as.numeric(difftime(started, last_fd, units = "mins")) >=
                FOOTBALL_DATA_THROTTLE_MIN

  result <- tryCatch({
    if (fetch_fd) {
      # Step 1: football-data — canonical schedule + metadata (IDs, crests,
      # groups, TLAs, kickoff times). Free tier, fine; just lags on FT scores.
      resp <- fetch_matches(transport = transport)
      fx <- api_response_to_fixtures(resp)
      write_last_football_data_at(started)
    } else {
      # Throttled — reuse the fixtures we just read. ESPN overlay below
      # will refresh any live scores.
      fx <- fx_existing
    }

    # Step 2: ESPN overlay for live scores. Failure here MUST NOT fail the
    # refresh — football-data scores (delayed but real) are the fallback.
    # Return both the new fx and the stats from the inner tryCatch so we
    # don't have to use <<- (which interacts badly with $-subset assignment
    # in some R versions and was silently swallowing the overlay errors).
    overlay_outcome <- tryCatch({
      fx2 <- apply_espn_overlay(fx, transport = espn_transport)
      stats <- attr(fx2, "overlay_stats") %||% list()
      list(fx = fx2,
           matched = as.integer(stats$matched %||% 0L),
           updated = as.integer(stats$updated %||% 0L),
           error = NULL)
    }, error = function(e) {
      warning(sprintf("ESPN overlay failed (keeping football-data scores): %s",
                      conditionMessage(e)))
      list(fx = fx, matched = 0L, updated = 0L, error = conditionMessage(e))
    })
    fx <- overlay_outcome$fx
    overlay_stats <- list(matched = overlay_outcome$matched,
                          updated = overlay_outcome$updated,
                          error  = overlay_outcome$error)

    write_fixtures(fx)

    # We used to skip the per-user fan-out rebuilds (leaderboard /
    # game_stats / admin_stats) in pre_ko mode under the assumption that
    # only team-assignment injection happens — no scoring changes. That
    # was wrong: e.g. a PK match's winner field corrected from AWAY to
    # DRAW changes the scoring for everyone who picked that match, but
    # the user's predictions pin doesn't move. The fix needs the
    # leaderboard + game_stats rebuilds to actually run.
    # At office-pool scale (~25 users × 2 pin reads each) the fan-out
    # cost is ~50 cheap pin reads per minute during the pre-KO window —
    # well below anything that would matter on Connect.

    # Step 3: rebuild the leaderboard snapshot.
    snapshot_n <- tryCatch({
      snap <- rebuild_leaderboard_snapshot(fixtures_df = fx)
      if (is.null(snap$rows)) 0L else nrow(snap$rows)
    }, error = function(e) {
      warning(sprintf("Leaderboard snapshot rebuild failed: %s",
                      conditionMessage(e)))
      -1L
    })

    # Step 4: rebuild the per-game stats snapshot. Same per-user fan-out
    # as the leaderboard build — both iterate every predictions pin — so
    # cost is roughly doubled but still bounded by the user count. A
    # failure here MUST NOT break the leaderboard / fixtures write; users
    # would lose the Stats tab but the rest of the app stays current.
    stats_n <- tryCatch({
      st <- rebuild_game_stats(fixtures_df = fx)
      length(st$games)
    }, error = function(e) {
      warning(sprintf("Game-stats snapshot rebuild failed: %s",
                      conditionMessage(e)))
      -1L
    })

    # Step 5: rebuild the admin-stats snapshot. Pre-computing here turns
    # the admin tab's open from a ~50-pin-read inline build (~15s) into
    # a single cached pin read. Same fail-soft pattern as steps 3/4.
    admin_n <- tryCatch({
      ast <- rebuild_admin_stats(fixtures_df = fx)
      as.integer(ast$total_users %||% 0L)
    }, error = function(e) {
      warning(sprintf("Admin-stats snapshot rebuild failed: %s",
                      conditionMessage(e)))
      -1L
    })

    list(ok = TRUE, n = nrow(fx),
         leaderboard_rows = snapshot_n,
         stats_games = stats_n,
         espn_overlay = overlay_stats,
         football_data_fetched = fetch_fd)
  }, error = function(e) {
    list(ok = FALSE, error = conditionMessage(e), n = 0L,
         leaderboard_rows = 0L,
         espn_overlay = list(matched = 0L, updated = 0L,
                              error = conditionMessage(e)),
         football_data_fetched = fetch_fd)
  })
  finished <- now_utc()
  # Only append to refresh_log when we ACTUALLY did work. Skipped ticks
  # would otherwise churn the 100-row rolling log in ~90 minutes and bury
  # the useful state changes under hundreds of "nothing happened" rows.
  append_refresh_log(
    started, finished,
    if (result$ok) "OK" else "FAIL",
    result$n,
    if (!result$ok) result$error else ""
  )
  ov <- result$espn_overlay %||% list()
  message(sprintf(
    "[refresh %s] %s — %d fixtures, FD=%s, ESPN matched=%d updated=%d%s, %d leaderboard rows",
    iso_utc(finished),
    if (result$ok) "OK" else paste0("FAIL: ", result$error),
    result$n,
    if (isTRUE(result$football_data_fetched)) "fetched" else "throttled",
    as.integer(ov$matched %||% 0L),
    as.integer(ov$updated %||% 0L),
    if (!is.null(ov$error)) paste0(" (espn err: ", ov$error, ")") else "",
    result$leaderboard_rows
  ))
  result
}
