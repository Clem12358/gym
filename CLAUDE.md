# NeuroLegs - Adaptive Fitness Coach

## What This Is

Adaptive training coach app for science-based strength development. Features an intelligent progression engine that learns from performance and auto-adjusts targets. Two implementations exist:

- **React/Vite frontend** (`neurolegs-local/`) — primary, modern, mobile-first
- **Streamlit backend** (`app.py`) — legacy, full-featured but slower

## Quick Start

```bash
# React frontend (recommended)
cd neurolegs-local && npm run dev    # or just: ./RunGym
# Runs at http://localhost:5186

# Streamlit backend
streamlit run app.py
# Runs at http://localhost:8501
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript 5.9, Vite 7.3, Recharts |
| Backend | Python 3.10+, Streamlit, pandas, plotly |
| Data (React) | Browser localStorage (`neurolegs-local-vite-v1`) + optional GitHub Gist sync |
| Data (Streamlit) | Google Sheets via gspread API |
| Config | `.env.local` (React), `.streamlit/secrets.toml` (Streamlit) |

## Project Structure

```
gym/
├── app.py                    # Streamlit app (~2400 lines)
├── requirements.txt          # Python deps
├── RunGym                    # Bash launcher for React app
├── .streamlit/secrets.toml   # Google Sheets creds
└── neurolegs-local/          # React + Vite frontend
    ├── src/
    │   ├── App.tsx           # Main React component
    │   ├── engine.ts         # AdaptiveCoach algorithm (~2350 lines) — CORE
    │   ├── constants.ts      # Exercise library, configs (~700 lines)
    │   ├── types.ts          # TypeScript interfaces (~300 lines)
    │   ├── storage.ts        # localStorage management
    │   ├── csv.ts            # CSV import/export
    │   ├── notesSync.ts      # Notes parsing/formatting
    │   ├── cloudSync.ts      # GitHub Gist backup sync
    │   ├── streamlitImport.ts # Migrate data from Streamlit
    │   └── components/       # BodyMap visualizations
    ├── vite.config.ts
    └── package.json
```

## Key Files

- **`engine.ts`** — The adaptive coaching algorithm. `AdaptiveCoach` class analyzes session performance (reps, RPE, volume), detects trends, and recommends load/rep adjustments. Most complex file.
- **`constants.ts`** — Exercise library (40+ exercises), workout session definitions, progression constants.
- **`types.ts`** — All TypeScript interfaces: `SetLog`, `WorkoutEntry`, `WorkoutLogRecord`, `Logs`, `Settings`.
- **`App.tsx`** — Main UI: workout logging, planning, analytics, measurements, settings tabs.
- **`app.py`** — Streamlit equivalent of the React app. Reads/writes Google Sheets.

## Core Concepts

### Adaptive Progression Engine
- Analyzes session data: reps achieved vs target, RPE, volume, set consistency
- Calculates e1RM (estimated 1 rep max) from weight/reps/RPE
- Detects multi-week trends (improving/stable/declining)
- Recommends: add load, push reps, consolidate, or deload
- Auto-tunes back-off set percentages (80%-95% of top set)
- Handles return-from-break with graduated deload phases

### Key Constants
- `TARGET_RPE`: 8.0, `MAX_RPE`: 9.0, `DELOAD_RPE`: 9.5
- `BACKOFF_PERCENT`: 0.90 (back-off set = 90% of top)
- Weight increments: Compound +2.5kg, Isolation +1.25kg, Machine +2.27kg (5lbs)
- Machine stack: base 13.5kg + 9kg steps + micro-increments

### Data Models (TypeScript)
- `SetLog`: `{ reps, rpe, weight }`
- `WorkoutEntry`: `{ date, workout, weight, sets[], notes }`
- `WorkoutLogRecord`: `{ date, workoutType, exercise, data }`
- `Logs`: `{ workouts[], exercises{}, skippedSessions[], measurements[], scheduleOffset }`

### Data Persistence
- **React**: localStorage key `neurolegs-local-vite-v1`, optional GitHub Gist sync
- **Streamlit**: Google Sheets worksheets (`workout_logs`, `skipped_sessions`, `measurements`)

## Conventions

### Naming
- Python: `snake_case`
- TypeScript: `camelCase` for vars/functions, `PascalCase` for components/types
- Constants: `UPPER_SNAKE_CASE`
- Exercises: Title Case with parenthetical variants ("Machine Chest Press (Seated)")

### Code Style
- React: functional components + hooks, no class components
- TypeScript strict typing; types in `types.ts`, constants in `constants.ts`
- Python: type hints + docstrings on major functions
- Dates: ISO format (YYYY-MM-DD). Weights: always kg internally.
- RPE: float 6.0-10.0. Reps: integer.

### UI
- Emoji icons for tabs/buttons
- Status badges: green/yellow/red circles for progress states
- Mobile-first responsive design
- Notes workflow: copy plan → train → paste completed → import

### Git
- Single branch: `claude/neurolegs-fitness-app-bQYKA`
- Commit style: imperative mood ("Add feature", "Fix bug", "Replace X with Y")
- No test suite — app-driven development

## Build & Lint

```bash
cd neurolegs-local
npm run build     # TypeScript compile + Vite build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Environment Variables (React `.env.local`)

```
VITE_GITHUB_SYNC_TOKEN=       # GitHub PAT (gist scope)
VITE_GITHUB_SYNC_GIST_ID=     # Pre-configured gist ID
VITE_GITHUB_SYNC_LABEL=main   # Sync label
VITE_GITHUB_SYNC_AUTO=true    # Auto-sync toggle
```

## App Password

`01012026`
