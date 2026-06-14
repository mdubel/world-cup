# ESPN scoreboard overlay.
#
# Football-data.org is our canonical schedule + metadata source (match IDs,
# team IDs, TLAs, crests, groups, kickoffs). Its free tier doesn't reliably
# deliver live FT scores within a useful window though.
#
# ESPN's unofficial public scoreboard endpoint *does* return real-time scores
# and statuses for the FIFA World Cup, with no auth, no rate limit, and a
# single date-range query covering the whole tournament. We use it strictly
# as a SCORE OVERLAY on top of our existing fixtures pin — we never touch the
# canonical match_id / team_id / crest columns, so existing user predictions,
# trackers, and favourite-team picks stay valid.
#
# Caveats:
# - Unofficial API, no docs, no SLA. If ESPN reshape the JSON we fall back to
#   the football-data scores automatically (the overlay is a no-op if it
#   fails or matches nothing).
# - Match by (kickoff_date_utc, home_team_name, away_team_name) with a tiny
#   alias table for the 2 team names that differ between the two providers.

ESPN_SCOREBOARD_URL <-
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"

# Football-data team name → ESPN team name. Only the deltas; every other
# name matches exactly across the two providers as of 2026 WC.
#
# The Türkiye value uses a \u escape so the literal is guaranteed to carry
# Encoding="UTF-8" regardless of the source-file / R-locale interaction.
# Without that, R compares it as an "unknown" encoding against ESPN's
# already-UTF-8-tagged response and the byte-equal strings DO NOT match in
# a named-vector lookup.
ESPN_TEAM_NAME_ALIASES <- c(
  "Cape Verde Islands" = "Cape Verde",
  "Turkey"             = "Türkiye"
)

# ESPN status.type.name → our internal status string. Anything we don't
# recognise stays at the football-data value (we don't overwrite it).
ESPN_STATUS_MAP <- c(
  STATUS_SCHEDULED         = "TIMED",
  STATUS_IN_PROGRESS       = "IN_PLAY",
  STATUS_FIRST_HALF        = "IN_PLAY",
  STATUS_SECOND_HALF       = "IN_PLAY",
  STATUS_HALFTIME          = "PAUSED",
  STATUS_END_PERIOD        = "IN_PLAY",
  STATUS_END_REGULATION    = "IN_PLAY",
  STATUS_EXTRA_TIME        = "IN_PLAY",
  STATUS_END_EXTRA_TIME    = "IN_PLAY",
  STATUS_PENALTIES         = "IN_PLAY",
  STATUS_SHOOTOUT          = "IN_PLAY",
  STATUS_FULL_TIME         = "FINISHED",
  STATUS_FINAL             = "FINISHED",
  STATUS_FINAL_AET         = "FINISHED",
  STATUS_FINAL_PEN         = "FINISHED",
  STATUS_AFTER_PENALTIES   = "FINISHED",
  STATUS_AFTER_EXTRA_TIME  = "FINISHED",
  STATUS_POSTPONED         = "POSTPONED",
  STATUS_CANCELED          = "CANCELLED",
  STATUS_CANCELLED         = "CANCELLED",
  STATUS_ABANDONED         = "CANCELLED",
  STATUS_SUSPENDED         = "SUSPENDED"
)

# ESPN's scoreboard caps results per call; the date-range query is the
# documented-in-the-wild way to pull a tournament window in one shot.
espn_default_transport <- function(url) {
  if (!requireNamespace("httr2", quietly = TRUE)) {
    stop("The 'httr2' package is required for espn_default_transport().")
  }
  req <- httr2::request(url)
  req <- httr2::req_retry(req, max_tries = 3, backoff = function(i) 2 ^ i)
  resp <- httr2::req_perform(req)
  httr2::resp_body_string(resp)
}

fetch_espn_scoreboard <- function(date_from_utc, date_to_utc,
                                  transport = espn_default_transport) {
  # Allow tests to supply a canned response via env var.
  fixture_path <- Sys.getenv("WC26_ESPN_FIXTURE", unset = "")
  if (nzchar(fixture_path)) {
    raw <- paste(readLines(fixture_path, warn = FALSE), collapse = "\n")
    return(jsonlite::fromJSON(raw, simplifyVector = FALSE))
  }

  fmt <- function(d) format(as.Date(d), "%Y%m%d")
  url <- sprintf("%s?dates=%s-%s&limit=200",
                 ESPN_SCOREBOARD_URL, fmt(date_from_utc), fmt(date_to_utc))
  body <- transport(url)
  jsonlite::fromJSON(body, simplifyVector = FALSE)
}

# Normalise an ESPN team-displayName to its football-data equivalent so we
# can match against the existing fixtures pin.
#
# Why enc2utf8 everywhere: R compares strings using both the bytes AND the
# Encoding attribute. ESPN responses come back with Encoding="UTF-8";
# string literals in this file land as Encoding="unknown" on the Connect
# server (non-UTF-8 locale). Byte-equal strings with different encodings
# DON'T match in a named-vector lookup, which silently breaks the alias
# (e.g. Türkiye → never resolved → 3 Turkey matches dropped per refresh).
normalise_espn_team_name <- function(name) {
  if (is.null(name) || !nzchar(name)) return(NA_character_)
  # Force Encoding="UTF-8" on both sides. enc2utf8() is a no-op when the
  # process locale is "C" (which is what Connect runs as), so we have to
  # set the attribute explicitly. Without this, "Türkiye" (Encoding=unknown
  # in our source literal) doesn't compare equal to ESPN's "Türkiye"
  # (Encoding=UTF-8) even though their bytes are identical.
  name_u <- name
  Encoding(name_u) <- "UTF-8"
  values <- unname(ESPN_TEAM_NAME_ALIASES)
  names_ <- names(ESPN_TEAM_NAME_ALIASES)
  Encoding(values) <- "UTF-8"
  Encoding(names_) <- "UTF-8"
  rev_alias <- setNames(names_, values)
  hit <- rev_alias[name_u]
  if (!is.na(hit)) return(unname(hit))
  name_u
}

# ESPN sometimes drops the seconds component ("2026-06-11T19:00Z" instead
# of "...T19:00:00Z"), so parse_iso_utc misses these. Try a few formats.
parse_espn_date <- function(x) {
  if (is.null(x) || !nzchar(x) || isTRUE(is.na(x))) {
    return(as.POSIXct(NA, tz = "UTC"))
  }
  formats <- c(
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%MZ",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M%z"
  )
  for (fmt in formats) {
    parsed <- suppressWarnings(as.POSIXct(x, format = fmt, tz = "UTC"))
    if (!is.na(parsed)) return(parsed)
  }
  as.POSIXct(NA, tz = "UTC")
}

# Extract one scoreboard row into the columns we overlay onto fixtures.
# Returns a list (not a data frame) so callers can rbind selectively.
espn_event_to_overlay <- function(ev) {
  comp <- ev$competitions[[1]] %||% list()
  comps <- comp$competitors %||% list()
  if (length(comps) < 2) return(NULL)

  home <- Find(function(x) identical(x$homeAway, "home"), comps)
  away <- Find(function(x) identical(x$homeAway, "away"), comps)
  if (is.null(home) || is.null(away)) return(NULL)

  status_node <- (comp$status %||% list())$type %||% list()
  status_name <- status_node$name %||% ""
  detail <- status_node$detail %||% ""
  completed <- isTRUE(status_node$completed)

  our_status <- unname(ESPN_STATUS_MAP[status_name])
  if (is.na(our_status) || is.null(our_status)) our_status <- NA_character_

  parse_score <- function(x) {
    if (is.null(x) || identical(x, "") || isTRUE(is.na(x))) return(NA_integer_)
    suppressWarnings(as.integer(x))
  }

  # ESPN returns competitor.score = "0" for pre-game matches as a UI
  # placeholder. We MUST NOT overlay that onto football-data's real NA,
  # otherwise every unplayed match becomes a 0–0 draw with winner=DRAW.
  # Only treat scores as real when the match has at least started.
  state <- status_node$state %||% ""
  match_started <- state %in% c("in", "post") || isTRUE(completed)

  home_ft <- if (match_started) parse_score(home$score) else NA_integer_
  away_ft <- if (match_started) parse_score(away$score) else NA_integer_

  # Winner: prefer ESPN's explicit "winner" flag (works for PK results too),
  # otherwise compute from scores. NA when the match hasn't decided yet.
  winner <- if (match_started && isTRUE(home$winner)) "HOME"
            else if (match_started && isTRUE(away$winner)) "AWAY"
            else if (match_started && !is.na(home_ft) && !is.na(away_ft)) {
              if (home_ft > away_ft) "HOME"
              else if (away_ft > home_ft) "AWAY"
              # Only call it a DRAW once the match is actually FINISHED;
              # otherwise mid-match 0–0 would prematurely show DRAW.
              else if (identical(state, "post") || isTRUE(completed)) "DRAW"
              else NA_character_
            } else NA_character_

  # Penalties + ET classification from status. We treat any status that
  # implies extra time happened (or is happening) as "had_et"; the PK
  # shootout score is a separate signal on the competitor object.
  ET_OR_PK_STATUSES <- c(
    "STATUS_EXTRA_TIME",
    "STATUS_END_EXTRA_TIME",
    "STATUS_PENALTIES",
    "STATUS_SHOOTOUT",
    "STATUS_FINAL_AET",
    "STATUS_AFTER_EXTRA_TIME",
    "STATUS_FINAL_PEN",
    "STATUS_AFTER_PENALTIES"
  )
  is_pen <- grepl("PEN", detail, fixed = TRUE) ||
            identical(status_name, "STATUS_FINAL_PEN") ||
            identical(status_name, "STATUS_AFTER_PENALTIES") ||
            identical(status_name, "STATUS_PENALTIES") ||
            identical(status_name, "STATUS_SHOOTOUT")
  had_et <- status_name %in% ET_OR_PK_STATUSES

  pk_winner <- if (is_pen) {
    if (isTRUE(home$advance)) "HOME"
    else if (isTRUE(away$advance)) "AWAY"
    else NA_character_
  } else NA_character_

  # ESPN's per-competitor shootoutScore is the PK shootout count (5 for
  # England vs 3 for Switzerland in the canonical Euro 2024 example). It's
  # present whenever the match has reached a PK shootout, even before the
  # final result is decided — perfect for the live "Pens 3–2" display.
  home_pk <- if (is_pen) parse_score(home$shootoutScore) else NA_integer_
  away_pk <- if (is_pen) parse_score(away$shootoutScore) else NA_integer_

  # ESPN doesn't separately expose "score at end of regulation" vs "score
  # at end of ET" — its `score` field is the displayed scoreline at the
  # time of the request. When the match has reached ET (or PKs, which
  # require ET to be tied), `score` is the AET-inclusive total. We surface
  # it as home_score_et so the UI can render the AET badge and the right
  # number; football-data's slower update will eventually fill the proper
  # regulation breakdown into home_score_ft.
  home_et <- if (had_et && !is.na(home_ft)) home_ft else NA_integer_
  away_et <- if (had_et && !is.na(away_ft)) away_ft else NA_integer_

  list(
    kickoff_utc       = parse_espn_date(comp$date %||% ev$date),
    home_team_name_fd = normalise_espn_team_name(home$team$displayName),
    away_team_name_fd = normalise_espn_team_name(away$team$displayName),
    status            = our_status,
    home_score_ft     = home_ft,
    away_score_ft     = away_ft,
    home_score_et     = home_et,
    away_score_et     = away_et,
    home_score_pk     = home_pk,
    away_score_pk     = away_pk,
    winner            = winner,
    pk_winner         = pk_winner,
    completed         = completed,
    status_detail     = detail
  )
}

# Pure function: take a fixtures df + ESPN response, return a new df where
# rows matched by (kickoff date + team name pair) have updated score columns
# from ESPN. Unmatched rows pass through unchanged.
overlay_espn_scores <- function(fixtures_df, espn_resp) {
  if (is.null(fixtures_df) || nrow(fixtures_df) == 0) return(fixtures_df)
  events <- espn_resp$events %||% list()
  if (length(events) == 0) {
    return(structure(fixtures_df,
                     overlay_stats = list(matched = 0L, updated = 0L)))
  }

  overlays <- Filter(Negate(is.null), lapply(events, espn_event_to_overlay))
  if (length(overlays) == 0) {
    return(structure(fixtures_df,
                     overlay_stats = list(matched = 0L, updated = 0L)))
  }

  matched <- 0L
  updated <- 0L
  fx <- fixtures_df

  for (ov in overlays) {
    if (is.na(ov$kickoff_utc) || is.na(ov$home_team_name_fd) ||
        is.na(ov$away_team_name_fd)) next

    # Match on team-name pair + same kickoff date within 24h. The date
    # tolerance handles small reschedules within a day.
    candidates <- which(
      !is.na(fx$home_team_name) &
      !is.na(fx$away_team_name) &
      fx$home_team_name == ov$home_team_name_fd &
      fx$away_team_name == ov$away_team_name_fd &
      !is.na(fx$kickoff_utc) &
      abs(as.numeric(difftime(fx$kickoff_utc, ov$kickoff_utc,
                               units = "hours"))) < 24
    )
    if (length(candidates) != 1) next   # ambiguous or no match — leave it
    i <- candidates[1]
    matched <- matched + 1L

    # Only update fields that ESPN actually filled in. Falling through to
    # the football-data value when ESPN doesn't know yet keeps us closer to
    # reality than overwriting with NA.
    changed <- FALSE
    if (!is.na(ov$status) && !identical(fx$status[i], ov$status)) {
      fx$status[i] <- ov$status; changed <- TRUE
    }
    if (!is.na(ov$home_score_ft) &&
        (is.na(fx$home_score_ft[i]) || fx$home_score_ft[i] != ov$home_score_ft)) {
      fx$home_score_ft[i] <- ov$home_score_ft; changed <- TRUE
    }
    if (!is.na(ov$away_score_ft) &&
        (is.na(fx$away_score_ft[i]) || fx$away_score_ft[i] != ov$away_score_ft)) {
      fx$away_score_ft[i] <- ov$away_score_ft; changed <- TRUE
    }
    if (!is.na(ov$home_score_et) &&
        (is.na(fx$home_score_et[i]) || fx$home_score_et[i] != ov$home_score_et)) {
      fx$home_score_et[i] <- ov$home_score_et; changed <- TRUE
    }
    if (!is.na(ov$away_score_et) &&
        (is.na(fx$away_score_et[i]) || fx$away_score_et[i] != ov$away_score_et)) {
      fx$away_score_et[i] <- ov$away_score_et; changed <- TRUE
    }
    if (!is.na(ov$home_score_pk) &&
        (is.na(fx$home_score_pk[i]) || fx$home_score_pk[i] != ov$home_score_pk)) {
      fx$home_score_pk[i] <- ov$home_score_pk; changed <- TRUE
    }
    if (!is.na(ov$away_score_pk) &&
        (is.na(fx$away_score_pk[i]) || fx$away_score_pk[i] != ov$away_score_pk)) {
      fx$away_score_pk[i] <- ov$away_score_pk; changed <- TRUE
    }
    if (!is.na(ov$winner) && !identical(fx$winner[i], ov$winner)) {
      fx$winner[i] <- ov$winner; changed <- TRUE
    }
    if (!is.na(ov$pk_winner) && !identical(fx$pk_winner[i], ov$pk_winner)) {
      fx$pk_winner[i] <- ov$pk_winner; changed <- TRUE
    }
    if (changed) {
      fx$last_api_update[i] <- now_utc()
      updated <- updated + 1L
    }
  }

  structure(fx, overlay_stats = list(matched = matched, updated = updated))
}

# Convenience: pull from ESPN over the WC window inferred from the fixtures
# df, and overlay. Returns the new fixtures df (with attr overlay_stats).
apply_espn_overlay <- function(fixtures_df,
                               transport = espn_default_transport) {
  if (is.null(fixtures_df) || nrow(fixtures_df) == 0) return(fixtures_df)
  dates <- fixtures_df$kickoff_utc
  dates <- dates[!is.na(dates)]
  if (length(dates) == 0) return(fixtures_df)
  resp <- fetch_espn_scoreboard(min(dates), max(dates), transport = transport)
  overlay_espn_scores(fixtures_df, resp)
}
