#!/usr/bin/env Rscript
# ---------------------------------------------------------------------------
# Challengers vs the old powers.
#
# For each "challenger" confederation (CONCACAF, CAF, AFC, OFC) we look ONLY at
# its group-stage matches against a "power" (CONMEBOL or UEFA) and compute the
# share of points the challenger took from those games:
#
#   metric = points won by challenger teams vs powers / (3 * such matches)
#
# Games among challengers, and games between the two powers, are ignored
# entirely -- so CONMEBOL and UEFA themselves never appear on this chart.
#
# USAGE
#   Rscript analysis/challenger_vs_powers.R      # reads analysis/matches.tsv
# OUTPUT
#   - console table
#   - analysis/challenger_chart_data.json  (consumed by the chart template)
# ---------------------------------------------------------------------------

suppressWarnings(suppressMessages(library(jsonlite)))

HERE <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1])), error = function(e) ".")
if (is.na(HERE) || !nzchar(HERE)) HERE <- "analysis"
source(file.path(HERE, "confederations.R"))

MATCHES <- file.path(HERE, "matches.tsv")
JSON_OUT <- file.path(HERE, "challenger_chart_data.json")

m <- read.delim(MATCHES, stringsAsFactors = FALSE, check.names = FALSE)
m$ca <- mapply(confed_of, m$team_a, m$year)
m$cb <- mapply(confed_of, m$team_b, m$year)

# points for side A / side B in each match
m$pa <- with(m, ifelse(score_a > score_b, 3L, ifelse(score_a == score_b, 1L, 0L)))
m$pb <- with(m, ifelse(score_b > score_a, 3L, ifelse(score_a == score_b, 1L, 0L)))

years <- sort(unique(m$year))

# A tournament is "in progress" if any team has played fewer than 3 group games.
games_per_team <- function(yr) {
  d <- m[m$year == yr, ]
  tab <- table(c(d$team_a, d$team_b))
  min(as.integer(tab))
}
in_progress <- setNames(vapply(years, function(y) games_per_team(y) < 3, logical(1)), years)

# Build challenger-vs-power contributions: one row per (challenger side) appearance.
contrib <- list()  # year, conf, points, win, draw, loss
add <- function(year, conf, pts) {
  contrib[[length(contrib) + 1]] <<- data.frame(
    year = year, conf = conf, points = pts,
    win = as.integer(pts == 3), draw = as.integer(pts == 1), loss = as.integer(pts == 0),
    stringsAsFactors = FALSE)
}
for (i in seq_len(nrow(m))) {
  a <- m$ca[i]; b <- m$cb[i]
  a_pow <- a %in% POWERS; b_pow <- b %in% POWERS
  a_ch  <- a %in% CHALLENGERS; b_ch <- b %in% CHALLENGERS
  if (a_ch && b_pow) add(m$year[i], a, m$pa[i])   # A challenger vs B power
  if (b_ch && a_pow) add(m$year[i], b, m$pb[i])   # B challenger vs A power
  # challenger-vs-challenger and power-vs-power -> ignored
}
cd <- do.call(rbind, contrib)

agg <- function(cf, yr) {
  d <- cd[cd$conf == cf & cd$year == yr, ]
  n <- nrow(d)
  if (n == 0) return(list(n = 0L, pts = NA_integer_, pct = NA_real_, rec = NA_character_))
  pts <- sum(d$points)
  list(n = n, pts = pts, pct = round(100 * pts / (3 * n), 1),
       rec = sprintf("%d-%d-%d", sum(d$win), sum(d$draw), sum(d$loss)))
}

# ---- console table --------------------------------------------------------
cat("\nChallenger share of points in games vs CONMEBOL/UEFA (the old powers)\n")
cat("metric = challenger points / (3 * matches vs a power); cell = pct (matches)\n\n")
hdr <- sprintf("%-10s", "Confed")
for (y in years) hdr <- paste0(hdr, sprintf("%14s", y))
cat(hdr, "\n"); cat(strrep("-", nchar(hdr)), "\n")
for (cf in CHALLENGERS) {
  row <- sprintf("%-10s", cf)
  for (y in years) {
    a <- agg(cf, y)
    cell <- if (a$n == 0) "-" else sprintf("%.1f%% (%dm)", a$pct, a$n)
    row <- paste0(row, sprintf("%14s", cell))
  }
  cat(row, "\n")
}
cat("\n")

# ---- chart JSON -----------------------------------------------------------
field <- function(fn) setNames(lapply(CHALLENGERS, function(cf)
  vapply(years, function(y) { v <- agg(cf, y)[[fn]]; if (is.null(v)) NA else v },
         FUN.VALUE = if (fn == "rec") character(1) else numeric(1))), CHALLENGERS)

labels <- lapply(years, function(y) {
  l <- c(as.character(y), HOSTS[[as.character(y)]])
  if (in_progress[[as.character(y)]]) c(l, "in progress") else l
})

out <- list(
  years  = years,
  labels = labels,
  pct    = field("pct"),
  n      = field("n"),
  pts    = field("pts"),
  rec    = field("rec")
)
writeLines(toJSON(out, auto_unbox = TRUE, na = "null", pretty = TRUE), JSON_OUT)
cat(sprintf("Wrote %s\n", JSON_OUT))
