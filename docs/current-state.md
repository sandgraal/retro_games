# Current State Overview

_Last updated: June 2024_

## Architecture

- Single-page application served as static assets (`index.html`, `style.css`, `app.js`).
- Vanilla JavaScript orchestrates DOM rendering, Supabase queries, and browser `localStorage` for owned-game tracking.
- Supabase acts as the backing data store. The frontend expects a `games` table whose columns match the CSV header (`Game Name`, `Platform`, `Rating`, etc.).
- No build tooling or bundler; assets are edited by hand and delivered directly to the browser.

## Data Flow

1. `config.js` (ignored by git) exposes `window.__SUPABASE_CONFIG__` with the Supabase URL and anon key.
2. `app.js` instantiates a Supabase client and fetches all rows from the `games` table, ordered alphabetically.
3. The dataset populates filter dropdowns and an interactive table. Per-row ownership is stored in `localStorage` under the key `roms_owned`.
4. Users can export owned titles to CSV or create a share code (base64-encoded list of `game___platform` identifiers). Importing a share code renders a read-only view of another collection.
5. Clicking a row opens a modal with metadata and quick links to Google, YouTube gameplay, and GameFAQs searches.

## UI & Styling

- Retro-inspired theme built around the "Press Start 2P" Google Font, neon gradients, and glowing accents (`style.css`).
- Responsive adjustments for screens below 800px and 700px adjust layout and modal sizes.
- Accessibility helpers include focus trapping in the modal and keyboard shortcuts (Escape closes modal, Enter triggers import field).
- The table headers are clickable for sorting in earlier iterations (`backups/`), but current implementation renders static headers.

## Operational Notes

- Supabase credentials were previously hard-coded; they are now externalised. Without valid credentials the app surfaces a descriptive error.
- `games.csv` provides a snapshot of the canonical dataset for reseeding Supabase or offline work. It is not automatically ingested by the frontend.
- `.github/ISSUE_TEMPLATE` offers generic bug/feature templates but no workflows/CI are configured.
- Legacy HTML/CSS/JS backups are stored in `backups/` for reference when evaluating regressions or historical styling choices.

## Gaps & Risks

- No automated tests, linting, or formatting guardrails; regressions must be caught manually.
- Data integrity relies on manual Supabase updates—no scripts to sync from `games.csv` yet.
- Accessibility relies on manual QA; no Lighthouse/axe reports are part of the workflow.
- Security: Supabase anon key must remain public but should still be rotated if exposed. SFTP deployment credentials were removed from version control but may still exist in developer machines.
- Performance: All rows are fetched at once; large datasets may impact initial load and DOM rendering.
