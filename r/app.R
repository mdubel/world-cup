library(shiny)
library(jsonlite)

source("shinyreact.R", local = TRUE)
source("util_time.R", local = TRUE)
source("auth.R", local = TRUE)
source("data.R", local = TRUE)
source("scoring.R", local = TRUE)
source("api.R", local = TRUE)
source("fixtures.R", local = TRUE)
source("users.R", local = TRUE)
source("predictions.R", local = TRUE)
source("tracker.R", local = TRUE)
source("leaderboard.R", local = TRUE)
source("refresh.R", local = TRUE)
source("seed.R", local = TRUE)

# Auto-seed the fixtures pin with fake data when running locally outside
# Connect, so the app shows something interesting without the user having to
# run the refresh job manually. No-op on Connect.
ensure_local_seed()

server <- function(input, output, session) {
  user_info <- current_user(session)
  uid <- user_info$id

  # Fixtures are read ONCE at session start. The scheduled refresh job (or a
  # manual_refresh action) is what updates the pin; we only re-read on those
  # explicit triggers — no background polling. This keeps the UI stable: tab
  # switches and idle time never trigger spurious "Loading fixtures…" flips.
  fixtures_rv <- reactiveVal(read_fixtures())
  reread_fixtures <- function() {
    fixtures_rv(read_fixtures())
  }

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

  observeEvent(input$manual_refresh, ignoreInit = TRUE, {
    if (!isTRUE(user_info$is_dev) &&
        Sys.getenv("WC26_ALLOW_MANUAL_REFRESH", unset = "false") != "true") {
      post_message(session, "refreshResult",
                   list(ok = FALSE, reason = "not_authorized"))
      return()
    }
    res <- tryCatch(run_refresh(), error = function(e) {
      list(ok = FALSE, error = conditionMessage(e))
    })
    if (isTRUE(res$ok)) {
      reread_fixtures()
      # run_refresh already wrote the snapshot; just bump the invalidator
      # so the leaderboard output re-reads it.
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
