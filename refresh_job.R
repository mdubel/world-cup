#!/usr/bin/env Rscript
# Scheduled refresh job for the World Cup 2026 app.
# Deploy to POSIT Connect as a scheduled R script (cron */10 * * * *).
# Reads the football-data.org competition feed and writes to the shared
# fixtures pin used by the app. Requires FOOTBALL_DATA_TOKEN and
# CONNECT_API_KEY env vars on the Connect content item.

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
source("data.R")
source("scoring.R")
source("api.R")
source("fixtures.R")
source("users.R")
source("predictions.R")
source("leaderboard.R")
source("refresh.R")

result <- run_refresh()
if (!isTRUE(result$ok)) {
  message(sprintf("Refresh failed: %s", result$error %||% "unknown"))
  quit(status = 1)
}
