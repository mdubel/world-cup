#!/usr/bin/env Rscript
# Scheduled refresh job for the World Cup 2026 app.
# Deploy to POSIT Connect as a scheduled R script. The recommended cron is
# `* * * * *` (every minute) — the job self-gates inside run_refresh():
#   - no live or imminent match → exit silently in ~1 pin read
#   - match in its live window → pull ESPN (every tick) + football-data
#     (throttled to once per 10 min)
# That keeps external API traffic minimal while delivering ~1-min score
# latency during games. See r/refresh.R for the gate + throttle logic.
#
# Requires FOOTBALL_DATA_TOKEN and CONNECT_API_KEY env vars on the Connect
# content item.

`%||%` <- function(a, b) if (is.null(a)) b else a

# When running locally, the Shiny app uses `r/` as its working directory
# (shiny::runApp("r/app.R") setwd's there), and the local pin board lives at
# `r/.dev_pins/`. This refresh script must use the SAME pin board, so we
# chdir into `r/` if it exists. On Connect, board_connect() is used and the
# local .dev_pins path is irrelevant.
if (dir.exists("r") && file.exists(file.path("r", "data.R"))) {
  setwd("r")
}

source("util_time.R")
# auth.R defines safe_user_pin_suffix(), which predictions.R/tracker.R use to
# derive per-user pin names. Without it sourced, predictions_pin_for() raises
# "could not find function safe_user_pin_suffix" inside pin_exists_safe(),
# whose tryCatch silently returns FALSE — so read_predictions() returns an
# empty frame for every user and the rebuilt leaderboard snapshot is all
# zeros. (Symptom: app shows 0 points for everyone after each refresh, even
# for users who picked the winning side.)
source("auth.R")
source("data.R")
source("scoring.R")
source("api.R")
source("api_espn.R")
source("fixtures.R")
source("users.R")
source("predictions.R")
source("leaderboard.R")
source("game_stats.R")
source("refresh.R")

result <- run_refresh()
if (!isTRUE(result$ok)) {
  message(sprintf("Refresh failed: %s", result$error %||% "unknown"))
  quit(status = 1)
}
