library(pins)

pin_namespace <- function() {
  ns <- Sys.getenv("WC26_PIN_NAMESPACE", unset = "wc26")
  if (!nzchar(ns)) "wc26" else ns
}

pin_name <- function(suffix) {
  short <- paste0(pin_namespace(), "_", suffix)
  owner <- pin_owner()
  if (nzchar(owner)) paste0(owner, "/", short) else short
}

# Owner prefix for pin names. On POSIT Connect, `pin_read("wc26_locks")`
# matches every wc26_locks pin across every user — pins emits a warning per
# call and the lookup is much slower than a fully-qualified `marcin/wc26_locks`.
# Set WC26_PIN_OWNER to the bot/user that owns the wc26_* pins.
pin_owner <- function() {
  if (!running_on_connect()) return("")
  owner <- Sys.getenv("WC26_PIN_OWNER", unset = "")
  if (nzchar(owner)) owner else ""
}

.board_cache <- new.env(parent = emptyenv())

running_on_connect <- function() {
  # POSIT Connect sets at least one of these env vars at runtime. If we don't
  # see any of them, assume we're running locally and use a folder-backed pin
  # board — never try to authenticate against a Connect server, which would
  # fail noisily on developer machines that have several rsconnect servers
  # configured.
  nzchar(Sys.getenv("CONNECT_SERVER", unset = "")) ||
    identical(Sys.getenv("RSTUDIO_PRODUCT", unset = ""), "CONNECT") ||
    nzchar(Sys.getenv("RSC_SERVER_URL", unset = ""))
}

resolve_board_mode <- function() {
  explicit <- Sys.getenv("WC26_BOARD", unset = "")
  if (nzchar(explicit)) return(explicit)
  if (running_on_connect()) "connect" else "local"
}

pin_board <- function() {
  if (!is.null(.board_cache$board)) {
    return(.board_cache$board)
  }
  mode <- resolve_board_mode()
  board <- if (identical(mode, "local")) {
    dir.create(".dev_pins", showWarnings = FALSE, recursive = TRUE)
    # Local board is unversioned — last-write-wins matches what every pin in
    # this app actually wants (locks, fixtures snapshot, current predictions,
    # current tracker state, leaderboard inputs).
    pins::board_folder(".dev_pins", versioned = FALSE)
  } else {
    pins::board_connect()
  }
  .board_cache$board <- board
  board
}

pin_exists_safe <- function(name) {
  tryCatch(
    pins::pin_exists(pin_board(), name),
    error = function(e) FALSE
  )
}

pin_read_or <- function(name, default) {
  if (!pin_exists_safe(name)) {
    return(default)
  }
  tryCatch(
    pins::pin_read(pin_board(), name),
    error = function(e) {
      warning(sprintf("pin_read('%s') failed: %s", name, conditionMessage(e)))
      default
    }
  )
}

# Every pin in this app is last-write-wins; version history would only let a
# subtle bug bite us. When two writes happen in the same wall-clock second
# (acquire + release of a lock, for example) pins board_folder gives them two
# version directories whose lexical ordering does NOT reflect write order, so
# pin_read() can surface the wrong "latest" — the lock release looks
# ineffective. Forcing versioned=FALSE on every write avoids this.
pin_write_safe <- function(name, value, type = "rds") {
  pins::pin_write(pin_board(), value, name = name, type = type,
                  versioned = FALSE)
}

pin_meta_modified <- function(name) {
  if (!pin_exists_safe(name)) {
    return("none")
  }
  meta <- tryCatch(
    pins::pin_meta(pin_board(), name),
    error = function(e) NULL
  )
  if (is.null(meta)) {
    return("none")
  }
  paste(meta$file, meta$created %||% "", meta$pin_hash %||% "", sep = ":")
}

`%||%` <- function(a, b) if (is.null(a)) b else a

LOCK_TTL_SECS <- 30
LOCK_RETRY_MAX <- 8
LOCK_RETRY_BASE_SLEEP <- 0.1

read_locks_df <- function() {
  default <- data.frame(
    resource = character(),
    holder = character(),
    acquired_at_utc = as.POSIXct(character(), tz = "UTC"),
    expires_at_utc = as.POSIXct(character(), tz = "UTC"),
    stringsAsFactors = FALSE
  )
  pin_read_or(pin_name("locks"), default)
}

random_holder_id <- function() {
  paste0(
    Sys.getpid(), "-",
    as.integer(Sys.time()), "-",
    sample.int(.Machine$integer.max, 1)
  )
}

with_lock <- function(resource, expr) {
  holder <- random_holder_id()
  acquired <- FALSE

  for (attempt in seq_len(LOCK_RETRY_MAX)) {
    locks <- read_locks_df()
    now <- now_utc()
    locks <- locks[is.na(locks$expires_at_utc) | locks$expires_at_utc > now, , drop = FALSE]
    held <- locks[locks$resource == resource, , drop = FALSE]
    if (nrow(held) == 0) {
      new_row <- data.frame(
        resource = resource,
        holder = holder,
        acquired_at_utc = now,
        expires_at_utc = now + LOCK_TTL_SECS,
        stringsAsFactors = FALSE
      )
      candidate <- rbind(locks, new_row)
      pin_write_safe(pin_name("locks"), candidate)

      Sys.sleep(0.05 + stats::runif(1) * 0.05)
      verify <- read_locks_df()
      verify_row <- verify[verify$resource == resource, , drop = FALSE]
      if (nrow(verify_row) >= 1 &&
          identical(tail(verify_row$holder, 1), holder)) {
        acquired <- TRUE
        break
      }
    }
    Sys.sleep(LOCK_RETRY_BASE_SLEEP * (2 ^ (attempt - 1)) + stats::runif(1) * 0.1)
  }

  if (!acquired) {
    stop(sprintf("Could not acquire lock for resource '%s' after %d attempts",
                 resource, LOCK_RETRY_MAX))
  }

  on.exit({
    tryCatch({
      remaining <- read_locks_df()
      remaining <- remaining[!(remaining$resource == resource &
                                 remaining$holder == holder), , drop = FALSE]
      pin_write_safe(pin_name("locks"), remaining)
    }, error = function(e) {
      warning(sprintf("Failed to release lock '%s': %s", resource, conditionMessage(e)))
    })
  }, add = TRUE)

  force(expr)
}

upsert_row <- function(df, row, key) {
  if (nrow(df) == 0) {
    return(row)
  }
  matches <- df[[key]] == row[[key]]
  if (any(matches)) {
    # Assign by COLUMN NAME, not position. base R `df[matches, ] <- row`
    # silently aligns columns by index — if `df` and `row` have the same
    # columns in different orders (e.g. after a schema change backfilled a
    # missing column at the end), it cheerfully writes character into
    # POSIXct and blows up with a coercion error far from the cause.
    common_cols <- intersect(names(row), names(df))
    for (col in common_cols) {
      df[matches, col] <- row[[col]]
    }
    # Any new columns in `row` that weren't in `df` get added.
    for (col in setdiff(names(row), names(df))) {
      df[[col]] <- NA
      df[matches, col] <- row[[col]]
    }
    return(df)
  }
  # rbind matches by name on data.frames, so column-order mismatch is fine
  # here.
  rbind(df, row)
}
