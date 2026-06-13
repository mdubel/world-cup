empty_users_df <- function() {
  data.frame(
    user_id = character(),
    display_name = character(),
    tz = character(),
    theme = character(),
    favorite_team_id = character(),
    first_seen_utc = as.POSIXct(character(), tz = "UTC"),
    last_seen_utc = as.POSIXct(character(), tz = "UTC"),
    stringsAsFactors = FALSE
  )
}

# Defensive read: backfill any missing columns (older user pins lack newer
# fields) AND restore the canonical column order so downstream positional
# operations (rbind, [<-, etc.) line up correctly. Also runs every row's
# display_name through pretty_display_name() so existing snake_case rows
# (written before the prettifier landed) surface as human-readable names
# everywhere the dataframe is consumed — leaderboard, admin stats, etc.
read_users <- function() {
  cached_read("users", function() {
    df <- pin_read_or(pin_name("users"), empty_users_df())
    if (!"theme" %in% names(df)) df$theme <- NA_character_
    if (!"tz" %in% names(df)) df$tz <- NA_character_
    if (!"favorite_team_id" %in% names(df)) df$favorite_team_id <- NA_character_
    canon <- names(empty_users_df())
    extra <- setdiff(names(df), canon)
    df <- df[, c(canon, extra), drop = FALSE]
    if (nrow(df) > 0 && exists("pretty_display_name")) {
      df$display_name <- vapply(df$display_name, pretty_display_name,
                                character(1))
    }
    df
  })
}

touch_user <- function(uid, display_name, tz = NA_character_) {
  if (is.null(uid) || !nzchar(uid)) return(invisible(NULL))
  # verify=FALSE: touch_user runs on every session start. The lock is here
  # to keep two concurrent touches from overwriting each other's row in
  # the global users pin; skipping the verify step trades a tiny race-
  # window risk for ~1 pin op saved per session start.
  with_lock("users", verify = FALSE, {
    df <- read_users()
    now <- now_utc()
    existing <- df[df$user_id == uid, , drop = FALSE]
    first_seen <- if (nrow(existing) > 0) existing$first_seen_utc[1] else now
    # Preserve any saved tz / theme / favorite on subsequent touches — only
    # fill in tz from the browser-detected value when none was previously
    # saved.
    saved_tz       <- if (nrow(existing) > 0) existing$tz[1] else NA_character_
    saved_theme    <- if (nrow(existing) > 0) existing$theme[1] else NA_character_
    saved_favorite <- if (nrow(existing) > 0) existing$favorite_team_id[1] else NA_character_
    use_tz <- if (!is.na(saved_tz) && nzchar(saved_tz)) {
      saved_tz
    } else if (is.null(tz) || isTRUE(is.na(tz))) {
      NA_character_
    } else {
      as.character(tz)
    }
    new_row <- data.frame(
      user_id = uid,
      display_name = display_name %||% uid,
      tz = use_tz,
      theme = saved_theme,
      favorite_team_id = saved_favorite,
      first_seen_utc = first_seen,
      last_seen_utc = now,
      stringsAsFactors = FALSE
    )
    df <- upsert_row(df, new_row, key = "user_id")
    pin_write_safe(pin_name("users"), df)
  })
  invalidate_cache("users")
  invisible(NULL)
}

# Always upsert: makes set_user_tz / set_user_theme also create the row if a
# session somehow tries to set settings before touch_user fired.
set_user_setting <- function(uid, field, value) {
  if (is.null(uid) || !nzchar(uid)) return(invisible(NULL))
  if (!field %in% c("tz", "theme", "favorite_team_id")) {
    return(invisible(NULL))
  }
  # See touch_user above re: verify=FALSE.
  with_lock("users", verify = FALSE, {
    df <- read_users()
    idx <- which(df$user_id == uid)
    now <- now_utc()
    if (length(idx) == 0) {
      new_row <- data.frame(
        user_id = uid,
        display_name = uid,
        tz = NA_character_,
        theme = NA_character_,
        favorite_team_id = NA_character_,
        first_seen_utc = now,
        last_seen_utc = now,
        stringsAsFactors = FALSE
      )
      new_row[[field]] <- value
      df <- rbind(df, new_row)
    } else {
      df[[field]][idx] <- value
      df$last_seen_utc[idx] <- now
    }
    pin_write_safe(pin_name("users"), df)
  })
  invalidate_cache("users")
  invisible(NULL)
}

set_user_tz <- function(uid, tz) {
  if (is.null(tz) || !nzchar(tz)) return(invisible(NULL))
  set_user_setting(uid, "tz", tz)
}

set_user_theme <- function(uid, theme) {
  if (is.null(theme) || !theme %in% c("light", "dark")) {
    return(invisible(NULL))
  }
  set_user_setting(uid, "theme", theme)
}

# Pass team_id = "" or NA to clear the user's favorite.
set_user_favorite_team <- function(uid, team_id) {
  value <- if (is.null(team_id) || identical(team_id, "") ||
               isTRUE(is.na(team_id))) {
    NA_character_
  } else {
    as.character(team_id)
  }
  set_user_setting(uid, "favorite_team_id", value)
}

read_user_profile <- function(uid) {
  if (is.null(uid) || !nzchar(uid)) return(NULL)
  df <- read_users()
  row <- df[df$user_id == uid, , drop = FALSE]
  if (nrow(row) == 0) return(NULL)
  row <- row[1, , drop = FALSE]
  list(
    user_id = row$user_id,
    display_name = row$display_name,
    tz = if (is.na(row$tz)) NULL else row$tz,
    theme = if (is.na(row$theme)) NULL else row$theme,
    favorite_team_id = if (is.na(row$favorite_team_id))
      NULL else row$favorite_team_id
  )
}
