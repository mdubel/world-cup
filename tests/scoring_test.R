library(testthat)

if (!exists("score_group", inherits = FALSE)) {
  source("../r/util_time.R")
  source("../r/scoring.R")
}

test_that("score_group returns 3 for exact match", {
  expect_equal(score_group("HOME", "HOME"), 3L)
  expect_equal(score_group("AWAY", "AWAY"), 3L)
  expect_equal(score_group("DRAW", "DRAW"), 3L)
})

test_that("score_group returns 1 for predicted-winner-but-draw", {
  expect_equal(score_group("HOME", "DRAW"), 1L)
  expect_equal(score_group("AWAY", "DRAW"), 1L)
})

test_that("score_group returns 1 for predicted-draw-but-winner", {
  expect_equal(score_group("DRAW", "HOME"), 1L)
  expect_equal(score_group("DRAW", "AWAY"), 1L)
})

test_that("score_group returns 0 for wrong winner", {
  expect_equal(score_group("HOME", "AWAY"), 0L)
  expect_equal(score_group("AWAY", "HOME"), 0L)
})

test_that("score_group returns 0 for NA inputs", {
  expect_equal(score_group(NA_character_, "HOME"), 0L)
  expect_equal(score_group("HOME", NA_character_), 0L)
  expect_equal(score_group(NA_character_, NA_character_), 0L)
})

test_that("score_knockout adds advancing-team bonus", {
  expect_equal(score_knockout("HOME", "HOME", "HOME", "HOME"), 4L)
  expect_equal(score_knockout("AWAY", "AWAY", "AWAY", "AWAY"), 4L)
  expect_equal(score_knockout("DRAW", "HOME", "DRAW", "HOME"), 4L)
  expect_equal(score_knockout("DRAW", "AWAY", "DRAW", "AWAY"), 4L)
})

test_that("score_knockout: bonus only when advancing team matches", {
  expect_equal(score_knockout("DRAW", "HOME", "DRAW", "AWAY"), 3L)
  expect_equal(score_knockout("HOME", "HOME", "DRAW", "AWAY"), 1L)
})

test_that("score_knockout: predicted regulation winner but draw with right advance", {
  expect_equal(score_knockout("HOME", "HOME", "DRAW", "HOME"), 2L)
  expect_equal(score_knockout("AWAY", "AWAY", "DRAW", "AWAY"), 2L)
})

test_that("score_knockout: predicted draw but regulation winner picked correctly", {
  expect_equal(score_knockout("DRAW", "HOME", "HOME", "HOME"), 2L)
})

test_that("score_knockout: completely wrong = 0", {
  expect_equal(score_knockout("HOME", "HOME", "AWAY", "AWAY"), 0L)
})

test_that("score_knockout: NA advancing pick yields no bonus", {
  expect_equal(score_knockout("HOME", NA_character_, "HOME", "HOME"), 3L)
  expect_equal(score_knockout("DRAW", NA_character_, "DRAW", "HOME"), 3L)
})

test_that("score_tournament: 26 if correct, 0 otherwise", {
  expect_equal(score_tournament("BRA", "BRA"), 26L)
  expect_equal(score_tournament("BRA", "ARG"), 0L)
  expect_equal(score_tournament(NA_character_, "BRA"), 0L)
  expect_equal(score_tournament("BRA", NA_character_), 0L)
})

test_that("is_knockout_stage", {
  expect_true(is_knockout_stage("QUARTER_FINALS"))
  expect_true(is_knockout_stage("FINAL"))
  expect_false(is_knockout_stage("GROUP_STAGE"))
  expect_false(is_knockout_stage(NA_character_))
})

test_that("actual_advancing_team derives from PK winner first", {
  m <- list(status = "FINISHED", winner = "DRAW", pk_winner = "AWAY",
            home_team_id = "X", away_team_id = "Y")
  expect_equal(actual_advancing_team(m), "AWAY")
})

test_that("actual_advancing_team falls back to regulation winner", {
  m <- list(status = "FINISHED", winner = "HOME", pk_winner = NA_character_,
            home_team_id = "X", away_team_id = "Y")
  expect_equal(actual_advancing_team(m), "HOME")
})

test_that("actual_advancing_team: not finished -> NA", {
  m <- list(status = "SCHEDULED", winner = NA_character_, pk_winner = NA_character_)
  expect_true(is.na(actual_advancing_team(m)))
})

test_that("score_user counts exact predictions (3 for group, 4 for knockout)", {
  fx <- data.frame(
    match_id = c("G1", "G2", "K1"),
    stage = c("GROUP_STAGE", "GROUP_STAGE", "QUARTER_FINALS"),
    status = c("FINISHED", "FINISHED", "FINISHED"),
    winner = c("HOME", "DRAW", "HOME"),
    pk_winner = c(NA_character_, NA_character_, NA_character_),
    home_team_id = c("X", "X", "X"),
    away_team_id = c("Y", "Y", "Y"),
    stringsAsFactors = FALSE
  )
  preds <- data.frame(
    match_id = c("G1", "G2", "K1"),
    # G1: exact (3), G2: wrong-direction (1), K1: exact + bonus (4)
    pick = c("HOME", "HOME", "HOME"),
    advancing_team = c(NA_character_, NA_character_, "HOME"),
    stringsAsFactors = FALSE
  )
  s <- score_user(preds, NULL, fx)
  expect_equal(s$group_pts, 4L)        # 3 + 1
  expect_equal(s$knockout_pts, 4L)     # 4
  expect_equal(s$exact_predictions, 2L)  # G1 and K1
})
