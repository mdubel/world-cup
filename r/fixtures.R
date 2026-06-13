empty_fixtures_df <- function() {
  data.frame(
    match_id = character(), stage = character(), group = character(),
    kickoff_utc = as.POSIXct(character(), tz = "UTC"),
    home_team_id = character(), home_team_name = character(),
    home_team_code = character(), home_team_crest = character(),
    away_team_id = character(), away_team_name = character(),
    away_team_code = character(), away_team_crest = character(),
    status = character(),
    home_score_ft = integer(), away_score_ft = integer(),
    home_score_et = integer(), away_score_et = integer(),
    home_score_pk = integer(), away_score_pk = integer(),
    winner = character(), pk_winner = character(),
    last_api_update = as.POSIXct(character(), tz = "UTC"),
    stringsAsFactors = FALSE
  )
}

read_fixtures <- function() {
  cached_read("fixtures", function() {
    pin_read_or(pin_name("fixtures"), empty_fixtures_df())
  })
}

write_fixtures <- function(df) {
  with_lock("fixtures", {
    pin_write_safe(pin_name("fixtures"), df)
  })
  invalidate_cache("fixtures")
  invisible(df)
}

fixtures_to_payload <- function(fx) {
  if (is.null(fx) || nrow(fx) == 0) {
    return(list())
  }
  fx$kickoff_utc <- iso_utc(fx$kickoff_utc)
  fx$last_api_update <- iso_utc(fx$last_api_update)
  as.list(fx)
}

list_unique_teams <- function(fx) {
  if (is.null(fx) || nrow(fx) == 0) return(list())
  crest_col <- function(col) {
    if (is.null(fx[[col]])) rep(NA_character_, nrow(fx)) else fx[[col]]
  }
  ids   <- c(fx$home_team_id, fx$away_team_id)
  names <- c(fx$home_team_name, fx$away_team_name)
  codes <- c(fx$home_team_code, fx$away_team_code)
  crests <- c(crest_col("home_team_crest"), crest_col("away_team_crest"))
  df <- data.frame(team_id = ids, team_name = names,
                   team_code = codes, team_crest = crests,
                   stringsAsFactors = FALSE)
  df <- df[!is.na(df$team_id) & nzchar(df$team_id), , drop = FALSE]
  df <- df[!duplicated(df$team_id), , drop = FALSE]
  if (nrow(df) == 0) return(list())
  df <- df[order(df$team_name), , drop = FALSE]
  rownames(df) <- NULL
  as.list(df)
}
