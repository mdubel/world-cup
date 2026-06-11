REFRESH_LOG_LIMIT <- 100L

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

run_refresh <- function(transport = default_transport,
                        espn_transport = espn_default_transport) {
  started <- now_utc()
  result <- tryCatch({
    # Step 1: football-data — canonical schedule + metadata (IDs, crests,
    # groups, TLAs, kickoff times). Free tier, fine; just lags on FT scores.
    resp <- fetch_matches(transport = transport)
    fx <- api_response_to_fixtures(resp)

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

    # Step 3: rebuild the leaderboard snapshot.
    snapshot_n <- tryCatch({
      snap <- rebuild_leaderboard_snapshot(fixtures_df = fx)
      if (is.null(snap$rows)) 0L else nrow(snap$rows)
    }, error = function(e) {
      warning(sprintf("Leaderboard snapshot rebuild failed: %s",
                      conditionMessage(e)))
      -1L
    })

    list(ok = TRUE, n = nrow(fx),
         leaderboard_rows = snapshot_n,
         espn_overlay = overlay_stats)
  }, error = function(e) {
    list(ok = FALSE, error = conditionMessage(e), n = 0L,
         leaderboard_rows = 0L,
         espn_overlay = list(matched = 0L, updated = 0L,
                              error = conditionMessage(e)))
  })
  finished <- now_utc()
  append_refresh_log(
    started, finished,
    if (result$ok) "OK" else "FAIL",
    result$n,
    if (!result$ok) result$error else ""
  )
  ov <- result$espn_overlay %||% list()
  message(sprintf(
    "[refresh %s] %s — %d fixtures, ESPN matched=%d updated=%d%s, %d leaderboard rows",
    iso_utc(finished),
    if (result$ok) "OK" else paste0("FAIL: ", result$error),
    result$n,
    as.integer(ov$matched %||% 0L),
    as.integer(ov$updated %||% 0L),
    if (!is.null(ov$error)) paste0(" (espn err: ", ov$error, ")") else "",
    result$leaderboard_rows
  ))
  result
}
