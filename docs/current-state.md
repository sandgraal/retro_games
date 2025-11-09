# Current State Overview

_Last updated: June 2024_

## Architecture

- Single-page application served as static assets (`index.html`, `style.css`, `app.js`).
- Vanilla JavaScript orchestrates DOM rendering, Supabase queries, and browser `localStorage` for owned-game tracking.
- Supabase acts as the backing data store. The frontend expects a `games` table whose columns match the CSV header (`Game Name`, `Platform`, `Rating`, etc.).
- No build tooling or bundler; assets are edited by hand and delivered directly to the browser.
- Supabase requests now stream in 400-row pages (configurable) using `.range()`; the UI renders the first chunk immediately and hydrates additional chunks only when the virtualized grid/pagination controls need more data.

## Data Flow

1. `config.js` (ignored by git) exposes `window.__SUPABASE_CONFIG__` with the Supabase URL and anon key.
2. `app.js` instantiates a Supabase client and fetches all rows from the `games` table, ordered alphabetically.
   - If Supabase credentials are missing or unreachable, the frontend transparently loads `data/sample-games.json` so the UI stays functional.
3. The dataset populates filter dropdowns and an interactive table. Per-row status (owned, wishlist, backlog, trade) is stored in `localStorage` under the key `roms_owned` and drives both the stats widget and sharing/export flows.
4. Users can export owned titles to CSV, backup their entire collection (statuses, notes, filters) as JSON, or create a share code (base64-encoded JSON). Importing a share code or backup restores a read-only or editable view, respectively.
5. Clicking a row opens a modal with metadata and quick links to Google, YouTube gameplay, and GameFAQs searches.

## UI & Styling

- Retro-inspired theme built around the "Press Start 2P" Google Font, neon gradients, and glowing accents (`style.css`).
- Responsive adjustments for screens below 800px and 700px adjust layout and modal sizes.
- Filter toolbar now exposes platform, genre, search, status, minimum rating, and release-year range inputs for precise slicing.
- A browse toolbar surfaces batch-size controls, an infinite-scroll vs. paginated toggle, and a live summary (`browseSummary`) so collectors (or crawlers) can load long lists in manageable chunks or deep-link to `?page=X` routes.
- Card rendering is virtualized: only the rows within (or near) the viewport mount, with spacer elements maintaining scroll height for buttery navigation through thousands of entries.
- Accessibility helpers include focus trapping in the modal and keyboard shortcuts (Escape closes modal, Enter triggers import field).
- Table headers are now interactive, enabling ascending/descending sorting per column with keyboard support.

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
- Performance: Supabase pagination now streams data in 400-row chunks and only hydrates additional pages when the virtualized grid needs them, but we still fetch the full dataset client-side eventually; long-term we should explore server-side filtering/aggregation for 10k+ titles.
