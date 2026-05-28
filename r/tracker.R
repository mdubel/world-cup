empty_tracker_df <- function() {
  data.frame(
    match_id = character(),
    state = character(),
    updated_at_utc = as.POSIXct(character(), tz = "UTC"),
    stringsAsFactors = FALSE
  )
}

tracker_pin_for <- function(uid) {
  pin_name(paste0("tracker_", safe_user_pin_suffix(uid)))
}

read_tracker <- function(uid) {
  pin_read_or(tracker_pin_for(uid), empty_tracker_df())
}

tracker_to_payload <- function(df) {
  if (is.null(df) || nrow(df) == 0) {
    return(setNames(list(), character(0)))
  }
  out <- list()
  for (i in seq_len(nrow(df))) {
    out[[df$match_id[i]]] <- df$state[i]
  }
  out
}

valid_tracker_state <- function(state) {
  isTRUE(state %in% c("WATCH_LATER", "WATCHED", "SKIP"))
}

write_tracker <- function(uid, match_id, state) {
  if (is.null(match_id) || !nzchar(match_id)) {
    return(list(ok = FALSE, reason = "missing_match_id"))
  }
  if (!valid_tracker_state(state)) {
    return(list(ok = FALSE, reason = "invalid_state"))
  }

  # No lock: this pin is written only by the user who owns it. The very rare
  # case of "same user clicks in two tabs simultaneously" is best-effort —
  # last write wins, which is the natural UX semantics anyway. Skipping the
  # lock dance eliminates 4 pin ops + ~75ms sleep per click.
  df <- read_tracker(uid)
  new_row <- data.frame(
    match_id = match_id,
    state = state,
    updated_at_utc = now_utc(),
    stringsAsFactors = FALSE
  )
  df <- upsert_row(df, new_row, key = "match_id")
  pin_write_safe(tracker_pin_for(uid), df)

  list(ok = TRUE, match_id = match_id, state = state)
}

clear_tracker_entry <- function(uid, match_id) {
  df <- read_tracker(uid)
  df <- df[df$match_id != match_id, , drop = FALSE]
  pin_write_safe(tracker_pin_for(uid), df)
  list(ok = TRUE)
}
