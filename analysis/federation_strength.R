#!/usr/bin/env Rscript
# ---------------------------------------------------------------------------
# Federation strength over time: % of available group-stage points per
# confederation, FIFA World Cups 1998 -> present.
#
#   metric = group-stage points won / (3 * group games played)
#
# Each team plays 3 group games when a tournament is complete (max 9 pts), so
# for finished tournaments the denominator is 9 * (teams). For an IN-PROGRESS
# tournament we divide by games actually played, so the percentage stays
# meaningful mid-way through.
#
# A game between two same-confederation teams counts for BOTH teams (each had
# it as one of their games) -- matching the original definition.
#
# USAGE
#   Rscript analysis/federation_strength.R           # read analysis/wc2026.tsv, compute, write JSON
#   Rscript analysis/federation_strength.R --fetch   # refresh wc2026.tsv from football-data.org first
#                                                     #   (needs FOOTBALL_DATA_TOKEN set)
#
# OUTPUT
#   - prints a table to the console
#   - writes analysis/federation_chart_data.json  (consumed by the chart template)
# ---------------------------------------------------------------------------

suppressWarnings(suppressMessages({
  library(jsonlite)
}))

HERE        <- tryCatch(dirname(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1])), error = function(e) ".")
if (is.na(HERE) || !nzchar(HERE)) HERE <- "analysis"
TSV_2026    <- file.path(HERE, "wc2026.tsv")
JSON_OUT    <- file.path(HERE, "federation_chart_data.json")

source(file.path(HERE, "confederations.R"))  # CONFEDS, HOSTS, CONFED_MAP, confed_of, %||%

# --------------------------------------------------------------------------
# Frozen history: group-stage points per team, 1998-2022 (verified vs the
# per-group Wikipedia standings). Format per line: "year;team;points".
# Every team played exactly 3 group games in these tournaments.
# --------------------------------------------------------------------------
HISTORY_RAW <- "
1998;Brazil;6
1998;Norway;5
1998;Morocco;4
1998;Scotland;1
1998;Italy;7
1998;Chile;3
1998;Austria;2
1998;Cameroon;2
1998;France;9
1998;Denmark;4
1998;South Africa;2
1998;Saudi Arabia;1
1998;Nigeria;6
1998;Paraguay;5
1998;Spain;4
1998;Bulgaria;1
1998;Netherlands;5
1998;Mexico;5
1998;Belgium;3
1998;South Korea;1
1998;Germany;7
1998;FR Yugoslavia;7
1998;Iran;3
1998;United States;0
1998;Romania;7
1998;England;6
1998;Colombia;3
1998;Tunisia;1
1998;Argentina;9
1998;Croatia;6
1998;Jamaica;3
1998;Japan;0
2002;Denmark;7
2002;Senegal;5
2002;Uruguay;2
2002;France;1
2002;Spain;9
2002;Paraguay;4
2002;South Africa;4
2002;Slovenia;0
2002;Brazil;9
2002;Turkey;4
2002;Costa Rica;4
2002;China;0
2002;South Korea;7
2002;United States;4
2002;Portugal;3
2002;Poland;3
2002;Germany;7
2002;Republic of Ireland;5
2002;Cameroon;4
2002;Saudi Arabia;0
2002;Sweden;5
2002;England;5
2002;Argentina;4
2002;Nigeria;1
2002;Mexico;7
2002;Italy;4
2002;Croatia;3
2002;Ecuador;3
2002;Japan;7
2002;Belgium;5
2002;Russia;3
2002;Tunisia;1
2006;Germany;9
2006;Ecuador;6
2006;Poland;3
2006;Costa Rica;0
2006;England;7
2006;Sweden;5
2006;Paraguay;3
2006;Trinidad and Tobago;1
2006;Argentina;7
2006;Netherlands;7
2006;Ivory Coast;3
2006;Serbia and Montenegro;0
2006;Portugal;9
2006;Mexico;4
2006;Angola;2
2006;Iran;1
2006;Italy;7
2006;Ghana;6
2006;Czech Republic;3
2006;United States;1
2006;Brazil;9
2006;Australia;4
2006;Croatia;2
2006;Japan;1
2006;Switzerland;7
2006;France;5
2006;South Korea;4
2006;Togo;0
2006;Spain;9
2006;Ukraine;6
2006;Tunisia;1
2006;Saudi Arabia;1
2010;Uruguay;7
2010;Mexico;4
2010;South Africa;4
2010;France;1
2010;Argentina;9
2010;South Korea;4
2010;Greece;3
2010;Nigeria;1
2010;United States;5
2010;England;5
2010;Slovenia;4
2010;Algeria;1
2010;Germany;6
2010;Ghana;4
2010;Australia;4
2010;Serbia;3
2010;Netherlands;9
2010;Japan;6
2010;Denmark;3
2010;Cameroon;0
2010;Paraguay;5
2010;Slovakia;4
2010;New Zealand;3
2010;Italy;2
2010;Brazil;7
2010;Portugal;5
2010;Ivory Coast;4
2010;North Korea;0
2010;Spain;6
2010;Chile;6
2010;Switzerland;4
2010;Honduras;1
2014;Brazil;7
2014;Mexico;7
2014;Croatia;3
2014;Cameroon;0
2014;Netherlands;9
2014;Chile;6
2014;Spain;3
2014;Australia;0
2014;Colombia;9
2014;Greece;4
2014;Ivory Coast;3
2014;Japan;1
2014;Costa Rica;7
2014;Uruguay;6
2014;Italy;3
2014;England;1
2014;France;7
2014;Switzerland;6
2014;Ecuador;4
2014;Honduras;0
2014;Argentina;9
2014;Nigeria;4
2014;Bosnia and Herzegovina;3
2014;Iran;1
2014;Germany;7
2014;United States;4
2014;Portugal;4
2014;Ghana;1
2014;Belgium;9
2014;Algeria;4
2014;Russia;2
2014;South Korea;1
2018;Uruguay;9
2018;Russia;6
2018;Saudi Arabia;3
2018;Egypt;0
2018;Spain;5
2018;Portugal;5
2018;Iran;4
2018;Morocco;1
2018;France;7
2018;Denmark;5
2018;Peru;3
2018;Australia;1
2018;Croatia;9
2018;Argentina;4
2018;Nigeria;3
2018;Iceland;1
2018;Brazil;7
2018;Switzerland;5
2018;Serbia;3
2018;Costa Rica;1
2018;Sweden;6
2018;Mexico;6
2018;South Korea;3
2018;Germany;3
2018;Belgium;9
2018;England;6
2018;Tunisia;3
2018;Panama;0
2018;Colombia;6
2018;Japan;4
2018;Senegal;4
2018;Poland;3
2022;Netherlands;7
2022;Senegal;6
2022;Ecuador;4
2022;Qatar;0
2022;England;7
2022;United States;5
2022;Iran;3
2022;Wales;1
2022;Argentina;6
2022;Poland;4
2022;Mexico;4
2022;Saudi Arabia;3
2022;France;6
2022;Australia;6
2022;Tunisia;4
2022;Denmark;1
2022;Japan;6
2022;Spain;4
2022;Germany;4
2022;Costa Rica;3
2022;Morocco;7
2022;Croatia;5
2022;Belgium;4
2022;Canada;0
2022;Brazil;6
2022;Switzerland;6
2022;Cameroon;4
2022;Serbia;1
2022;Portugal;6
2022;South Korea;4
2022;Uruguay;4
2022;Ghana;3
"

parse_history <- function() {
  lines <- Filter(nzchar, trimws(strsplit(HISTORY_RAW, "\n")[[1]]))
  parts <- strsplit(lines, ";", fixed = TRUE)
  year  <- as.integer(vapply(parts, `[`, "", 1))
  team  <- vapply(parts, `[`, "", 2)
  pts   <- as.integer(vapply(parts, `[`, "", 3))
  conf  <- mapply(confed_of, team, year, USE.NAMES = FALSE)
  data.frame(year = year, team = team, points = pts, games = 3L,
             confederation = conf, stringsAsFactors = FALSE)
}

read_2026 <- function() {
  if (!file.exists(TSV_2026)) {
    message(sprintf("No %s yet -- skipping the in-progress tournament.", TSV_2026))
    return(NULL)
  }
  d <- read.delim(TSV_2026, stringsAsFactors = FALSE, check.names = FALSE)
  if (nrow(d) == 0) return(NULL)
  stopifnot(all(c("team","games_played","points","confederation") %in% names(d)))
  bad <- setdiff(unique(d$confederation), CONFEDS)
  if (length(bad)) stop(sprintf("Unknown confederation(s) in %s: %s", TSV_2026, paste(bad, collapse = ", ")))
  data.frame(year = 2026L, team = d$team, points = as.integer(d$points),
             games = as.integer(d$games_played), confederation = d$confederation,
             stringsAsFactors = FALSE)
}

# Aggregate -> per (year, confederation): points, teams, games, pct
compute <- function(df) {
  if (is.null(df) || nrow(df) == 0) return(df)
  key <- paste(df$year, df$confederation, sep = "|")
  agg <- data.frame(
    key    = names(tapply(df$points, key, sum)),
    points = as.integer(tapply(df$points, key, sum)),
    teams  = as.integer(tapply(df$points, key, length)),
    games  = as.integer(tapply(df$games,  key, sum)),
    stringsAsFactors = FALSE
  )
  kp <- do.call(rbind, strsplit(agg$key, "|", fixed = TRUE))
  agg$year <- as.integer(kp[, 1])
  agg$confederation <- kp[, 2]
  agg$pct <- round(100 * agg$points / (3 * agg$games), 1)
  agg[order(agg$year, agg$confederation), c("year","confederation","points","teams","games","pct")]
}

# ---- optional: refresh wc2026.tsv straight from football-data.org ----------
fetch_2026 <- function() {
  tok <- Sys.getenv("FOOTBALL_DATA_TOKEN", unset = "")
  if (!nzchar(tok)) stop("FOOTBALL_DATA_TOKEN is not set -- cannot --fetch. Edit wc2026.tsv by hand instead.")
  if (!requireNamespace("httr2", quietly = TRUE)) stop("Package 'httr2' is required for --fetch.")
  url  <- "https://api.football-data.org/v4/competitions/WC/matches"
  resp <- httr2::req_perform(httr2::req_headers(httr2::request(url), `X-Auth-Token` = tok))
  body <- jsonlite::fromJSON(httr2::resp_body_string(resp), simplifyVector = FALSE)
  ms   <- body$matches
  tally <- list()  # team -> c(points, games, <group letter>)
  grp_of <- list()
  for (m in ms) {
    if (!identical(m$stage, "GROUP_STAGE")) next
    if (!identical(m$status, "FINISHED"))   next
    h <- m$homeTeam$name; a <- m$awayTeam$name
    hs <- m$score$fullTime$home; as_ <- m$score$fullTime$away
    if (is.null(h) || is.null(a) || is.null(hs) || is.null(as_)) next
    grp <- sub("^GROUP_", "", m$group %||% "")
    grp_of[[h]] <- grp; grp_of[[a]] <- grp
    hp <- if (hs > as_) 3 else if (hs == as_) 1 else 0
    ap <- if (as_ > hs) 3 else if (as_ == hs) 1 else 0
    for (kv in list(c(h, hp), c(a, ap))) {
      t <- kv[1]; p <- as.integer(kv[2])
      cur <- tally[[t]] %||% c(points = 0, games = 0)
      tally[[t]] <- c(points = cur[["points"]] + p, games = cur[["games"]] + 1)
    }
  }
  if (!length(tally)) stop("API returned no FINISHED group-stage matches yet.")
  teams <- names(tally)
  out <- data.frame(
    team          = teams,
    group         = vapply(teams, function(t) grp_of[[t]] %||% "", ""),
    games_played  = vapply(teams, function(t) tally[[t]][["games"]], 0),
    points        = vapply(teams, function(t) tally[[t]][["points"]], 0),
    confederation = NA_character_,
    stringsAsFactors = FALSE
  )
  # carry over confederations already present in the TSV so they aren't lost
  if (file.exists(TSV_2026)) {
    prev <- read.delim(TSV_2026, stringsAsFactors = FALSE)
    out$confederation <- prev$confederation[match(out$team, prev$team)]
  }
  out <- out[order(out$group, -out$points, out$team), ]
  write.table(out, TSV_2026, sep = "\t", quote = FALSE, row.names = FALSE)
  miss <- out$team[is.na(out$confederation)]
  if (length(miss))
    message("NOTE: fill in confederation for new team(s) in wc2026.tsv: ", paste(miss, collapse = ", "))
  message(sprintf("Refreshed %s (%d teams, %d team-games).", TSV_2026, nrow(out), sum(out$games_played)))
}

`%||%` <- function(a, b) if (is.null(a)) b else a

# --------------------------------------------------------------------------
main <- function() {
  args <- commandArgs(TRUE)
  if ("--fetch" %in% args) fetch_2026()

  all <- rbind(parse_history(), read_2026())
  res <- compute(all)
  years <- sort(unique(res$year))

  # console table
  cat("\n% of available group-stage points per confederation\n")
  cat("(metric = points won / (3 * games played); 2026 may be partial)\n\n")
  hdr <- sprintf("%-10s", "Confed")
  for (y in years) hdr <- paste0(hdr, sprintf("%14s", y))
  cat(hdr, "\n"); cat(strrep("-", nchar(hdr)), "\n")
  for (cf in CONFEDS) {
    row <- sprintf("%-10s", cf)
    for (y in years) {
      r <- res[res$year == y & res$confederation == cf, ]
      cell <- if (nrow(r) == 0) "-" else sprintf("%.1f%% (%dt)", r$pct, r$teams)
      row <- paste0(row, sprintf("%14s", cell))
    }
    cat(row, "\n")
  }
  cat("\n")

  # chart-ready JSON
  arr <- function(field) {
    setNames(lapply(CONFEDS, function(cf)
      vapply(years, function(y) {
        r <- res[res$year == y & res$confederation == cf, ]
        if (nrow(r) == 0) NA_real_ else r[[field]]
      }, numeric(1))), CONFEDS)
  }
  labels <- lapply(years, function(y) c(as.character(y), HOSTS[[as.character(y)]]))
  # mark any year where some confed still has games < teams*3 as in-progress
  in_progress <- vapply(years, function(y) {
    any(res$year == y & res$games < res$teams * 3)
  }, logical(1))
  for (i in seq_along(years)) if (in_progress[i]) labels[[i]] <- c(labels[[i]], "in progress")

  out <- list(
    years   = years,
    labels  = labels,
    hosts   = unname(HOSTS[as.character(years)]),
    gp_avg  = vapply(years, function(y) {  # typical games/team that year (3 = complete, <3 = partial)
                r <- res[res$year == y, ]; round(sum(r$games) / sum(r$teams)) }, numeric(1)),
    pct     = arr("pct"),
    teams   = arr("teams"),
    pts     = arr("points")
  )
  writeLines(toJSON(out, auto_unbox = TRUE, na = "null", pretty = TRUE), JSON_OUT)
  cat(sprintf("Wrote %s\n", JSON_OUT))
}

main()
