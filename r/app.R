library(shiny)
library(jsonlite)

source("shinyreact.R", local = TRUE)
source("util_time.R", local = TRUE)
source("auth.R", local = TRUE)
source("data.R", local = TRUE)
source("scoring.R", local = TRUE)
source("api.R", local = TRUE)
source("api_espn.R", local = TRUE)
source("fixtures.R", local = TRUE)
source("users.R", local = TRUE)
source("predictions.R", local = TRUE)
source("tracker.R", local = TRUE)
source("leaderboard.R", local = TRUE)
source("game_stats.R", local = TRUE)
source("refresh.R", local = TRUE)
source("admin.R", local = TRUE)
source("seed.R", local = TRUE)

# Auto-seed the fixtures pin with fake data when running locally outside
# Connect, so the app shows something interesting without the user having to
# run the refresh job manually. No-op on Connect.
ensure_local_seed()

# Warm the read cache so the very first session served by this worker
# doesn't pay the full pin_read latency on its initial render — that was
# the 'Loading fixtures…' state users were waiting on. Errors here are
# non-fatal: we just fall back to lazy reads inside the server function.
tryCatch({
  read_fixtures()
  read_users()
  read_tournament_picks()
  read_leaderboard_snapshot()
}, error = function(e) {
  message("Cache warm-up failed (non-fatal): ", conditionMessage(e))
})

server <- function(input, output, session) {
  user_info <- current_user(session)
  uid <- user_info$id

  # Live fixtures poll. Every 30s each open session checks the fixtures
  # pin's metadata (cheap — pin_meta is a single HTTP call, no rds
  # download) and only re-reads the full data when the fingerprint
  # changes. Downstream consumers (output$fixtures, output$leaderboard,
  # etc.) re-evaluate only when valueFunc returns a new value, so a tab
  # left open during a match shows new scores ~30-60s after the refresh
  # job writes them — no manual reload.
  #
  # The valueFunc still goes through cached_read in r/fixtures.R, so
  # multiple sessions in the same Connect worker share one pin_read per
  # cache-TTL window. checkFunc uses pin_meta which is cheap enough that
  # per-session polling is fine.
  fixtures_rv <- reactivePoll(
    intervalMillis = 30000,
    session = session,
    checkFunc = function() pin_meta_modified(pin_name("fixtures")),
    valueFunc = function() read_fixtures()
  )

  # Memoize derived fixture data (teams + lock time) so any consumer can
  # cheaply re-read them without rebuilding from the full fixtures df.
  fixtures_meta <- reactive({
    fx <- fixtures_rv()
    list(
      teams = list_unique_teams(fx),
      tournament_lock_utc = tournament_lock_time(fx)
    )
  })

  leaderboard_snapshot_invalidator <- reactiveVal(0L)
  invalidate_leaderboard_snapshot <- function() {
    leaderboard_snapshot_invalidator(leaderboard_snapshot_invalidator() + 1L)
  }

  predictions_invalidator <- reactiveVal(0L)
  invalidate_predictions <- function() {
    predictions_invalidator(predictions_invalidator() + 1L)
  }

  tracker_invalidator <- reactiveVal(0L)
  invalidate_tracker <- function() {
    tracker_invalidator(tracker_invalidator() + 1L)
  }

  tournament_invalidator <- reactiveVal(0L)
  invalidate_tournament <- function() {
    tournament_invalidator(tournament_invalidator() + 1L)
  }

  observe({
    tz_val <- input$client_tz
    touch_user(uid, user_info$display_name,
               tz = if (is.null(tz_val) || !nzchar(tz_val)) NA_character_ else tz_val)
  })

  user_settings_invalidator <- reactiveVal(0L)
  invalidate_user_settings <- function() {
    user_settings_invalidator(user_settings_invalidator() + 1L)
  }

  output$current_user <- render_json({
    user_settings_invalidator()
    profile <- read_user_profile(uid)
    list(
      id = uid,
      display_name = user_info$display_name,
      is_dev = isTRUE(user_info$is_dev),
      is_admin = isTRUE(is_admin(user_info)),
      tz = if (is.null(profile)) NULL else profile$tz,
      theme = if (is.null(profile)) NULL else profile$theme,
      favorite_team_id = if (is.null(profile)) NULL else profile$favorite_team_id
    )
  })

  observeEvent(input$set_user_tz, ignoreInit = TRUE, {
    tz <- input$set_user_tz
    if (is.null(tz) || !nzchar(tz)) return()
    set_user_tz(uid, tz)
    invalidate_user_settings()
  })

  observeEvent(input$set_user_theme, ignoreInit = TRUE, {
    theme <- input$set_user_theme
    if (is.null(theme) || !theme %in% c("light", "dark")) return()
    set_user_theme(uid, theme)
    invalidate_user_settings()
  })

  observeEvent(input$set_user_favorite_team, ignoreInit = TRUE, {
    team_id <- input$set_user_favorite_team
    # Empty string / NULL clears the favorite (legitimate UX path).
    set_user_favorite_team(uid, team_id)
    invalidate_user_settings()
  })

  output$fixtures <- render_json({
    fx <- fixtures_rv()
    meta <- fixtures_meta()
    list(
      rows = fixtures_to_payload(fx),
      teams = meta$teams,
      tournament_lock_utc = iso_utc(meta$tournament_lock_utc),
      server_now_utc = iso_utc(now_utc())
    )
  })

  output$tracker <- render_json({
    tracker_invalidator()
    df <- read_tracker(uid)
    tracker_to_payload(df)
  })

  output$predictions <- render_json({
    predictions_invalidator()
    df <- read_predictions(uid)
    predictions_to_payload(df)
  })

  output$tournament_pick <- render_json({
    tournament_invalidator()
    pick <- read_tournament_pick(uid)
    if (is.null(pick)) list(team_id = NULL) else pick
  })

  output$leaderboard <- render_json({
    # Three triggers (in increasing rebuild cost):
    #  - leaderboard_snapshot_invalidator: an in-app event wrote a fresh
    #    snapshot (e.g. tournament-pick change). Cheap re-read.
    #  - fixtures_rv: a fixtures refresh happened. The refresh job already
    #    wrote a fresh snapshot; we just re-read.
    #  - predictions_invalidator / tournament_invalidator: kept for
    #    backwards compatibility with the fallback live-build path below,
    #    but the snapshot will usually short-circuit before that matters.
    leaderboard_snapshot_invalidator()
    fixtures_rv()
    predictions_invalidator()
    tournament_invalidator()

    # Bust the snapshot's process cache before reading. Without this, a
    # fixtures-poll tick that detected a refresh-job write would still
    # see the previous in-process leaderboard snapshot until the cache's
    # 30s TTL expired — i.e. live scores update but totals lag.
    invalidate_cache("leaderboard")
    board <- read_leaderboard_snapshot()
    if (is.null(board) || is.null(board$rows) || nrow(board$rows) == 0) {
      # First-deploy fallback: the refresh job hasn't run yet, so there's
      # no snapshot. Pay the live-build cost this once.
      board <- build_leaderboard(
        fixtures_df = fixtures_rv(),
        users_df = read_users(),
        predictions_loader = read_predictions,
        tournament_picks_df = read_tournament_picks()
      )
    }
    list(
      rows = if (is.null(board$rows) || nrow(board$rows) == 0) {
        list()
      } else {
        as.list(board$rows)
      },
      computed_at_utc = board$computed_at_utc
    )
  })

  output$game_stats <- render_json({
    # Feature-flagged to the same WC26_ADMINS allowlist as the Admin tab
    # while we test — the UI also hides the Stats tab for non-admins, but
    # the server-side guard means a non-admin can't pull the data even
    # by poking the websocket directly. Drop this check when we open it
    # up to the whole office pool.
    if (!isTRUE(is_admin(user_info))) {
      return(list(error = "not_authorized"))
    }
    # Mirror the leaderboard wiring: re-render when the fixtures poll
    # detects a refresh-job write, and bust the in-process cache so we
    # actually read the fresh stats pin (not the stale cached copy).
    fixtures_rv()
    invalidate_cache("game_stats")
    stats <- read_game_stats()
    # Fallback: the wc26_game_stats pin may not exist yet (fresh deploy
    # of build_game_stats() before the refresh job has run) OR it might
    # be present but empty. In both cases, build the stats inline this
    # one time so the user sees real data instead of "no finished
    # matches yet" with 12 finished matches on the schedule. Same pattern
    # as the leaderboard live-build fallback.
    if (is.null(stats) || length(stats$games) == 0) {
      stats <- tryCatch(
        build_game_stats(
          fixtures_df         = fixtures_rv(),
          users_df            = read_users(),
          predictions_loader  = read_predictions,
          tournament_picks_df = read_tournament_picks()
        ),
        error = function(e) {
          warning(sprintf("Inline game-stats build failed: %s",
                          conditionMessage(e)))
          NULL
        }
      )
    }
    if (is.null(stats)) {
      return(list(
        games = list(),
        superlatives = list(
          most_obvious = NULL,
          most_surprising = NULL,
          biggest_split = NULL
        ),
        points_timeline = list(),
        computed_at_utc = iso_utc(now_utc())
      ))
    }
    stats
  })

  output$leaderboard_detail <- render_json({
    predictions_invalidator()
    tournament_invalidator()
    selected <- input$detail_user_id
    if (is.null(selected) || !nzchar(selected)) {
      return(list(user_id = NULL, per_match = list(),
                  group_pts = 0L, knockout_pts = 0L,
                  tournament_pts = 0L, total = 0L,
                  exact_predictions = 0L))
    }
    fx <- fixtures_rv()
    preds <- read_predictions(selected)
    tpick_row <- read_tournament_picks()
    tpick <- if (nrow(tpick_row) == 0) NULL else {
      m <- tpick_row[tpick_row$user_id == selected, , drop = FALSE]
      if (nrow(m) == 0) NULL else as.list(m[1, , drop = FALSE])
    }
    s <- score_user(preds, tpick, fx)
    per_match <- if (is.null(s$per_match) || nrow(s$per_match) == 0) {
      list()
    } else {
      as.list(s$per_match)
    }
    list(
      user_id = selected,
      group_pts = s$group_pts,
      knockout_pts = s$knockout_pts,
      tournament_pts = s$tournament_pts,
      total = s$total,
      exact_predictions = s$exact_predictions,
      per_match = per_match,
      tournament_pick = if (is.null(tpick)) NULL else list(
        team_id = tpick$team_id,
        team_name = tpick$team_name
      )
    )
  })

  observeEvent(input$set_tracker, ignoreInit = TRUE, {
    payload <- input$set_tracker
    if (is.null(payload) || is.null(payload$match_id)) return()
    res <- write_tracker(uid, payload$match_id, payload$state)
    invalidate_tracker()
    post_message(session, "trackerResult", res)
  })

  observeEvent(input$set_prediction, ignoreInit = TRUE, {
    payload <- input$set_prediction
    if (is.null(payload)) return()
    res <- write_prediction(uid, payload, fixtures_rv())
    if (isTRUE(res$ok)) invalidate_predictions()
    post_message(session, "predictionResult", res)
  })

  observeEvent(input$set_tournament_pick, ignoreInit = TRUE, {
    payload <- input$set_tournament_pick
    if (is.null(payload) || is.null(payload$team_id)) return()
    res <- write_tournament_pick(uid, payload$team_id, fixtures_rv())
    if (isTRUE(res$ok)) {
      invalidate_tournament()
      # Rebuild the leaderboard snapshot so other users see the updated
      # champion-pick column without waiting for the next refresh cycle.
      # Safe to fail silently — the next scheduled refresh will catch up.
      tryCatch(
        {
          rebuild_leaderboard_snapshot(fixtures_df = fixtures_rv())
          invalidate_leaderboard_snapshot()
        },
        error = function(e) {
          warning(sprintf("Snapshot rebuild after tournament pick failed: %s",
                          conditionMessage(e)))
        }
      )
    }
    post_message(session, "tournamentPickResult", res)
  })

  # Admin stats — only computed when the admin tab is actually observing.
  # The reactiveVal lets the admin push a manual "refresh stats" button
  # without us having to wire this output into the regular invalidators
  # (which would re-trigger this expensive fan-out on every prediction
  # click made anywhere in the app).
  admin_stats_invalidator <- reactiveVal(0L)

  observeEvent(input$admin_refresh, ignoreInit = TRUE, {
    admin_stats_invalidator(admin_stats_invalidator() + 1L)
  })

  output$admin_stats <- render_json({
    if (!isTRUE(is_admin(user_info))) {
      return(list(error = "not_authorized"))
    }
    admin_stats_invalidator()
    # Tap into fixtures_rv so a fixtures refresh DOES update the dashboard
    # (cheap signal — fixtures change rarely).
    fx <- fixtures_rv()
    users_df <- read_users()
    tpicks <- read_tournament_picks()
    compute_admin_stats(fx, users_df, tpicks)
  })

  observeEvent(input$manual_refresh, ignoreInit = TRUE, {
    if (!isTRUE(user_info$is_dev) &&
        Sys.getenv("WC26_ALLOW_MANUAL_REFRESH", unset = "false") != "true") {
      post_message(session, "refreshResult",
                   list(ok = FALSE, reason = "not_authorized"))
      return()
    }
    # Manual refresh bypasses BOTH the live-window gate and the football-
    # data throttle — when a dev/admin clicks the button they want a real
    # full refresh, not a skipped or ESPN-only one.
    res <- tryCatch(run_refresh(force = TRUE), error = function(e) {
      list(ok = FALSE, error = conditionMessage(e))
    })
    if (isTRUE(res$ok)) {
      # fixtures_rv is now a reactivePoll — it'll pick up the new pin
      # automatically within the 30s tick. Force the leaderboard
      # snapshot to re-read immediately so the post-refresh totals show
      # up alongside the new scores.
      invalidate_cache("leaderboard")
      invalidate_leaderboard_snapshot()
    }
    post_message(session, "refreshResult", res)
  })
}

shinyApp(
  ui = page_react(
    title = "World Cup 2026",
    # Extra head content gets hoisted into <head> by htmltools.
    tags$head(
      # Without this, mobile browsers render the page at a ~980px virtual
      # width and zoom out — every sm: breakpoint is wasted because the
      # device thinks it's a wide screen. With it, the layout actually
      # responds to the phone's real width.
      tags$meta(name = "viewport",
                content = "width=device-width, initial-scale=1, viewport-fit=cover"),
      # Cache-bust query string forces browsers (especially Safari) to fetch
      # the favicon at least once instead of clinging to the cached "no
      # favicon" state from the pre-favicon period. Bump the version if the
      # PNG ever changes.
      tags$link(rel = "icon", type = "image/png", sizes = "512x512",
                href = "favicon.png?v=2"),
      # Apple touch icon for iOS home-screen bookmarks; same asset.
      tags$link(rel = "apple-touch-icon", href = "favicon.png?v=2"),
      tags$meta(name = "theme-color", content = "#1B2A4E")
    )
  ),
  server = server
)
