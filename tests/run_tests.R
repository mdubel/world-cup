#!/usr/bin/env Rscript
# Run all testthat suites in this directory.
# Usage: Rscript tests/run_tests.R

setwd(dirname(sys.frame(1)$ofile %||% "."))

`%||%` <- function(a, b) if (is.null(a)) b else a

source("../r/util_time.R")
source("../r/auth.R")
source("../r/data.R")
source("../r/scoring.R")
source("../r/api.R")
source("../r/fixtures.R")
source("../r/users.R")
source("../r/predictions.R")
source("../r/tracker.R")
source("../r/refresh.R")

library(testthat)

results <- list(
  scoring = test_file("scoring_test.R", reporter = "summary"),
  api = test_file("api_mapping_test.R", reporter = "summary")
)

failed <- vapply(results, function(r) {
  any(vapply(r, function(t) length(t$results) > 0 &&
                            any(vapply(t$results, function(x) inherits(x, "expectation_failure"),
                                       logical(1))),
             logical(1)))
}, logical(1))

if (any(failed)) {
  message("Some tests failed.")
  quit(status = 1)
}
