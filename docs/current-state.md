# Current State Overview

_Last updated: December 2025_

> **🚀 UNIVERSAL EXPANSION UNDERWAY**: This project is transitioning from retro-only to a universal games database covering ALL platforms and eras. See [UNIVERSAL_EXPANSION.md](./UNIVERSAL_EXPANSION.md) for the full roadmap.

## Architecture

- **TypeScript SPA** built with **Vite 7**; no framework.
- **Custom signals** drive state and computed views (`src/core/signals.ts`).
- **State store** in `src/state/store.ts` enriches games with keys, persists collection/notes/preferences to `localStorage`, and exposes `filteredGames` + `collectionStats`.
- **Data layer** in `src/data/loader.ts` tries Supabase (`games_with_variants` view) when `public/config.js` + the Supabase CDN client are present, otherwise falls back to `data/sample-games.json` (24 games). Each row represents a game+platform variant for collection tracking.
- **UI** lives in `src/ui/` (grid with virtualization at ≥100 cards, modal, filters, dashboard, settings modal, moderation panel, guides).
- **Exports** handled by `src/features/export.ts` (CSV, backup, share codes).
- **Pricing** reads from live API endpoints first (`/api/v1/prices/latest`), falling back to `data/sample-price-history.json` (cents).

## Data Flow

1. `main.ts` loads persisted state, mounts UI components, then fetches games and price data in parallel.
2. Loader waits up to 4 seconds for Supabase globals before using sample data; `?sample=1` or `__SANDGRAAL_FORCE_SAMPLE__` force the fallback, and the UI surfaces the reason when the sample dataset is shown.
3. Collection status and notes updates persist immediately to `localStorage` and feed the dashboard and modal.
4. Export/share/backup actions surface through header/settings controls and use `src/features/export.ts`.

## Tests

- **Vitest**: 454 unit tests across core, state, features, formatting, suggestions, adapters, shared utilities, and build scripts.
- **Playwright**: 16 e2e tests across smoke, filters, aria checks, and performance (`tests/e2e/*.spec.js`).
- **Total**: 470 tests
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

## Security

- **Row Level Security (RLS)**: All user-facing tables have RLS enabled with appropriate policies.
- **View Security**: All views use `security_invoker = true` to enforce caller's permissions rather than definer's.
- **Backup Tables**: Archive/backup tables (`games_duplicate_backup`, `games_pre_consolidation`) have RLS enabled with no policies, blocking all API access except service role.
- **XSS Prevention**: User-provided content (preset names, search queries) is escaped via `escapeHtml()` before rendering.
- **API Keys**: Supabase anon key is public-safe (RLS enforces access); service role key is only used in backend scripts.

Run `npm run supabase:advisors` to check for security warnings (requires Supabase MCP).

## Known Gaps / Risks

- **Pricing coverage gap**: eBay pricing covers ~120 retro games (from `games.csv`), but the catalog now has 32,599 game variants. Digital/modern games don't have eBay sold data. The UI now gracefully handles missing prices with platform-aware messaging and external lookup links (Steam, GOG, IsThereAnyDeal, eBay, PriceCharting, Deku Deals).
- Supabase usage depends on `config.js` existing in production and the CDN client loading; deployments missing either silently fall back to the sample data.

## Next Steps (Phase 5B: PC Gaming)

1. ~~**Steam adapter**~~ ✅ Complete - `services/catalog-ingest/sources/steam.js` ready
2. ~~**GOG adapter**~~ ✅ Complete - `services/catalog-ingest/sources/gog.js` ready
3. **Run Steam ingestion** - Execute `npm run ingest:steam`
4. **Run GOG ingestion** - Execute `npm run ingest:gog`
5. **Steam price sync** - Integrate Steam pricing into the pricing pipeline
6. **IsThereAnyDeal API** - Add price comparison across PC storefronts
7. **PC platform badges** - Update UI to show Steam/GOG/Epic icons on PC games

### Completed (Phase 5A)

- ✅ IGDB API integration (74,458 games ingested)
- ✅ Era/Modern filters in UI
- ✅ Platform Import (Steam, Backloggd, 10+ services)
- ✅ Supabase sync (32,937 games across 58 platforms)
- ✅ Automated daily catalog refresh
- ✅ Graceful missing price UX
- ✅ Virtualization at scale (<500ms for 1000+ games)

**📖 See [UNIVERSAL_EXPANSION.md](./UNIVERSAL_EXPANSION.md) for the complete expansion roadmap (Phase 5A complete, Phase 5B in progress).**
