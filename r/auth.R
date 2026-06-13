# Manual overrides for users whose proper display name can't be reconstructed
# from snake_case (accents, hyphens, name order, etc.). Keyed by user_id —
# the snake_case Connect username — so the SSO id stays canonical and only
# the rendered name changes. Add an entry here when title-casing the uid
# produces something the person wouldn't recognise themselves by.
DISPLAY_NAME_OVERRIDES <- list(
  # "dawid_strytynski" = "Dawid Strytyński"
)

# Turn a snake_case Connect username (e.g. "dawid_strytynski") into a
# human-readable display name ("Dawid Strytynski"). Idempotent: passing
# an already-pretty "Dawid Strytynski" returns it unchanged, so applying
# the function multiple times along the read/write pipeline is safe.
pretty_display_name <- function(name) {
  if (is.null(name)) return(name)
  if (is.na(name) || !nzchar(name)) return(name)
  # Strip dev: prefix used by the SHINY_DEV_USER fallback — the prefix is
  # an internal marker, not part of the human name.
  s <- sub("^dev:", "", name)
  override <- DISPLAY_NAME_OVERRIDES[[s]]
  if (!is.null(override)) return(override)
  # Split on either underscore OR whitespace so both "dawid_strytynski"
  # and a sloppily-cased "dawid Strytynski" end up the same way.
  parts <- strsplit(s, "[ _]+")[[1]]
  parts <- vapply(parts, function(p) {
    if (!nzchar(p)) return(p)
    paste0(toupper(substr(p, 1, 1)), tolower(substr(p, 2, nchar(p))))
  }, character(1))
  paste(parts, collapse = " ")
}

current_user <- function(session) {
  uid <- if (!is.null(session)) session$user else NULL

  if (is.null(uid) || identical(uid, "") || isTRUE(is.na(uid))) {
    dev_user <- Sys.getenv("SHINY_DEV_USER", unset = "")
    if (nzchar(dev_user)) {
      return(list(
        id = paste0("dev:", dev_user),
        display_name = paste0(pretty_display_name(dev_user), " (dev)"),
        is_dev = TRUE
      ))
    }
    return(list(
      id = "anonymous",
      display_name = "Anonymous (no SSO)",
      is_dev = TRUE
    ))
  }

  list(id = uid, display_name = pretty_display_name(uid), is_dev = FALSE)
}

safe_user_pin_suffix <- function(uid) {
  gsub("[^A-Za-z0-9_-]", "_", uid)
}
