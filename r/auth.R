current_user <- function(session) {
  uid <- if (!is.null(session)) session$user else NULL

  if (is.null(uid) || identical(uid, "") || isTRUE(is.na(uid))) {
    dev_user <- Sys.getenv("SHINY_DEV_USER", unset = "")
    if (nzchar(dev_user)) {
      return(list(
        id = paste0("dev:", dev_user),
        display_name = paste0(dev_user, " (dev)"),
        is_dev = TRUE
      ))
    }
    return(list(
      id = "anonymous",
      display_name = "Anonymous (no SSO)",
      is_dev = TRUE
    ))
  }

  list(id = uid, display_name = uid, is_dev = FALSE)
}

safe_user_pin_suffix <- function(uid) {
  gsub("[^A-Za-z0-9_-]", "_", uid)
}
