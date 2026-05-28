# CLAUDE.md

This file provides guidance to LLM coding agents when working with this Shiny-React application.

## Project Overview

This is **world-cup**, a Shiny-React application that tracks the FIFA 2026
World Cup and runs an office betting pool. Built on the Shiny-React
template, it persists state to POSIT Pins and is deployed to POSIT Connect.

## Project domain notes

### Two surfaces, one app
1. **Tracker** — per-user watch state (`WATCH_LATER` / `WATCHED` / `SKIP`)
   for every match. Spoiler-critical: when a match is `WATCH_LATER`, the
   score is replaced with `[ HIDDEN ]` everywhere it appears in that user's
   default views. Leaderboard tab masks point totals (`••`) by default if
   the current user has any `WATCH_LATER` matches; banner offers an
   explicit "Reveal anyway" click.
2. **Office pool** — group-stage and knockout match predictions plus a
   tournament-winner pick, scored against actual results.

### Scoring rules (all in `r/scoring.R`, pure functions)
- **Group**: exact W/L/D = 3; predicted winner but draw, or predicted draw
  but a winner = 1; otherwise 0.
- **Knockout**: same 3/1/0 base on regulation+ET outcome, **plus 1 bonus**
  if the user's named `advancing_team` matches the actual advancing team
  (whether through regulation, ET, or PKs). Max 4 per match.
- **Tournament winner**: +26 for the correct champion, locked at the
  kickoff of the opening match.
- **Tiebreaker** for the leaderboard: higher `exact_predictions` count
  (matches scored at the maximum — 3 for a group match, 4 for a knockout
  match), then display name alphabetically.

### Backend layout
| File | Purpose |
|---|---|
| `r/app.R` | Server: wires `reactivePoll` over fixtures + observers/outputs. |
| `r/data.R` | `pin_board()` singleton + `with_lock(resource, expr)`. |
| `r/api.R` | football-data.org HTTP client + `api_match_to_row()` mapping. |
| `r/refresh.R` | `run_refresh()` orchestrator: fetch → map → write fixtures pin. |
| `r/scoring.R` | Pure scoring functions. |
| `r/predictions.R` | Read/write per-user predictions; **server-side kickoff lock**. |
| `r/tracker.R` | Read/write per-user watch state. |
| `r/users.R` | Lazy user registry. |
| `r/auth.R` | `current_user(session)` with `SHINY_DEV_USER` fallback. |
| `r/util_time.R` | UTC helpers + `is_locked()`. |
| `refresh_job.R` | Standalone Rscript published to Connect as a `*/10 * * * *` job. |

### Pins data model
All names are namespaced via `pin_namespace()` (default `wc26`):
- `wc26_fixtures` — global, written only by refresh job.
- `wc26_users` — lazy registry; the app touches it on session start.
- `wc26_predictions_<safe_user_id>` — **per-user** to keep RMW payloads tiny.
- `wc26_tracker_<safe_user_id>` — per-user watch state.
- `wc26_tournament_picks` — single global pin (one row per user).
- `wc26_locks` — cooperative locks (pins has no transactions).
- `wc26_refresh_log` — last-N refresh outcomes.

Pins lacks transactions, so every mutating op runs through
`with_lock(resource, expr)`. Per-user partitioning of predictions and
tracker keeps contention to a single user's own clicks.

### Frontend layout
- `srcts/lib/` — pure helpers (`fixtures.ts`, `time.ts`, `spoiler.ts`,
  `types.ts`).
- `srcts/hooks/` — one hook per Shiny output (`useFixtures`, `useTracker`,
  `usePredictions`, `useTournamentPick`, `useLeaderboard`).
- `srcts/components/Tabs/` — top-level tabs (Tracker, Predictions, Winner
  pick, Leaderboard).
- `srcts/components/MatchCard.tsx` — shared by Tracker and Predictions tabs.

### Identity
On Connect: `session$user` from SSO. Locally: set `SHINY_DEV_USER` so the
auth helper returns `dev:<name>` (the `dev:` prefix prevents dev pins from
ever colliding with prod pins). To run a multi-user flow, start two
terminals with different `SHINY_DEV_USER` and `PORT` values.

### Local board
Set `WC26_BOARD=local` to switch `pin_board()` to `board_folder("./.dev_pins")`
so you can develop without Connect credentials. Fixtures can be loaded from
canned JSON via `WC26_API_FIXTURE=tests/data/sample_matches.json` so no
API token is needed either.

This is **world-cup**, a Shiny-React application created from a template. This project uses the Shiny-React library to enable bidirectional communication between React frontend components and Shiny servers.

**Architecture**:
- **Frontend**: React with TypeScript using shiny-react hooks
- **Backend**: Shiny server (both R and Python versions available)
- **Communication**: Real-time data flow via shiny-react library
- **Build System**: ESBuild bundling for fast development

## Tools

You may have access to a shadcn MCP server. If so, use it to find and install UI components when the user asks you to implement UI.

IMPORTANT: in most casees, the user will already be running `npm run dev` while you are working, so you do not need to run `npm run build` yourself, or start the Shiny app with `npm run shinyapp`. If you want to know whether a build is working, ask the user what the output is from the relevant command, and offer to run it if they are not doing so already.

## Directory Structure

```
world-cup/
├── package.json            # Build configuration and npm dependencies
├── tsconfig.json           # TypeScript configuration
├── CLAUDE.md               # This file - instructions for LLM coding agents
├── SHINY-REACT.md          # Comprehensive shiny-react library documentation
├── srcts/                  # React TypeScript source code
│   ├── main.tsx            # React app entry point
│   ├── *.tsx               # React components using shiny-react hooks
│   └── styles.css/globals.css  # CSS styling
├── r/                      # R Shiny backend
│   ├── app.R               # Main R Shiny application
│   ├── shinyreact.R        # R functions for shiny-react
│   └── www/                # Built JavaScript/CSS output (auto-generated)
│       ├── main.js         # Compiled React code for R backend
│       └── main.css        # Compiled CSS for R backend
└── py/                     # Python Shiny backend
    ├── app.py              # Main Python Shiny application
    ├── shinyreact.py       # Python functions for shiny-react
    └── www/                # Built JavaScript/CSS output (auto-generated)
        ├── main.js         # Compiled React code for Python backend
        └── main.css        # Compiled CSS for Python backend
```

## Key Files and Their Purpose

### Frontend (React/TypeScript)
- **`srcts/main.tsx`**: Entry point that mounts the React app to the DOM
- **`srcts/*.tsx`**: React components using shiny-react hooks
- **`srcts/styles.css`**: Application styling

### Backend (Shiny)
- **`r/app.R`** or **`py/app.py`**: Main Shiny server application
- **`r/shinyreact.R`** or **`py/shinyreact.py`**: Utility functions for bare page setup and custom renderers
- **`r/www/`** or **`py/www/`**: Auto-generated build output (JavaScript and CSS bundles)

## Available npm Scripts

This application includes several npm scripts for different development and build workflows:

### Development Scripts (Recommended)

- **`npm run dev`** - 🚀 **Primary development command** - Builds frontend and starts Shiny server automatically with hot-reload
- **`npm run watch`** - 👀 **Frontend-only watching** - Watch TypeScript/React files for changes and rebuild automatically
- **`npm run shinyapp`** - 🖥️ **Backend-only server** - Start only the Shiny server (Python by default)

### Build Scripts

- **`npm run build`** - 🔨 **Development build** - Build frontend once with TypeScript checking and CSS processing
- **`npm run build-prod`** - 📦 **Production build** - Optimized build with minification (advanced templates)
- **`npm run clean`** - 🧹 **Clean build** - Remove all generated build files

### Port Configuration

You can customize the port (default is 8000):
```bash
# Use custom port
PORT=3000 npm run dev
PORT=3000 npm run shinyapp
```

## Quick Start Development Workflow

### Method 1: All-in-One Development (Recommended)

```bash
# Install dependencies
npm install

# Start development with hot-reload (builds frontend + starts server)
npm run dev
```

This single command will:
- Build the TypeScript/React frontend with CSS processing
- Start the Shiny server with hot-reload enabled
- Automatically open your browser to `http://localhost:8000`
- Watch for changes and rebuild/restart as needed

### Method 2: Manual Development Setup

If you prefer more control, you can run the frontend and backend separately:

1. **Start build watcher** (in one terminal):
   ```bash
   npm run watch
   ```

2. **Run Shiny server** (in another terminal):
   ```bash
   # For R backend
   R -e "options(shiny.autoreload = TRUE); shiny::runApp('r/app.R', port=8000)"

   # For Python backend
   shiny run py/app.py --port 8000 --reload
   ```

3. **Open browser**: Navigate to `http://localhost:8000`

### Production Deployment

For production builds:
```bash
# Create optimized production build
npm run build-prod

# Deploy the generated www/ directories along with your Shiny app
```

## How Shiny-React Works

### Core Concepts
- **`useShinyInput<T>(id, defaultValue)`**: Sends data FROM React TO Shiny server
- **`useShinyOutput<T>(id, defaultValue)`**: Receives data FROM Shiny server TO React
- **Real-time bidirectional communication**: Changes in React trigger server updates, server responses update React UI

### Basic Example
```typescript
import { useShinyInput, useShinyOutput } from "@posit/shiny-react";

function MyComponent() {
  const [inputValue, setInputValue] = useShinyInput<string>("my_input", "default");
  const [outputValue] = useShinyOutput<string>("my_output", undefined);

  return (
    <div>
      <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
      <div>Server says: {outputValue}</div>
    </div>
  );
}
```

## Common Development Tasks

### Starting Development
- **Quick start**: Run `npm run dev` - Starts both frontend building and backend server with hot-reload
- **Frontend only**: Run `npm run watch` - Rebuilds frontend on file changes
- **Backend only**: Run `npm run shinyapp` - Starts only the Shiny server

### Adding a New Input/Output Pair
1. **In React component**: Add `useShinyInput` and `useShinyOutput` hooks
2. **In Shiny server**: Add corresponding input handler and output renderer
3. **Automatic rebuild**: Changes are detected automatically with watch mode

### Adding New React Components
1. **Create component file** in `srcts/` directory
2. **Import and use** in main component or `main.tsx`
3. **Follow shiny-react patterns** for any Shiny communication
4. **Update styling** in `styles.css` or `globals.css` if needed

### Modifying Backend Logic
- **R**: Edit `r/app.R` for server logic, `r/shinyreact.R` for utilities
- **Python**: Edit `py/app.py` for server logic, `py/shinyreact.py` for utilities
- **No rebuild needed** for backend changes (Shiny auto-reloads)

### Making Production Builds
- **Development build**: Run `npm run build`
- **Production build**: Run `npm run build-prod` (if available)
- **Clean build**: Run `npm run clean` to remove generated files

## Troubleshooting

### Common Issues
1. **"Shiny not found" errors**: Ensure Shiny server is running and accessible
2. **Build failures**: Check that all dependencies are installed (`npm install`)
3. **Hot reload not working**: Restart development mode
4. **Data not syncing**: Verify matching input/output IDs between React and Shiny
5. **TypeScript errors**: Check type definitions and imports
6. **Port already in use**: Use `PORT=<number> npm run dev` to change the port

### Development Tips
- **Use browser DevTools**: Check console for React/JavaScript errors
- **Monitor Shiny logs**: Watch R/Python console for server-side errors
- **Verify IDs match**: Input/output IDs must be identical in React and Shiny code
- **Check network tab**: Verify WebSocket communication between client and server

### Port Conflicts
If port 8000 is in use:
```bash
# Use environment variable (recommended)
PORT=8001 npm run dev

# Or manual server startup
R -e "shiny::runApp('r/app.R', port=8001)"
shiny run py/app.py --port 8001
```

## Key Dependencies

- **@posit/shiny-react**: Core library for React-Shiny communication
- **react + react-dom**: React framework
- **typescript**: TypeScript compiler and type checking
- **esbuild**: Fast JavaScript bundling

---

## Comprehensive Shiny-React Documentation

**📚 For complete API reference, advanced patterns, and detailed examples**, see: @SHINY-REACT.md

The SHINY-REACT.md file contains:
- Complete API documentation for all hooks and components
- Advanced input patterns (file uploads, compound forms, etc.)
- Debouncing and event priority concepts
- Server-to-client messaging
- Backend patterns for R and Python
- Shiny reactivity system explanation
- Data serialization details
- shadcn/ui integration guide
- Troubleshooting and best practices
