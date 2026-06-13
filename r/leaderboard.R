# Cached leaderboard snapshot.
#
# The live build_leaderboard() in scoring.R iterates every user's predictions
# pin to compute totals. With N users that's N pin reads per render of the
# leaderboard output — every prediction click previously paid that cost.
#
# Better: the refresh job rebuilds the leaderboard once per refresh cycle
# (10 min) and writes the result to a pin. The app reads the pin in one op.
#
# When does the snapshot need a manual rebuild outside the refresh cadence?
#   - Pre-kickoff prediction changes:  NO  — predictions don't score until kickoff
#   - Tournament-pick changes:         YES — the snapshot's champion_pick column
#                                            shows the user's pick verbatim
#   - New user joins the pool:         NO  — they have 0 points until next refresh
#   - Match finishes / score updates:  Handled by the refresh job naturally
#                                       (it pulls fixtures, then rebuilds the
#                                       snapshot, in the same pass)

empty_leaderboard_snapshot <- function() {
  list(
    rows = data.frame(
      user_id = character(),
      display_name = character(),
      total = integer(),
      group_pts = integer(),
      knockout_pts = integer(),
      tournament_pts = integer(),
      exact_predictions = integer(),
      champion_pick_team_id = character(),
      champion_pick_team_name = character(),
      stringsAsFactors = FALSE
    ),
    computed_at_utc = iso_utc(now_utc())
  )
}

read_leaderboard_snapshot <- function() {
  cached_read("leaderboard", function() {
    snap <- pin_read_or(pin_name("leaderboard"), NULL)
    # Safety net: prettify display_name on read so a stale snapshot written
    # before pretty_display_name() landed surfaces human names anyway. The
    # next refresh cycle will rebuild with already-pretty names; this
    # post-process is idempotent so re-prettifying is a no-op then.
    if (!is.null(snap) && !is.null(snap$rows) && nrow(snap$rows) > 0 &&
        exists("pretty_display_name")) {
      snap$rows$display_name <- vapply(snap$rows$display_name,
                                       pretty_display_name, character(1))
    }
    snap
  })
}

# Best-effort snapshot write. Uses the lock without verify since the only
# writers are the refresh job (one process, scheduled) and the tournament-
# pick observer (rare). A simultaneous double-write would just race to the
# correct value anyway.
write_leaderboard_snapshot <- function(snapshot) {
  with_lock("leaderboard", verify = FALSE, {
    pin_write_safe(pin_name("leaderboard"), snapshot)
  })
  invalidate_cache("leaderboard")
  invisible(snapshot)
}

# Compute a fresh leaderboard from the underlying pins and persist it.
# Accepts pre-loaded data frames so the refresh job (which already has them
# in hand) can skip the redundant reads.
rebuild_leaderboard_snapshot <- function(fixtures_df = NULL,
                                          users_df = NULL,
                                          tpicks_df = NULL) {
  if (is.null(fixtures_df)) fixtures_df <- read_fixtures()
  if (is.null(users_df))    users_df    <- read_users()
  if (is.null(tpicks_df))   tpicks_df   <- read_tournament_picks()

  snapshot <- build_leaderboard(
    fixtures_df         = fixtures_df,
    users_df            = users_df,
    predictions_loader  = read_predictions,
    tournament_picks_df = tpicks_df
  )
  write_leaderboard_snapshot(snapshot)
  snapshot
}
