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
# without an owner prefix is unreliable: for some pin names it finds the
# right pin (with a "multiple matches" warning), for others it silently
# returns empty — both surface as silent data loss in build_leaderboard.
# Always emit `<owner>/<pin>` on Connect so the lookup is unambiguous.
#
# Resolution order:
#   1. WC26_PIN_OWNER env var (explicit override on the Connect content item)
#   2. board_connect()$account (the API-key user the board authenticated as)
#   3. "" (fall back to bare names; reads may silently return empty)
pin_owner <- function() {
  if (!running_on_connect()) return("")
  owner <- Sys.getenv("WC26_PIN_OWNER", unset = "")
  if (nzchar(owner)) return(owner)
  board <- tryCatch(pin_board(), error = function(e) NULL)
  if (!is.null(board) && !is.null(board$account) && nzchar(board$account)) {
    return(board$account)
  }
  ""
}

.board_cache <- new.env(parent = emptyenv())

# Process-level cache for the GLOBAL pins (fixtures, users, tournament_picks,
# leaderboard snapshot). They change rarely (refresh job ~every 10 min;
# tournament-pick writes are user-driven) so a short TTL slashes the
# steady-state pin_read latency that the initial 'Loading fixtures…' state
# was waiting on.
#
# Per-user pins are NOT cached here — each session has a different user, so
# the cache would mostly miss anyway, and one user's cached state must not
# leak to another's session.
#
# Writes inside this process invalidate their own cache key via
# invalidate_cache() so the next read in the same session reflects the
# write. Writes from OTHER processes (scheduled refresh job, other workers)
# clear via TTL expiry — at worst, scores show GLOBAL_PIN_TTL_SECS later
# than the job that wrote them.
.read_cache <- new.env(parent = emptyenv())
GLOBAL_PIN_TTL_SECS <- 30L

cached_read <- function(key, loader, ttl_secs = GLOBAL_PIN_TTL_SECS) {
  now <- as.numeric(Sys.time())
  entry <- .read_cache[[key]]
  if (!is.null(entry) && entry$expires_at > now) {
    return(entry$value)
  }
  value <- loader()
  .read_cache[[key]] <- list(value = value, expires_at = now + ttl_secs)
  value
}

invalidate_cache <- function(key) {
  if (exists(key, envir = .read_cache, inherits = FALSE)) {
    rm(list = key, envir = .read_cache)
  }
}

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

# Default write path for data pins. On Connect we defer to the board's
# versioning default (versioned=TRUE) so we KEEP full history for audit /
# rollback — predictions, tracker state, users, fixtures, leaderboard
# snapshots, the refresh log, tournament picks. Locally board_folder gets
# versioned=FALSE because its same-second-write ordering bug otherwise
# bites us: two writes within the same second can produce version
# directories whose lexical ordering doesn't match write order, so the
# "latest" version pin_read() surfaces can be the wrong one.
pin_write_safe <- function(name, value, type = "rds") {
  if (running_on_connect()) {
    pins::pin_write(pin_board(), value, name = name, type = type)
  } else {
    pins::pin_write(pin_board(), value, name = name, type = type,
                    versioned = FALSE)
  }
}

# Write path for *transient* pins (currently just wc26_locks). Same as
# pin_write_safe, but on Connect we prune to the latest 3 versions after
# every write. Lock acquire + release = 2 writes per critical section,
# multiplied across every session start → without pruning the locks pin
# accumulates fast and eventually pins refuses any further write. Three
# versions is enough to inspect the recent state when debugging.
pin_write_transient <- function(name, value, type = "rds") {
  if (running_on_connect()) {
    pins::pin_write(pin_board(), value, name = name, type = type)
    tryCatch(
      pins::pin_versions_prune(pin_board(), name, n = 3),
      error = function(e) {
        warning(sprintf("pin_versions_prune('%s') failed: %s",
                        name, conditionMessage(e)))
      }
    )
  } else {
    pins::pin_write(pin_board(), value, name = name, type = type,
                    versioned = FALSE)
  }
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

with_lock <- function(resource, expr, verify = TRUE) {
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
      pin_write_transient(pin_name("locks"), candidate)

      if (verify) {
        # No sleep before verify — pins on Connect is read-after-write
        # consistent (it's an API call, not S3 eventual consistency). The
        # post-acquire sleep that used to live here cost ~75ms per write
        # without buying any correctness.
        verify_locks <- read_locks_df()
        verify_row <- verify_locks[verify_locks$resource == resource, , drop = FALSE]
        if (nrow(verify_row) >= 1 &&
            identical(tail(verify_row$holder, 1), holder)) {
          acquired <- TRUE
          break
        }
      } else {
        # verify=FALSE: best-effort lock. Two simultaneous writers can both
        # think they hold it; both proceed; last write to the target pin
        # wins. Acceptable for low-contention metadata writes (e.g. updating
        # last_seen_utc in the users pin) where losing a write is harmless.
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
      pin_write_transient(pin_name("locks"), remaining)
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
