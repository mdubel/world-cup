# Federation strength over time

% of available **group-stage** points won per FIFA confederation, World Cups
1998 → present.

```
metric = group-stage points won / (3 × group games played)
```

Each team plays 3 group games when a tournament is complete (max 9 pts), so a
finished tournament divides by `9 × teams`. An in-progress tournament divides by
games *actually played*, so the percentage stays meaningful mid-way. A match
between two same-confederation teams counts for **both** (each had it as one of
their games).

## Files

| File | Role |
|---|---|
| `federation_strength.R` | The computation. 1998–2022 history is **frozen** inside it. Reads `wc2026.tsv`, prints a table, writes `federation_chart_data.json`. |
| `wc2026.tsv` | **The only file that changes week to week** — current-tournament results, one row per team, with its confederation. |
| `federation_chart_data.json` | Generated chart data (don't hand-edit). |
| `federation_chart_template.html` | The chart; `/*__CHART_DATA__*/` is replaced with the JSON to render. |

## Refresh the data (e.g. next week)

**Option A — let the API do it (preferred, fully automatic):**
```bash
export FOOTBALL_DATA_TOKEN=...        # same token the tracker app uses
Rscript analysis/federation_strength.R --fetch
```
`--fetch` pulls finished group-stage matches from football-data.org, rewrites
`wc2026.tsv` (carrying over confederations already filled in), then recomputes.
If a brand-new team appears it prints a note to fill its confederation.

**Option B — edit by hand:** open `wc2026.tsv`, update `games_played` / `points`
(and add rows for groups that have started), then:
```bash
Rscript analysis/federation_strength.R
```

Either way you get the console table **and** a fresh `federation_chart_data.json`.

## "Please show me the updated data" (what Claude does)

1. Refresh `wc2026.tsv` — via `--fetch` if a token is set, otherwise pull the
   current standings from the web and rewrite the TSV (confederation column
   included; Australia → AFC, New Zealand → OFC, etc.).
2. `Rscript analysis/federation_strength.R` → regenerates `federation_chart_data.json`.
3. Render the chart: read `federation_chart_template.html`, replace
   `/*__CHART_DATA__*/` with the JSON contents, show it.

## Notes / conventions

- Confederations: UEFA, CONMEBOL, CAF, AFC, CONCACAF, OFC.
- **Australia** counts as OFC in 2006 (it took Oceania's qualifying berth) and
  AFC from 2010 on — handled in `confed_of()`.
- History was verified against the per-group Wikipedia standings tables
  (each team's W-D-L sums to its games; points = 3W + D).
- To add a future tournament (2030+): append its rows to the history block in
  `federation_strength.R` and add its host to the `HOSTS` vector.
