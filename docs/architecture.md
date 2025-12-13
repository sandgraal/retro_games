# Architecture Overview

_Last updated: December 2025_

## Overview

Dragon's Hoard Atlas is a small, framework-free **TypeScript** single-page app built with **Vite 7**. A custom signals implementation powers UI updates, and data is pulled from Supabase when available or from local JSON snapshots otherwise. All collection data is stored locally.

## Tech Stack

| Layer    | Details                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Language | TypeScript (strict)                                                                                        |
| Build    | Vite 7 (base `/retro-games/`, dev server on 3000)                                                          |
| Runtime  | Vanilla JS + custom signals                                                                                |
| Data     | Supabase (`games_consolidated`) or `data/sample-games.json`; pricing from `data/sample-price-history.json` |
| Storage  | `localStorage` for collection, notes, preferences, filters                                                 |
| Testing  | Vitest (unit) + Playwright (e2e)                                                                           |

## Source Structure

```
src/
├── core/            # signals + helpers
│   ├── signals.ts          # createSignal, computed, effect, batch
│   ├── types.ts            # shared TypeScript types
│   ├── keys.ts             # game key generation helpers
│   ├── storage.ts          # localStorage wrapper with error handling
│   ├── platform-families.ts # platform grouping and normalization
│   └── index.ts            # re-exports
├── state/           # centralized state
│   └── store.ts            # signals, computed filteredGames/collectionStats, persistence
├── data/            # data access
│   ├── supabase.ts         # waits for CDN client + config.js, queries games_consolidated
│   ├── loader.ts           # chooses Supabase or sample JSON; loads price snapshot
│   ├── pricing-api.ts      # pricing data API client
│   ├── pricing-provider.ts # price data loading with fallback
│   ├── auth.ts             # authentication session management
│   ├── suggestions.ts      # community submission APIs
│   ├── guides.ts           # markdown guide loading
│   └── database.types.ts   # Supabase type definitions
├── features/        # business logic
│   ├── export.ts           # CSV export, backups, share codes, clipboard/download
│   └── platform-import.ts  # collection import from external services
├── ui/              # components
│   ├── components.ts       # mount helper, element factory, debounce/throttle
│   ├── game-grid.ts        # grid + virtualization (≥100 cards)
│   ├── game-card.ts        # card rendering + modal trigger
│   ├── dashboard.ts        # stats and price display
│   ├── filters.ts          # platform/genre filters, search, sort controls
│   ├── filter-presets.ts   # saved filter presets
│   ├── modal.ts            # game detail modal (status + notes)
│   ├── settings-modal.ts   # preferences + backup/restore/clear
│   ├── import-modal.ts     # platform import wizard UI
│   ├── moderation.ts       # moderation queue panel
│   ├── guides.ts           # guide content rendering
│   ├── curated-sections.ts # featured/curated game sections
│   ├── recently-viewed.ts  # recently viewed games tracker
│   ├── smart-search.ts     # enhanced search with suggestions
│   ├── infinite-scroll.ts  # pagination/infinite scroll
│   ├── url-state.ts        # URL parameter sync
│   └── index.ts            # re-exports
├── utils/           # pure helpers
│   └── format.ts           # currency/number/date formatting
├── main.ts                 # entry point: mounts UI, loads data, wires actions
└── index.ts                # public API exports
```

## Reactivity

- `createSignal(value)` returns `{ get, set, subscribe, peek }`.
- `computed(fn)` tracks dependencies automatically and notifies subscribers.
- `effect(fn)` runs immediately and on dependency changes; optional cleanup supported.
- `batch(fn)` defers notifications until the batch completes.

UI components subscribe via `effect` and rely on the store's computed values:

- `filteredGames`: applies platform/genre/status/search/rating/year filters plus sorting (name/rating/year/value/platform).
- `collectionStats`: derives owned/wishlist/backlog/trade counts, platform/genre breakdowns, total value (loose price), and completion percentage.

## Data Flow

1. `main.ts` registers the service worker, loads persisted state, mounts components, then fetches games and price data in parallel.
2. `loader.ts` waits up to 4s for `window.supabase` and `window.__SUPABASE_CONFIG__` (loaded from `config.js`) before falling back to `data/sample-games.json`. `?sample=1` or `__SANDGRAAL_FORCE_SAMPLE__` forces the sample path.
3. Price data is read from `data/sample-price-history.json`; loose price is used for totals and value sorting.
4. Collection updates (status/notes) persist to `localStorage` immediately and are reflected across dashboard, grid badges, and modal.
5. Export/share/backup functions live in `features/export.ts` and are wired to header/settings actions.

## Ingestion, moderation, and pricing overview

- **Catalog ingestion**: `services/catalog-ingest/catalog-ingest.js` normalizes external sources defined in `config.example.json` (headers per-source for auth), de-duplicates on `title + platform + release_year`, and emits versioned snapshots under `data/snapshots/`. Runs can be scheduled with `scheduleMinutes` or executed ad hoc with `--once`; metrics land in `data/ingestion-log.json` for dashboards and alerting hooks.
- **Submission moderation**: the ingest service exposes `POST /api/v1/games/:id/suggestions` and `POST /api/v1/games/new` for anonymous or authenticated contributors. Moderators access `GET /api/v1/moderation/suggestions` and approve/reject via `POST .../decision`, writing audit entries to `audit-log.json`. Approved patches flow into the next ingest run so the catalog stays immutable between snapshots.
- **Pricing pipeline**: `scripts/update-ebay-prices.cjs` fetches median sold listings from the eBay Finding API (`EBAY_APP_ID`, `EBAY_GLOBAL_ID`), writes snapshots into Supabase (`game_price_snapshots` / `game_price_latest`) when a service role key is present, and refreshes the fallback `data/sample-price-history.json` for offline demos. The GitHub Actions job `price-refresh.yml` runs twice daily with configurable limits/filters.
- **Platform import**: `src/features/platform-import.ts` supports importing game collections from Steam (via API), Xbox (TrueAchievements), PlayStation (PSNProfiles), Nintendo (Deku Deals), Backloggd, GG.deals, HowLongToBeat, Grouvee, ExoPhase, RAWG, and generic CSV. The `src/ui/import-modal.ts` provides a wizard UI with fuzzy matching and confidence scoring. Steam API calls are proxied through `supabase/functions/steam/` to avoid CORS.
- **Frontend consumption**: `src/data/loader.ts` waits up to 4 seconds for Supabase (`config.js` + CDN client). When available, it pulls the consolidated view plus price snapshots; otherwise it serves `data/sample-games.json` and the cached price history. UI components render the catalog, surface moderation-driven notes/statuses, and feed price totals into the dashboard and modal displays.

## Styling

- CSS lives under `style/` with tokens, base styles, utilities, and component sheets (`cards`, `grid`, `dashboard`, `filters`, `modal`, `settings`).
- `style.css` imports the token/base/component layers.
- Class naming uses kebab-case (`.game-card-cover`, `.game-card-overlay`, `.game-card-status`).

## Deployment Notes

- `vite.config.ts` sets `base: "/retro-games/"` for GitHub Pages compatibility.
- Supabase requires both `config.js` (generated via `npm run build:config`) and the CDN client script declared in `index.html`.
- Service worker and manifest live in `public/`.
- Experimental modules (event sourcing, router, IndexedDB storage, web worker) live in `archive/experimental/`.

## Production Status

- **32,937 games** synced to Supabase across 58 platforms (1972-2026)
- **Pricing pipeline** active: Supabase → live API → bundled snapshot fallback
- **Daily catalog refresh** via GitHub Actions (`catalog-refresh.yml`)
- **Price refresh** runs twice daily (`price-refresh.yml`)

## Known Gaps

- **PC pricing coverage**: Steam/GOG integration planned (Phase 5B) for digital game pricing
- **Offline mode**: Service worker provides basic caching; full offline support for large catalogs pending
