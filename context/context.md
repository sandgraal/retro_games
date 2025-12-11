# Repository Context Snapshot (2026-01)

## project_summary

- TypeScript + Vite single-page app for tracking retro game collections with a custom signal system and virtualized card grid.
- Local-first data powered by `localStorage` (collection, notes, preferences) with optional Supabase metadata when `config.js` + CDN client are present.
- Pricing and dashboard value displays read from the bundled `data/sample-price-history.json` snapshot (values in cents).
- Backend worker `services/catalog-ingest/` normalizes external sources into versioned catalog snapshots and serves a read API for caching.
- Community submissions land in `data/suggestions.json` with moderation decisions in `data/audit-log.json`; approved patches are re-applied during ingest runs.
- Offline-friendly delivery via `public/manifest.json` and `public/sw.js`; GH Pages deployment is supported via Vite base path configuration.

## dependency_graph

- **Runtime:** Frameworkless TypeScript modules orchestrated by Vite, custom signals (`src/core/signals.ts`), and modular CSS under `style/` + `style.css`.
- **Data/Services:** Supabase `games_consolidated` view when configured, falling back to `data/sample-games.json`; price history from `data/sample-price-history.json`; persistence in `localStorage`.
- **Moderation API:** `services/catalog-ingest/` server exposes submission + moderation endpoints under `/api/v1` when run with `--serve` (writes to suggestions/audit logs).
- **Tooling:** Vite 7, TypeScript 5, ESLint/Prettier, Vitest, Playwright, Lighthouse CI, csv-parse/dotenv scripts for data tasks.

## commands_map

- **Dev/Preview:** `npm run dev`, `npm run preview`.
- **Build/Typecheck:** `npm run build` (tsc + Vite), `npm run typecheck`, `npm run build:config`, `npm run build:css` (legacy CSS build).
- **Quality:** `npm run lint`, `npm run format:check`, `npm test`, `npm run test:e2e` (requires `npx playwright install --with-deps`), `npm run lighthouse`.
- **Data/Utility:** `npm run sitemap`, `npm run ingest:catalog`, `npm run prices:update`, `npm run prices:update:ebay`, `npm run archive:media`, `npm run audit:covers`, `npm run enrich:data`.

## key_paths_by_feature

- **Entry/UI shell:** `src/main.ts`, `index.html`, `style.css` + `style/` tokens/utilities.
- **Signals & State:** `src/core/signals.ts`, `src/core/types.ts`, state store and selectors in `src/state/`.
- **Data loading:** `src/data/loader.ts` (Supabase + sample fallback), Supabase client wrapper in `src/data/supabase.ts`.
- **UI components:** `src/ui/` for header, filters, dashboard, grid/virtualization, modal, and settings modal.
- **Features:** `src/features/export.ts` for CSV/backup/share codes and import helpers.
- **Samples/assets:** `data/` for games/price snapshots, `public/` for service worker + manifest, `supabase/` for SQL schemas.
- **Backend ingest:** `services/catalog-ingest/` houses the scheduled catalog worker, snapshots, and read API helper.
- **Scripts:** `scripts/` for config generation, CSS build, sitemap and price updates, and archival utilities.

## known_constraints_and_feature_flags

- Supabase path requires `config.js` and the CDN client; loader waits ~4s before falling back to sample data (or when `?sample=1`/`__SANDGRAAL_FORCE_SAMPLE__`).
- `config.js` is generated from `.env` and now gitignored; run `npm run build:config` locally and avoid committing generated secrets.
- Collection + notes persist to `localStorage`; schema should remain backward compatible to avoid data loss.
- Pricing uses only the bundled snapshot; no live updates currently exist.
- Node >=20.19.0 enforced via `package.json` engines; lockfile updates should be minimal unless required.
- Service worker caches assets; consider cache-busting if altering resource paths or base URL.
