library(testthat)
library(jsonlite)

if (!exists("api_match_to_row", inherits = FALSE)) {
  source("../r/util_time.R")
  source("../r/api.R")
}

test_that("api_match_to_row maps a scheduled group match", {
  raw <- jsonlite::fromJSON(
    "data/sample_matches.json",
    simplifyVector = FALSE
  )
  m <- raw$matches[[1]]
  row <- api_match_to_row(m)
  expect_equal(row$match_id, "100001")
  expect_equal(row$stage, "GROUP_STAGE")
  expect_equal(row$group, "GROUP_A")
  expect_equal(row$status, "SCHEDULED")
  expect_equal(row$home_team_code, "MEX")
  expect_equal(row$away_team_code, "USA")
  expect_equal(row$home_team_crest, "https://crests.football-data.org/770.svg")
  expect_equal(row$away_team_crest, "https://crests.football-data.org/762.svg")
  expect_true(is.na(row$winner))
  expect_true(is.na(row$home_score_ft))
})

test_that("api_match_to_row maps a finished group match with winner", {
  raw <- jsonlite::fromJSON(
    "data/sample_matches.json",
    simplifyVector = FALSE
  )
  m <- raw$matches[[2]]
  row <- api_match_to_row(m)
  expect_equal(row$status, "FINISHED")
  expect_equal(row$winner, "HOME")
  expect_equal(row$home_score_ft, 2L)
  expect_equal(row$away_score_ft, 1L)
  expect_true(is.na(row$pk_winner))
})

test_that("api_match_to_row maps a draw", {
  raw <- jsonlite::fromJSON(
    "data/sample_matches.json",
    simplifyVector = FALSE
  )
  m <- raw$matches[[3]]
  row <- api_match_to_row(m)
  expect_equal(row$winner, "DRAW")
})

test_that("api_match_to_row derives PK winner from penalty scores", {
  raw <- jsonlite::fromJSON(
    "data/sample_matches.json",
    simplifyVector = FALSE
  )
  m <- raw$matches[[4]]
  row <- api_match_to_row(m)
  expect_equal(row$winner, "DRAW")
  expect_equal(row$home_score_pk, 4L)
  expect_equal(row$away_score_pk, 5L)
  expect_equal(row$pk_winner, "AWAY")
  expect_equal(row$stage, "QUARTER_FINALS")
})

test_that("api_match_to_row handles null teams (bracket TBD)", {
  raw <- jsonlite::fromJSON(
    "data/sample_matches.json",
    simplifyVector = FALSE
  )
  m <- raw$matches[[5]]
  row <- api_match_to_row(m)
  expect_true(is.na(row$home_team_id))
  expect_true(is.na(row$away_team_id))
  expect_equal(row$stage, "SEMI_FINALS")
})

test_that("api_response_to_fixtures produces correctly-sized data frame", {
  raw <- jsonlite::fromJSON(
    "data/sample_matches.json",
    simplifyVector = FALSE
  )
  fx <- api_response_to_fixtures(raw)
  expect_equal(nrow(fx), 5L)
  expect_true(all(c("match_id", "stage", "kickoff_utc", "winner") %in% names(fx)))
})
