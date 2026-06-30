library(jsonlite)

API_BASE <- "https://api.football-data.org/v4"
COMPETITION_CODE <- "WC"

football_data_token <- function() {
  tok <- Sys.getenv("FOOTBALL_DATA_TOKEN", unset = "")
  if (!nzchar(tok)) {
    stop("FOOTBALL_DATA_TOKEN env var is not set")
  }
  tok
}

default_transport <- function(url, headers = list()) {
  if (!requireNamespace("httr2", quietly = TRUE)) {
    stop("The 'httr2' package is required for default_transport(). Install it or pass a custom transport.")
  }
  req <- httr2::request(url)
  for (nm in names(headers)) {
    req <- httr2::req_headers(req, !!nm := headers[[nm]])
  }
  req <- httr2::req_retry(req, max_tries = 3, backoff = function(i) 2 ^ i)
  resp <- httr2::req_perform(req)
  httr2::resp_body_string(resp)
}

fetch_matches <- function(transport = default_transport,
                          competition = COMPETITION_CODE,
                          season = NULL) {
  fixture_path <- Sys.getenv("WC26_API_FIXTURE", unset = "")
  if (nzchar(fixture_path)) {
    raw <- paste(readLines(fixture_path, warn = FALSE), collapse = "\n")
    return(jsonlite::fromJSON(raw, simplifyVector = FALSE))
  }

  url <- sprintf("%s/competitions/%s/matches", API_BASE, competition)
  if (!is.null(season)) {
    url <- sprintf("%s?season=%s", url, season)
  }
  body <- transport(url, list(`X-Auth-Token` = football_data_token()))
  jsonlite::fromJSON(body, simplifyVector = FALSE)
}

normalize_winner <- function(api_winner) {
  if (is.null(api_winner)) return(NA_character_)
  switch(api_winner,
         HOME_TEAM = "HOME",
         AWAY_TEAM = "AWAY",
         DRAW = "DRAW",
         NA_character_)
}

derive_pk_winner <- function(home_pk, away_pk) {
  if (is.null(home_pk) || is.null(away_pk)) return(NA_character_)
  if (is.na(home_pk) || is.na(away_pk)) return(NA_character_)
  if (home_pk > away_pk) return("HOME")
  if (away_pk > home_pk) return("AWAY")
  NA_character_
}

null_to_na <- function(x, type = "character") {
  if (is.null(x)) {
    return(switch(type,
                  character = NA_character_,
                  integer = NA_integer_,
                  numeric = NA_real_,
                  NA))
  }
  x
}

api_match_to_row <- function(m) {
  home <- m$homeTeam %||% list()
  away <- m$awayTeam %||% list()
  score <- m$score %||% list()
  ft <- score$fullTime %||% list()
  et <- score$extraTime %||% list()
  pk <- score$penalties %||% list()

  home_pk <- as.integer(null_to_na(pk$home, "integer"))
  away_pk <- as.integer(null_to_na(pk$away, "integer"))

  # football-data sets score.winner = HOME_TEAM/AWAY_TEAM for PK-decided
  # matches, naming the team that ADVANCED via the shootout. For our
  # scoring rules the regulation+ET outcome of a PK match is DRAW — the
  # PK winner is tracked separately in pk_winner. Override the wire
  # value here so the rest of the pipeline sees the correct match
  # outcome. (Identical issue exists in api_espn.R; both sources need
  # the same correction.)
  duration <- as.character(null_to_na(score$duration))
  went_to_pks <- !is.na(duration) && identical(duration, "PENALTY_SHOOTOUT")
  winner_corrected <- if (went_to_pks) "DRAW" else normalize_winner(score$winner)

  data.frame(
    match_id = as.character(m$id),
    stage = as.character(null_to_na(m$stage)),
    group = as.character(null_to_na(m$group)),
    kickoff_utc = parse_iso_utc(m$utcDate),
    home_team_id = as.character(null_to_na(home$id)),
    home_team_name = as.character(null_to_na(home$name)),
    home_team_code = as.character(null_to_na(home$tla)),
    home_team_crest = as.character(null_to_na(home$crest)),
    away_team_id = as.character(null_to_na(away$id)),
    away_team_name = as.character(null_to_na(away$name)),
    away_team_code = as.character(null_to_na(away$tla)),
    away_team_crest = as.character(null_to_na(away$crest)),
    status = as.character(null_to_na(m$status)),
    home_score_ft = as.integer(null_to_na(ft$home, "integer")),
    away_score_ft = as.integer(null_to_na(ft$away, "integer")),
    home_score_et = as.integer(null_to_na(et$home, "integer")),
    away_score_et = as.integer(null_to_na(et$away, "integer")),
    home_score_pk = home_pk,
    away_score_pk = away_pk,
    winner = winner_corrected,
    pk_winner = derive_pk_winner(home_pk, away_pk),
    last_api_update = parse_iso_utc(m$lastUpdated),
    stringsAsFactors = FALSE
  )
}

api_response_to_fixtures <- function(resp) {
  matches <- resp$matches %||% list()
  if (length(matches) == 0) {
    return(empty_fixtures_df())
  }
  rows <- lapply(matches, api_match_to_row)
  do.call(rbind, rows)
}
