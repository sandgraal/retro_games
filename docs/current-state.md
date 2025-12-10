# Current State Overview

_Last updated: February 2026_

## Architecture

- **TypeScript SPA** built with **Vite 7**; no framework.
- **Custom signals** drive state and computed views (`src/core/signals.ts`).
- **State store** in `src/state/store.ts` enriches games with keys, persists collection/notes/preferences to `localStorage`, and exposes `filteredGames` + `collectionStats`.
- **Data layer** in `src/data/loader.ts` tries Supabase (`games_consolidated` view) when `config.js` + the Supabase CDN client are present, otherwise falls back to `data/sample-games.json` (8 games).
- **UI** lives in `src/ui/` (grid with virtualization at ≥100 cards, modal, filters, dashboard, settings modal).
- **Exports** handled by `src/features/export.ts` (CSV, backup, share codes).
- **Pricing** currently reads only `data/sample-price-history.json` (cents).

## Data Flow

1. `main.ts` loads persisted state, mounts UI components, then fetches games and price data in parallel.
2. Loader waits up to 4 seconds for Supabase globals before using sample data; `?sample=1` or `__SANDGRAAL_FORCE_SAMPLE__` force the fallback.
3. Collection status and notes updates persist immediately to `localStorage` and feed the dashboard and modal.
4. Export/share/backup actions surface through header/settings controls and use `src/features/export.ts`.

## Tests

- **Vitest**: 204 unit tests across core, state, features, formatting, and build scripts.
- **Playwright**: 14 tests across smoke, filters, and aria checks (`tests/e2e/*.spec.js`).
- Commands: `npm test`, `npm run test:e2e` (after `npx playwright install --with-deps`).

## Working

- Virtualized game grid with keyboard navigation and hover overlays.
- Filters: platform + genre checkboxes, search input, and sorts for name/rating/year/value/platform.
- Modal for viewing details plus updating status and notes.
- Settings modal: theme/view switches, backup/restore, clear collection.
- CSV export, JSON backups, and share-code import via `?share=`.
- Dashboard stats and price display backed by the local price snapshot.
- Service worker + manifest provide basic offline support.

## Known Gaps / Risks

- Pricing is local-only; there is no live fetch or Supabase-backed price table.
- Supabase usage depends on `config.js` existing in production and the CDN client loading; deployments missing either silently fall back to the sample data.
- Auxiliary helpers in `src/core` (events/router/storage/worker) are unused by the UI today.
- Sample dataset is tiny; large-list performance relies on Supabase returning volume.

## Next Steps

1. Exercise Supabase path end-to-end (config.js + CDN) in automation to prevent silent sample fallback.
2. Replace the local price snapshot with a real source (Supabase table or API) or expose a clear toggle when prices are unavailable.
3. Add coverage for the virtualized grid and sorting behavior under larger datasets.
4. Grow the sample dataset so local development and tests better mirror production shape.
