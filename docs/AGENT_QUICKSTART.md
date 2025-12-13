# Agent Quickstart Guide

_Last updated: December 2025_

> 🚀 **MAJOR UPDATE**: This project is expanding from retro-only to a **Universal Games Atlas** covering ALL games with community submissions and moderation.

## Project Snapshot

| Area        | Status                                                                          |
| ----------- | ------------------------------------------------------------------------------- |
| Application | TypeScript + Vite SPA with custom signals; Supabase backend with local fallback |
| Language    | TypeScript (strict)                                                             |
| Build       | Vite 7                                                                          |
| Tests       | 434 Vitest unit tests + 16 Playwright e2e tests = **450 total**                 |
| Data        | Supabase (**32,937 games**) + `data/sample-games.json` fallback (24 games)      |
| Phase       | **Phase 5B In Progress** - PC Gaming adapters complete, awaiting ingestion      |

## Required Reading (Priority Order)

1. `docs/implementation-plan.md` – **START HERE** for current roadmap
2. `docs/architecture.md` – Technical architecture
3. `docs/current-state.md` – What's working today
4. `docs/api/README.md` – API documentation (new)
5. `docs/guides/data-sources.md` – External API setup (new)
6. `docs/guides/moderation.md` – Moderation workflow (new)

## What's New (December 2025)

### IGDB Catalog Sync Complete ✅

- **74,458 games** ingested from IGDB (13 platforms)
- **32,937 games** synced to Supabase production (58 platforms, 1972-2026)
- Daily automated catalog refresh via GitHub Actions (3 AM UTC)
- Platform name normalization for consistent data
- Unique constraint on (game_name, platform) for upsert operations

### Database Schema (Deployed to Supabase)

- `catalog_submissions` – Community submission queue
- `audit_log` – Immutable moderation history
- `game_external_ids` – Links to IGDB, RAWG, etc.
- `ingestion_runs` – Automated sync tracking
- Full-text search with `pg_trgm` fuzzy matching
- `search_games()` function for server-side search

### Completed Work Tracks ✅

1. **IGDB Integration** – Complete with OAuth, 74,458 games ingested
2. **Supabase Sync** – Production database populated with 32,937 games
3. **Automated Refresh** – Daily catalog updates via `catalog-refresh.yml`
4. **User Submissions** – "Suggest Edit" UI in modal
5. **Moderation Queue** – `/moderation` route with role-based access

## Quick Commands

```bash
npm install
npm run dev           # http://localhost:3000
npm run build         # tsc --noEmit + vite build
npm test              # Vitest (390 tests)
npm run test:e2e      # Playwright (after `npx playwright install --with-deps`)
npm run lint          # ESLint
npm run build:config  # Emit config.js from .env

# Catalog Ingestion
node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.example.json --once
```

## Architecture Overview

```
src/
├── core/        # signals, types, keys
├── state/       # signal-based store, computed filters, persistence
├── data/        # Supabase client + loader with sample fallback
├── features/    # export/share/backup logic
├── ui/          # components (cards, grid, dashboard, filters, modal, settings)
├── utils/       # formatting helpers
└── main.ts      # entry point

services/
└── catalog-ingest/   # Multi-source data aggregation service
    ├── catalog-ingest.js   # 963-line ingestion + API server
    └── config.example.json # Source configuration template
```

**Data flow**

1. `main.ts` loads persisted local state, mounts UI, then fetches games/prices.
2. `data/loader.ts` tries Supabase (waiting up to 4s for `config.js` + CDN client) and falls back to `data/sample-games.json`.
3. `state/store.ts` enriches games with keys, tracks collection/notes/preferences in `localStorage`, and exposes computed `filteredGames` and `collectionStats`.
4. UI components subscribe to signals for the dashboard, grid (virtualized at ≥100 cards), modal, filters, and settings modal.
5. Export/share/backup helpers live in `src/features/export.ts` and are wired through header/settings actions.

**New: Catalog Ingestion Flow**

1. `catalog-ingest.js` fetches from configured sources (RAWG, IGDB)
2. Records normalized into unified schema
3. Fuzzy matching detects duplicates (bigram similarity)
4. SHA-256 hashing enables delta updates
5. Approved community submissions merged during sync
6. Snapshots written for CDN caching

## Key Database Tables

| Table                 | Purpose                       | RLS                         |
| --------------------- | ----------------------------- | --------------------------- |
| `games_consolidated`  | Core game view (all metadata) | Public read                 |
| `catalog_submissions` | Community queue               | User sees own, mods see all |
| `audit_log`           | Moderation history            | Mods only                   |
| `game_external_ids`   | IGDB/RAWG links               | Public read                 |
| `profiles`            | User roles                    | Own profile                 |

## Tests

| Test File                             | Tests | Notes                                  |
| ------------------------------------- | ----- | -------------------------------------- |
| `tests/core.test.ts`                  | 26    | Signals, keys, types                   |
| `tests/state.test.ts`                 | 30    | Store, filters, sorting                |
| `tests/features.test.ts`              | 26    | Export/share/backup                    |
| `tests/format.test.ts`                | 36    | Formatting helpers                     |
| `tests/components.test.ts`            | 15    | UI component utilities                 |
| `tests/modal.test.ts`                 | 7     | Modal component                        |
| `tests/suggestions.test.ts`           | 9     | Community suggestions                  |
| `tests/pricing-provider.test.ts`      | 9     | Pricing data provider                  |
| `tests/catalog-ingest.test.ts`        | 60    | Ingestion, submissions, moderation API |
| `tests/data-loader.test.ts`           | 4     | Data loader with Supabase fallback     |
| `tests/fetch-covers.test.js`          | 48    | Cover fetching script                  |
| `tests/audit-missing-covers.test.js`  | 26    | Cover audit script                     |
| `tests/archive-media.test.js`         | 14    | Media archival script                  |
| `tests/build-css.test.js`             | 12    | CSS bundler script                     |
| `tests/ebay-account-deletion.test.ts` | 24    | eBay account deletion compliance       |
| `tests/platform-import.test.ts`       | 9     | Platform import functionality          |
| `tests/steam-adapter.test.ts`         | 20    | Steam Web API adapter                  |
| `tests/gog-adapter.test.ts`           | 24    | GOG.com API adapter                    |
| `tests/e2e/*.spec.js`                 | 16    | Playwright smoke/filters/aria/perf     |

**Total: 434 unit tests + 16 E2E tests = 450 tests**

## What To Work On

### Phase 5A: Modern Platforms ✅ COMPLETE

- [x] IGDB API integration with OAuth (`services/catalog-ingest/sources/igdb.js`)
- [x] Ingest 74,458 games from 13 platforms
- [x] Sync 32,937 games to Supabase production
- [x] Add unique constraint migration for upserts
- [x] Configure daily automated refresh (`catalog-refresh.yml`)
- [x] Platform name normalization
- [x] Era/Indie/VR filter support in UI

### Current Priority (Phase 5B: PC Gaming) 🚧

1. [x] Steam API adapter (`services/catalog-ingest/sources/steam.js`)
2. [x] Steam config (`services/catalog-ingest/config.steam.json`)
3. [x] GOG API adapter (`services/catalog-ingest/sources/gog.js`)
4. [ ] Run Steam ingestion to populate catalog
5. [ ] Run GOG ingestion to populate catalog
6. [ ] PC-specific metadata (system requirements, launcher)
7. [ ] Steam/GOG pricing integration

### Medium Priority

7. [ ] Replace local price snapshot with live Supabase pricing
8. [ ] Add rate limiting to submission endpoints
9. [ ] Build user profile page with submission history
10. [ ] Test virtualization with 50k+ games (performance validation)

### Documentation Status

- [x] README.md updated with universal scope
- [x] Steam adapter documentation in catalog-ingest README
- [x] GOG adapter documentation in catalog-ingest README
- [ ] Document pricing data architecture

## DO / DON'T

- **DO** check `docs/implementation-plan.md` Phase 5 for current tasks
- **DO** keep CSS class names in kebab-case
- **DO** use the catalog-ingest REST API for moderation (`/api/v1/moderation/suggestions`)
- **DO** test with `npm test` before committing
- **DON'T** commit API keys (use `.env` and `config.js`)
- **DON'T** modify `archive/` directory
- **DON'T** bypass RLS policies in client code
- **DON'T** assume auth is available; handle anonymous gracefully
