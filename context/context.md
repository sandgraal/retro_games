# Repository Context Snapshot (2025-12)

## project_summary

- Static, production-ready retro game tracker with glassmorphism UI, Supabase-backed data (with offline sample JSON fallbacks), and optional price valuations.
- Modular vanilla JS architecture (29 ES modules across `app/` for UI, features, state, data, utils) plus modular CSS under `style/`.
- Optional Supabase tables/views for games, aggregates, and price snapshots; GitHub Actions handle price refresh, media archival, and backups.

## dependency_graph

- **Runtime:** Vanilla JS/CSS/HTML (no bundler) served statically.
- **APIs/Services:** Supabase REST/Storage (+ optional RPCs), PriceCharting API, eBay Finding API (new alternative), GitHub Actions caches.
- **Tooling:** ESLint, Prettier, Vitest, Playwright, Lighthouse CI, csv-parse, dotenv, http-server.

## commands_map

- **Config/Build:** `npm run build:config`, `npm run build:css`, `npm run build`.
- **Quality:** `npm run lint`, `npm run format:check`, `npm test`, `npm run test:e2e`, `npm run lighthouse`.
- **Data:** `npm run prices:update` (PriceCharting), `npm run prices:update:ebay` (eBay sold listings), `npm run sitemap`, `npm run seed:generate`.
- **Serve/Preview:** `python -m http.server 8080` or `npm run serve:lighthouse` / `npm run serve:dist`.

## key_paths_by_feature

- **Entry/UI:** `index.html`, `style.css`, `app/main.js`, `app/ui/*.js`, `style/components/*.css`.
- **Features:** `app/features/*.js` (filtering, search, pagination, virtualization, sharing, seo, embed).
- **Data/State:** `app/data/*.js` (pricing, loader, supabase, aggregates, storage); `app/state/*.js` (collection, preferences, filters, cache).
- **Scripts:** `scripts/update-price-snapshots.js` (PriceCharting), `scripts/update-ebay-prices.js` (eBay alternative), `scripts/build-css.js`, `scripts/generate-config.js`, `scripts/generate-seed-sql.js`.
- **Docs:** `docs/architecture.md`, `docs/current-state.md`, `docs/data-pipeline.md`, `docs/AGENT_QUICKSTART.md`.

## known_constraints_and_feature_flags

- No bundler; code runs directly in-browser—keep modules small and dependency-free.
- Supabase credentials optional; app auto-falls back to `data/sample-games.json` and `data/sample-price-history.json`.
- LocalStorage persistence for collection/notes—changes must remain backward compatible.
- CI enforces lint/format/test/Lighthouse/gitleaks; secrets must stay in env vars and not committed.
