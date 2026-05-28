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

run_refresh <- function(transport = default_transport) {
  started <- now_utc()
  result <- tryCatch({
    resp <- fetch_matches(transport = transport)
    fx <- api_response_to_fixtures(resp)
    write_fixtures(fx)
    # Rebuild the leaderboard snapshot in the same pass. The app reads this
    # pin in O(1) instead of fanning out across every user's predictions
    # pin on every leaderboard render.
    snapshot_n <- tryCatch({
      snap <- rebuild_leaderboard_snapshot(fixtures_df = fx)
      if (is.null(snap$rows)) 0L else nrow(snap$rows)
    }, error = function(e) {
      warning(sprintf("Leaderboard snapshot rebuild failed: %s",
                      conditionMessage(e)))
      -1L
    })
    list(ok = TRUE, n = nrow(fx), leaderboard_rows = snapshot_n)
  }, error = function(e) {
    list(ok = FALSE, error = conditionMessage(e), n = 0L, leaderboard_rows = 0L)
  })
  finished <- now_utc()
  append_refresh_log(
    started, finished,
    if (result$ok) "OK" else "FAIL",
    result$n,
    if (!result$ok) result$error else ""
  )
  message(sprintf("[refresh %s] %s — %d fixtures, %d leaderboard rows",
                  iso_utc(finished),
                  if (result$ok) "OK" else paste0("FAIL: ", result$error),
                  result$n,
                  result$leaderboard_rows))
  result
}
