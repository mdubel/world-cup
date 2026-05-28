now_utc <- function() {
  as.POSIXct(Sys.time(), tz = "UTC")
}

iso_utc <- function(x) {
  if (length(x) == 0) {
    return(character(0))
  }
  if (inherits(x, "POSIXt")) {
    return(format(x, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  }
  as.character(x)
}

parse_iso_utc <- function(x) {
  if (length(x) == 0 || is.null(x)) {
    return(as.POSIXct(NA, tz = "UTC"))
  }
  as.POSIXct(x, format = "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

is_locked <- function(kickoff_utc, now = now_utc()) {
  if (length(kickoff_utc) == 0 || is.na(kickoff_utc)) {
    return(TRUE)
  }
  now >= kickoff_utc
}
