# World Cup 2026 — Tracker & Office Pool

A small Shiny-React app for following the FIFA 2026 World Cup and running a friendly office betting pool. Built to deploy to POSIT Connect with POSIT Pins as the backing store and the [football-data.org](https://www.football-data.org/) API as the schedule/results feed.

If you've ever wanted to record a knockout match to watch later in the evening, while a co-worker wants to argue about whether Germany really plays a "false 9" — this app handles both, with spoilers hidden by default and a leaderboard tallying everyone's predictions.

---

## What it does

### For watching the tournament

- **Schedule** every match in your timezone, with day-by-day grouping, kickoff countdowns, and a marquee at the top of the page showing the next few games
- **Mark each match** as *Watch later*, *Watched*, or *Skip*. Matches marked for later have their scores hidden everywhere in the app — including the bracket and group standings — until you either reveal them or change the mark
- **Filter the schedule** by status, groups, stages, or specific teams (multi-select). One-click "Your team" filter pins it to the country you support
- **Visual reactions** when your favorite team plays — the match card gets a gold shimmer, and a coloured ribbon appears after the final whistle (🎉 win / 🤝 draw / 💔 loss). Spoiler-safe: the ribbon is suppressed if the match is marked *Watch later*
- **Groups** tab with live standings (P/W/D/L/GD/Pts) for each of the 12 groups, color-coded by qualification status, with the full match list per group on click
- **Bracket** tab with the full 32 → 16 → QF → SF → Final knockout ladder, breaks out to full viewport width on big screens, click any slot to predict or mark it for later

### For the office pool

- **Group-stage predictions** (Home / Draw / Away). 3 points for exact, 1 point for "predicted winner but it was a draw" or the reverse, 0 for wrong
- **Knockout-stage predictions** (Home / Draw → PKs / Away, plus a named advancing team). Same 3/1/0 base scoring + 1-point bonus if your named advancing team actually advanced
- **Tournament winner** — one pick per person made before the opening kickoff. Worth **+26 points** if you call it
- **Continent picker** for the champion — confederation-grouped flag tiles instead of a boring dropdown, with hand-curated fun facts per country on hover
- **Leaderboard** with a top-3 podium (gold/silver/bronze hero cards, gold step shimmers), a denser "Pack" table for ranks 4+, and a per-user detail dialog showing every pick and how it scored
- **Tie-breaker**: more *exact predictions* (matches scored at the maximum — 3 for group, 4 for knockout) wins
- **Rules tab** with everything documented: scoring tables, lock semantics, and the prize disclaimer

### Personal settings, saved to your profile
- Timezone (used by every kickoff display)
- Light / dark mode
- Favorite team (the one you support — separate from the champion pick)

All three follow you across devices because they're saved to the user pin server-side.

---

## Try it locally

You don't need a POSIT Connect account or an API token to run the app locally — it ships with a synthetic seed and falls back to local file-based pins when run outside Connect.

```bash
git clone https://github.com/mdubel/world-cup.git
cd world-cup
npm install
SHINY_DEV_USER=alice npm run dev
```

Opens at <http://localhost:8000>. The synthetic seed populates a handful of group + knockout matches so the app has something to display. `SHINY_DEV_USER` substitutes for POSIT Connect's SSO — anything you save gets stamped against that identity.

To test multi-user behavior (multiple players in the leaderboard), open a second terminal:

```bash
SHINY_DEV_USER=bob PORT=8001 npm run dev
```

### Use real fixtures locally

Get a free token from <https://www.football-data.org/client/register>, then:

```bash
FOOTBALL_DATA_TOKEN=your_token_here Rscript refresh_job.R
```

This pulls the live FIFA 2026 schedule + results and writes them to the local pin board (`r/.dev_pins/wc26_fixtures`). Restart the app or wait for the next session to pick it up. Re-run anytime to refresh.

### Tests

```bash
cd tests
Rscript -e 'testthat::test_file("scoring_test.R")'
Rscript -e 'testthat::test_file("api_mapping_test.R")'
```

37 scoring tests cover the group / knockout / champion math and the leaderboard tie-breaker. 26 API tests verify the football-data response mapper against a canned response.

---

## How it's built

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript, Tailwind v4, shadcn/ui primitives, Radix UI, [@posit/shiny-react](https://github.com/wch/shiny-react) |
| Backend | R Shiny, `httr2` for the football-data API, `pins` for storage |
| Storage | POSIT Pins on Connect (production) / `board_folder()` (local) |
| Data source | [football-data.org](https://www.football-data.org/) free tier — covers the FIFA World Cup |
| Deploy | POSIT Connect — two content items: the interactive app + a scheduled refresh job |
| Build | esbuild + Tailwind plugin (custom `build.ts`) |

### Repository layout

```
world-cup/
├── srcts/                       React/TypeScript source
│   ├── App.tsx                  Top-level layout, providers, tab routing
│   ├── components/
│   │   ├── ui/                  shadcn primitives
│   │   ├── Tabs/                Schedule, Groups, Bracket, Picks, Champion, Standings, Rules
│   │   └── *.tsx                MatchCard, Podium, ContinentGrid, FilterPopover…
│   ├── contexts/                AppData, Theme, Timezone, Spoilers
│   ├── hooks/                   useFixtures, useTracker, usePredictions, …
│   ├── lib/                     Pure helpers: types, fixtures, time, standings, bracket, spoiler
│   ├── data/                    Static metadata: teams.ts (48 teams), funFacts.ts
│   └── favicon.png              Source-of-truth, copied into r/www by build.ts
├── r/                           Shiny backend
│   ├── app.R                    Server + page entry
│   ├── shinyreact.R             page_react helper + render_json + post_message
│   ├── data.R                   pin_board() + locks + upsert helpers
│   ├── api.R                    football-data.org HTTP client + response mapping
│   ├── fixtures.R               read/write fixtures pin
│   ├── predictions.R            per-user predictions + tournament pick (kickoff-locked)
│   ├── tracker.R                per-user watch state
│   ├── scoring.R                pure scoring functions
│   ├── users.R                  user profile pin (tz, theme, favorite team)
│   ├── refresh.R                run_refresh() orchestrator
│   ├── seed.R                   synthetic seed for local dev
│   ├── auth.R                   current_user(session) with dev fallback
│   └── util_time.R              UTC helpers + lock-time predicate
├── refresh_job.R                Standalone Rscript, deployed as scheduled job
├── tests/                       testthat suites + canned API JSON
├── build.ts                     esbuild + static asset copy
├── manifest.json                generated by rsconnect::writeManifest()
└── .rscignore                   Excludes srcts/, node_modules/, tests/, etc. from deploys
```

### Data model

Every pin is namespaced by `WC26_PIN_NAMESPACE` (default `wc26`). Pins on Connect, folder-backed when local.

| Pin | Writer | Contents |
|---|---|---|
| `wc26_fixtures` | refresh job | All 104 matches, group + knockout, with crests |
| `wc26_users` | app | Lazy registry — `user_id`, `display_name`, `tz`, `theme`, `favorite_team_id` |
| `wc26_predictions_<user_id>` | the user's session | One pin per user to keep read-modify-write small |
| `wc26_tracker_<user_id>` | the user's session | Per-user watch state |
| `wc26_tournament_picks` | the user's session | One row per user (small enough to be global) |
| `wc26_locks` | everyone | Cooperative locks — pins has no transactions |
| `wc26_refresh_log` | refresh job | Last-N refresh outcomes |

Every mutating operation runs through `with_lock(resource, expr)` in [`r/data.R`](r/data.R) — write a lock row with a 30s expiry, verify we hold it, do the read-modify-write, drop the lock. Per-user partitioning of predictions/tracker shrinks contention to a single user's own clicks.

### Scoring

All in [`r/scoring.R`](r/scoring.R), all pure functions:

- `score_group(pick, winner)` — 3 / 1 / 0
- `score_knockout(pick, advancing_pick, winner, actual_advancing)` — 3/1/0 base + 1 bonus
- `score_tournament(pick_team_id, champion_team_id)` — 26 if correct, 0 otherwise
- `score_user(predictions, tournament_pick, fixtures)` — sums everything, returns totals + per-match breakdown + count of exact predictions (for the tiebreaker)
- `build_leaderboard(...)` — applies the sort: `total DESC → exact_predictions DESC → display_name ASC`

### Spoiler protection

A new contributor's most likely gotcha. The whole app honors a "watch later" flag per match:

- Match scores → hidden in [`MatchCard`](srcts/components/MatchCard.tsx), [`BracketSlot`](srcts/components/BracketSlot.tsx), [`GroupCard`](srcts/components/GroupCard.tsx)
- Group standings → masked per-group via the [`SpoilerBanner`](srcts/components/SpoilerBanner.tsx) when a group contains an unwatched match
- Bracket downstream → slots in stages later than the earliest unwatched match get team identities replaced with TBD
- Trophy → hidden until the user opts in to spoilers
- Favorite-team result ribbon → suppressed for unwatched matches

A single app-level "revealed" state (in [`SpoilersContext`](srcts/contexts/Spoilers.tsx)) lets the user opt in everywhere at once.

---

## Deploy to POSIT Connect

Two Connect content items share the same pins board:

1. **App** — published from `r/`. Runs interactively for end users via Connect SSO.
2. **Scheduled job** — `refresh_job.Rmd` (a thin wrapper around `refresh_job.R`) published as a scheduled R Markdown (cron `*/10 * * * *`). Pulls football-data.org, writes the shared `wc26_fixtures` pin, and rebuilds the `wc26_leaderboard` snapshot so the app reads it in one op.

```bash
# 1. Build the production bundle (writes r/www/main.{js,css} + favicon)
npm run build-prod
rm -f r/www/*.map

# 2. Deploy app
Rscript -e 'rsconnect::deployApp(appDir="r", appName="world-cup", server="connect.appsilon.com", account="marcin")'

# 3. Deploy scheduled refresh
Rscript -e 'rsconnect::deployApp(
  appDir = ".",
  appPrimaryDoc = "refresh_job.Rmd",
  appFiles = c("refresh_job.Rmd", "refresh_job.R",
               "r/util_time.R", "r/data.R", "r/scoring.R",
               "r/api.R", "r/fixtures.R", "r/users.R",
               "r/predictions.R", "r/leaderboard.R", "r/refresh.R"),
  appName = "world-cup-fixtures",
  server = "connect.appsilon.com", account = "marcin"
)'
```

### Environment variables on each Connect content item

| Variable | Where | Purpose |
|---|---|---|
| `FOOTBALL_DATA_TOKEN` | both | API token from football-data.org (free tier, 10 req/min) |
| `CONNECT_API_KEY` | both | Used by `pins::board_connect()` for pin auth |
| `WC26_PIN_OWNER` | both | Optional. Connect username that owns the `wc26_*` pins (e.g. `marcin`). When unset, falls back to `board_connect()$account`. Set this only to point at a different owner. |
| `WC26_PIN_NAMESPACE` | both | Optional. Default `wc26`; set to `wc26_staging` for a parallel environment |
| `WC26_ADMINS` | app only | Comma-separated Connect usernames who see the **Admin** tab (e.g. `marcin,bartosz_rozek`). Unset = nobody sees it. Local testing: prefix with `dev:` (e.g. `dev:alice`) to match the dev-fallback user ID. |

Both content items should run under the same Connect identity (a bot user is fine) so the pins are owned by one writer.

### Permissions
End users only need access to the app — they don't need direct access to the pins. The bot user that owns both content items does all the pin reads/writes through the app and refresh-job server logic.

---

## Configuration knobs (env vars)

| Variable | Default | Purpose |
|---|---|---|
| `FOOTBALL_DATA_TOKEN` | — | Required for `refresh_job.R` to pull real data |
| `CONNECT_API_KEY` | — | Required on Connect to authenticate the pin board |
| `WC26_BOARD` | auto-detected | Set to `local` to force a folder-backed board; otherwise auto-detects Connect |
| `WC26_PIN_NAMESPACE` | `wc26` | Prefix for every pin name |
| `WC26_API_FIXTURE` | — | Path to a canned API response JSON; skips the HTTP call entirely. Useful for tests and offline demos |
| `WC26_ALLOW_MANUAL_REFRESH` | `false` | Set to `true` to allow non-dev users to trigger a refresh from the UI |
| `SHINY_DEV_USER` | — | Local-dev fallback identity when there's no Connect SSO. Returned to the app as `dev:<value>` so dev pins can never collide with prod pins |

---

## Acknowledgements

- Match schedule, results, and team crests from [football-data.org](https://www.football-data.org/)
- Built on the [shiny-react](https://github.com/wch/shiny-react) template by Winston Chang
- UI primitives from [shadcn/ui](https://ui.shadcn.com/) and [Radix UI](https://www.radix-ui.com/)
- Display type is [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue)

---

## License

MIT
