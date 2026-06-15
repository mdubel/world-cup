# Per-game stats — pre-computed by the refresh job alongside the
# leaderboard snapshot so the Stats tab reads it in one pin op.
#
# Why a separate pin instead of folding into the leaderboard snapshot:
# the shapes are very different (per-user totals vs per-match histogram
# + scorers) and they get re-rendered by different reactive triggers
# in the app. Keeping them apart also means a Stats output failure
# during rebuild can't break the leaderboard.

empty_game_stats <- function() {
  list(
    games = list(),
    superlatives = list(
      most_obvious = NULL,
      most_surprising = NULL,
      biggest_split = NULL
    ),
    points_timeline = list(),
    computed_at_utc = iso_utc(now_utc())
  )
}

read_game_stats <- function() {
  cached_read("game_stats", function() {
    pin_read_or(pin_name("game_stats"), NULL)
  })
}

write_game_stats <- function(stats) {
  with_lock("game_stats", verify = FALSE, {
    pin_write_safe(pin_name("game_stats"), stats)
  })
  invalidate_cache("game_stats")
  invisible(stats)
}

# `build_game_stats()` lives in scoring.R alongside score_user since it
# reuses the same per-match scoring logic. This rebuild wrapper passes
# the pre-loaded data through to avoid re-reading users / tournament
# picks pins that the caller already has in hand.
rebuild_game_stats <- function(fixtures_df = NULL,
                                users_df = NULL,
                                tpicks_df = NULL) {
  if (is.null(fixtures_df)) fixtures_df <- read_fixtures()
  if (is.null(users_df))    users_df    <- read_users()
  if (is.null(tpicks_df))   tpicks_df   <- read_tournament_picks()

  stats <- build_game_stats(
    fixtures_df         = fixtures_df,
    users_df            = users_df,
    predictions_loader  = read_predictions,
    tournament_picks_df = tpicks_df
  )
  write_game_stats(stats)
  stats
}
