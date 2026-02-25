# NeuroLegs Local (Vite)

Local React/Vite version of the Streamlit NeuroLegs app, with the same adaptive progression mechanics plus a Notes copy/paste workflow for gym sessions.

## Run

```bash
RunGym
```

The app runs on `http://localhost:5186`.

If your current terminal session does not know the alias yet:

```bash
source ~/.zshrc
RunGym
```

## Notes Workflow (iPhone Copy/Paste)

1. Open `Today` tab.
2. Click `Copy Plan`.
3. Paste in iPhone Notes and train by editing reps/weights directly there.
4. Back on Mac, open `Log` tab, paste into `Paste Completed Notes`, click `Import From Notes`.
5. The app parses the updated numbers and updates progression + charts.

## Feature Parity Included

- Adaptive target engine (top set + back-off, plateau logic, deload logic, return phases)
- Today planning and week schedule
- Workout logging + rest timer
- Progress and analytics charts
- 1RM calculator, warm-up generator, measurements
- CSV import/export
- Exercise library (active/inactive)
- Holiday mode, schedule offset controls

## Data Storage

- Local cache: browser `localStorage` key `neurolegs-local-vite-v1`
- Optional cross-browser sync: private GitHub Gist (Settings -> `GitHub Sync Database`)

### GitHub Sync (No Repeated Login)

1. Create a GitHub token with `gist` scope.
2. In Settings, add token and click `Push Backup` once (this creates a gist id if empty).
3. Enable `automatic pull/push sync`.
4. Click `Copy Sync Key` and paste it once in your other browser (`Apply Key`).

After that, all browsers use the same GitHub-hosted JSON database and stay in sync.

### Zero-Input Automatic Mode

Use environment variables so the app starts already synced, with no UI setup:

```bash
VITE_GITHUB_SYNC_TOKEN=ghp_xxx
VITE_GITHUB_SYNC_GIST_ID=
VITE_GITHUB_SYNC_LABEL=main
VITE_GITHUB_SYNC_AUTO=true
```

Template files are included at `neurolegs-local/.env.example` (tracked) and `neurolegs-local/.env.local` (local only).

How it behaves:
- If `VITE_GITHUB_SYNC_GIST_ID` is set, it connects to that gist directly.
- If `VITE_GITHUB_SYNC_GIST_ID` is empty, the app auto-discovers a gist with the same sync label.
- If none exists yet, the app auto-creates one on first logged training data.
- Settings tab switches to read-only “zero-input mode”.
