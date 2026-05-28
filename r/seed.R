# Local-only fake data. When WC26_BOARD=local and the fixtures pin is empty
# (or WC26_LOCAL_RESEED=true), seed it with this representative dataset so the
# app shows something interesting without having to call the real API.
#
# The kickoff times are computed relative to "now" so that "upcoming" actually
# shows upcoming and "past" actually shows past — important for testing
# spoiler-mode, prediction lock, and the leaderboard at the same time.

LOCAL_SEED_TEAMS <- list(
  list(id = "770", name = "Mexico",         code = "MEX"),
  list(id = "762", name = "United States",  code = "USA"),
  list(id = "771", name = "Canada",         code = "CAN"),
  list(id = "759", name = "Brazil",         code = "BRA"),
  list(id = "765", name = "Argentina",      code = "ARG"),
  list(id = "780", name = "Uruguay",        code = "URU"),
  list(id = "758", name = "Spain",          code = "ESP"),
  list(id = "760", name = "France",         code = "FRA"),
  list(id = "766", name = "Germany",        code = "GER"),
  list(id = "767", name = "England",        code = "ENG"),
  list(id = "768", name = "Portugal",       code = "POR"),
  list(id = "773", name = "Netherlands",    code = "NED"),
  list(id = "774", name = "Croatia",        code = "CRO"),
  list(id = "775", name = "Belgium",        code = "BEL"),
  list(id = "776", name = "Japan",          code = "JPN"),
  list(id = "777", name = "Morocco",        code = "MAR")
)

local_team <- function(id) {
  for (t in LOCAL_SEED_TEAMS) {
    if (t$id == id) return(t)
  }
  list(id = NA_character_, name = NA_character_, code = NA_character_)
}

crest_url <- function(team_id) {
  if (is.null(team_id) || isTRUE(is.na(team_id)) || !nzchar(team_id)) {
    return(NA_character_)
  }
  paste0("https://crests.football-data.org/", team_id, ".svg")
}

local_seed_match <- function(match_id, stage, group, kickoff_utc, status,
                             home_id = NA, away_id = NA,
                             home_ft = NA, away_ft = NA,
                             home_et = NA, away_et = NA,
                             home_pk = NA, away_pk = NA,
                             winner = NA, pk_winner = NA) {
  h <- if (is.na(home_id)) list(id = NA_character_, name = NA_character_, code = NA_character_)
       else local_team(home_id)
  a <- if (is.na(away_id)) list(id = NA_character_, name = NA_character_, code = NA_character_)
       else local_team(away_id)
  data.frame(
    match_id = as.character(match_id),
    stage = stage,
    group = group,
    kickoff_utc = kickoff_utc,
    home_team_id = h$id, home_team_name = h$name,
    home_team_code = h$code, home_team_crest = crest_url(h$id),
    away_team_id = a$id, away_team_name = a$name,
    away_team_code = a$code, away_team_crest = crest_url(a$id),
    status = status,
    home_score_ft = as.integer(home_ft), away_score_ft = as.integer(away_ft),
    home_score_et = as.integer(home_et), away_score_et = as.integer(away_et),
    home_score_pk = as.integer(home_pk), away_score_pk = as.integer(away_pk),
    winner = as.character(winner),
    pk_winner = as.character(pk_winner),
    last_api_update = kickoff_utc + 7200,
    stringsAsFactors = FALSE
  )
}

build_local_seed_fixtures <- function(now = now_utc(),
                                       mode = Sys.getenv("WC26_LOCAL_SEED_MODE",
                                                         unset = "mid")) {
  # Anchor everything to `now`. Two modes:
  #   "mid" (default) — mix of finished + upcoming matches. Demonstrates
  #     spoiler mode, the leaderboard, and prediction lock all at once. The
  #     tournament-winner pick is locked because the earliest match is in the
  #     past (tournament is underway).
  #   "pre" — every match is in the future. Demonstrates the unlocked
  #     tournament-winner pick UI; nothing is finished, so the leaderboard is
  #     empty until a refresh fills in scores.
  hour <- 3600
  if (!mode %in% c("mid", "pre")) mode <- "mid"
  shift <- if (mode == "pre") 10 * 24 * hour else 0

  rows <- list(
    # --- Group stage (already played) -------------------------------------
    local_seed_match(
      "G001", "GROUP_STAGE", "GROUP_A",
      now - 6 * 24 * hour, "FINISHED",
      home_id = "770", away_id = "762",
      home_ft = 2L, away_ft = 1L, winner = "HOME"
    ),
    local_seed_match(
      "G002", "GROUP_STAGE", "GROUP_A",
      now - 5 * 24 * hour, "FINISHED",
      home_id = "771", away_id = "770",
      home_ft = 0L, away_ft = 0L, winner = "DRAW"
    ),
    local_seed_match(
      "G003", "GROUP_STAGE", "GROUP_B",
      now - 5 * 24 * hour, "FINISHED",
      home_id = "759", away_id = "765",
      home_ft = 1L, away_ft = 2L, winner = "AWAY"
    ),
    local_seed_match(
      "G004", "GROUP_STAGE", "GROUP_C",
      now - 4 * 24 * hour, "FINISHED",
      home_id = "758", away_id = "766",
      home_ft = 3L, away_ft = 1L, winner = "HOME"
    ),
    local_seed_match(
      "G005", "GROUP_STAGE", "GROUP_D",
      now - 3 * 24 * hour, "FINISHED",
      home_id = "767", away_id = "768",
      home_ft = 1L, away_ft = 1L, winner = "DRAW"
    ),

    # --- Group stage (live / imminent) ------------------------------------
    local_seed_match(
      "G006", "GROUP_STAGE", "GROUP_B",
      now - 1 * hour, "IN_PLAY",
      home_id = "780", away_id = "759",
      home_ft = 1L, away_ft = 0L
    ),
    local_seed_match(
      "G007", "GROUP_STAGE", "GROUP_C",
      now + 4 * hour, "SCHEDULED",
      home_id = "773", away_id = "766"
    ),
    local_seed_match(
      "G008", "GROUP_STAGE", "GROUP_D",
      now + 1 * 24 * hour, "SCHEDULED",
      home_id = "774", away_id = "775"
    ),

    # --- Group stage (later this week) -----------------------------------
    local_seed_match(
      "G009", "GROUP_STAGE", "GROUP_E",
      now + 2 * 24 * hour, "SCHEDULED",
      home_id = "776", away_id = "777"
    ),
    local_seed_match(
      "G010", "GROUP_STAGE", "GROUP_E",
      now + 3 * 24 * hour, "SCHEDULED",
      home_id = "765", away_id = "771"
    ),

    # --- Knockout: finished round-of-16 with regulation winner -----------
    local_seed_match(
      "K001", "LAST_16", NA,
      now - 2 * 24 * hour, "FINISHED",
      home_id = "760", away_id = "767",
      home_ft = 2L, away_ft = 0L, winner = "HOME"
    ),

    # --- Knockout: finished QF that went to penalties --------------------
    local_seed_match(
      "K002", "QUARTER_FINALS", NA,
      now - 12 * hour, "FINISHED",
      home_id = "759", away_id = "760",
      home_ft = 1L, away_ft = 1L,
      home_et = 0L, away_et = 0L,
      home_pk = 4L, away_pk = 5L,
      winner = "DRAW", pk_winner = "AWAY"
    ),

    # --- Knockout: upcoming with both teams known ------------------------
    local_seed_match(
      "K003", "QUARTER_FINALS", NA,
      now + 8 * hour, "SCHEDULED",
      home_id = "758", away_id = "766"
    ),

    # --- Knockout: upcoming with TBD bracket -----------------------------
    local_seed_match(
      "K004", "SEMI_FINALS", NA,
      now + 5 * 24 * hour, "SCHEDULED"
    ),
    local_seed_match(
      "K005", "FINAL", NA,
      now + 12 * 24 * hour, "SCHEDULED"
    )
  )

  fx <- do.call(rbind, rows)

  if (mode == "pre") {
    # Shift everything into the future and erase scores so the tournament-pick
    # UI is unlocked and nothing leaks "result" data into the demo.
    fx$kickoff_utc <- fx$kickoff_utc + shift
    fx$last_api_update <- fx$kickoff_utc
    fx$status <- "SCHEDULED"
    fx$home_score_ft <- NA_integer_; fx$away_score_ft <- NA_integer_
    fx$home_score_et <- NA_integer_; fx$away_score_et <- NA_integer_
    fx$home_score_pk <- NA_integer_; fx$away_score_pk <- NA_integer_
    fx$winner <- NA_character_
    fx$pk_winner <- NA_character_
  }

  fx
}

is_local_board <- function() {
  identical(resolve_board_mode(), "local")
}

ensure_local_seed <- function() {
  if (!is_local_board()) return(invisible(NULL))

  force_reseed <- identical(tolower(Sys.getenv("WC26_LOCAL_RESEED", "false")),
                            "true")

  fx <- tryCatch(read_fixtures(), error = function(e) empty_fixtures_df())
  if (!force_reseed && nrow(fx) > 0) {
    return(invisible(fx))
  }

  message(sprintf(
    "[wc26] Seeding local fixtures pin (%s).",
    if (force_reseed) "WC26_LOCAL_RESEED=true" else "pin was empty"
  ))
  seed <- build_local_seed_fixtures()
  result <- tryCatch(write_fixtures(seed), error = function(e) e)

  # If a stale local pin from an earlier code revision was created versioned
  # and we now write unversioned, pins refuses with "Pin is versioned, but you
  # have requested a write without versions". Recover by nuking the stale
  # local pin directory and retrying once.
  if (inherits(result, "error")) {
    msg <- conditionMessage(result)
    if (grepl("versioned", msg, ignore.case = TRUE)) {
      message("[wc26] Local pin layout is stale — wiping .dev_pins and retrying.")
      tryCatch(unlink(".dev_pins", recursive = TRUE, force = TRUE),
               error = function(e) NULL)
      .board_cache$board <- NULL
      result <- tryCatch(write_fixtures(seed), error = function(e) e)
    }
  }

  if (inherits(result, "error")) {
    message(sprintf("[wc26] seed write failed: %s", conditionMessage(result)))
    message("[wc26] Try `rm -rf .dev_pins` and restart.")
  }
  invisible(seed)
}
