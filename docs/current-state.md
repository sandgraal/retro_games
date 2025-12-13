# Current State Overview

_Last updated: December 2025_

> **🚀 UNIVERSAL EXPANSION UNDERWAY**: This project is transitioning from retro-only to a universal games database covering ALL platforms and eras. See [UNIVERSAL_EXPANSION.md](./UNIVERSAL_EXPANSION.md) for the full roadmap.

## Architecture

- **TypeScript SPA** built with **Vite 7**; no framework.
- **Custom signals** drive state and computed views (`src/core/signals.ts`).
- **State store** in `src/state/store.ts` enriches games with keys, persists collection/notes/preferences to `localStorage`, and exposes `filteredGames` + `collectionStats`.
- **Data layer** in `src/data/loader.ts` tries Supabase (`games_consolidated` view) when `config.js` + the Supabase CDN client are present, otherwise falls back to `data/sample-games.json` (24 games).
- **UI** lives in `src/ui/` (grid with virtualization at ≥100 cards, modal, filters, dashboard, settings modal, moderation panel, guides).
- **Exports** handled by `src/features/export.ts` (CSV, backup, share codes).
- **Pricing** reads from live API endpoints first (`/api/v1/prices/latest`), falling back to `data/sample-price-history.json` (cents).

## Data Flow

1. `main.ts` loads persisted state, mounts UI components, then fetches games and price data in parallel.
2. Loader waits up to 4 seconds for Supabase globals before using sample data; `?sample=1` or `__SANDGRAAL_FORCE_SAMPLE__` force the fallback, and the UI surfaces the reason when the sample dataset is shown.
3. Collection status and notes updates persist immediately to `localStorage` and feed the dashboard and modal.
4. Export/share/backup actions surface through header/settings controls and use `src/features/export.ts`.

## Tests

- **Vitest**: 390 unit tests across core, state, features, formatting, suggestions, and build scripts.
- **Playwright**: 16 e2e tests across smoke, filters, aria checks, and performance (`tests/e2e/*.spec.js`).
- **Total**: 406 tests (390 unit + 16 e2e)
- Commands: `npm test`, `npm run test:e2e` (after `npx playwright install --with-deps`).

## Working

- Virtualized game grid with keyboard navigation and hover overlays.
- Filters: platform + genre + era checkboxes, search input, indie/VR/deals toggles, and sorts for name/rating/year/value/platform.
- Modal for viewing details plus updating status and notes.
- Settings modal: theme/view switches, backup/restore, clear collection.
- CSV export, JSON backups, and share-code import via `?share=`.
- Dashboard stats and price display backed by the local price snapshot.
- Service worker + manifest provide basic offline support.
- **Platform Import**: Import collections from Steam, Xbox, PlayStation, Nintendo, Backloggd, and 10+ other services.

## Known Gaps / Risks

- **Pricing coverage gap**: eBay pricing covers ~120 retro games (from `games.csv`), but the catalog now has 32,937 games. Digital/modern games don't have eBay sold data. The UI now gracefully handles missing prices with platform-aware messaging and external lookup links (Steam, GOG, IsThereAnyDeal, eBay, PriceCharting, Deku Deals).
- Supabase usage depends on `config.js` existing in production and the CDN client loading; deployments missing either silently fall back to the sample data.

## Next Steps

1. ~~**IGDB API integration**~~ ✅ Complete - `services/catalog-ingest/sources/igdb.js` ready
2. ~~**Era/Modern filters**~~ ✅ Complete - Era, Indie, VR filters in UI
3. ~~**Platform Import**~~ ✅ Complete - Import from Steam, Backloggd, and 10+ services
4. ~~**Run IGDB ingestion**~~ ✅ Complete - **74,458 games** from 13 platforms ingested (December 2025)
5. ~~**Apply database migration**~~ ✅ Complete - Deduplicated games table, added unique constraint
6. ~~**Supabase sync**~~ ✅ Complete - **32,937 games** synced across 58 platforms (1972-2026)
7. ~~**Fix sync errors**~~ ✅ Complete - Transformer now handles empty release_year as null
8. ~~**Automate catalog refresh**~~ ✅ Complete - `DOTENV_PRIVATE_KEY` configured, `.github/workflows/catalog-refresh.yml` runs daily at 3 AM UTC
9. ~~**Graceful missing price UX**~~ ✅ Complete - Platform-aware messaging with external lookup links for digital, retro, and modern games
10. ~~**Virtualization at scale**~~ ✅ Validated - Performance tests confirm <500ms load for 1000+ games with only 24 cards rendered
11. **Steam API integration** - Add PC game pricing from Steam/GOG/IsThereAnyDeal APIs (Phase 5B)

**📖 See [UNIVERSAL_EXPANSION.md](./UNIVERSAL_EXPANSION.md) for the complete expansion roadmap (Phase 5A complete, Phase 5B next).**
