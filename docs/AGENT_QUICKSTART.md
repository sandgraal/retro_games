# Agent Quickstart Guide

_Last updated: February 2026_

## Project Snapshot

| Area          | Status                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------- |
| Application   | TypeScript + Vite SPA with custom signals; sample data by default, Supabase when configured |
| Language      | TypeScript (strict)                                                                         |
| Build         | Vite 7                                                                                      |
| Tests         | 204 Vitest unit tests + 14 Playwright e2e tests                                             |
| Data          | `data/sample-games.json` (8 games) + optional Supabase `games_consolidated` view            |
| Documentation | README, architecture, and current-state kept in sync                                        |

## Required Reading

1. `README.md`
2. `docs/architecture.md`
3. `docs/current-state.md`

## Quick Commands

```bash
npm install
npm run dev           # http://localhost:3000
npm run build         # tsc --noEmit + vite build
npm test              # Vitest
npm run test:e2e      # Playwright (after `npx playwright install --with-deps`)
npm run lint          # ESLint
npm run build:config  # Emit config.js from .env
```

## Architecture Overview

```
src/
├── core/        # signals, types, keys, experimental helpers (events/router/storage/worker)
├── state/       # signal-based store, computed filters, persistence
├── data/        # Supabase client + loader with sample fallback
├── features/    # export/share/backup logic
├── ui/          # components (cards, grid, dashboard, filters, modal, settings)
├── utils/       # formatting helpers
└── main.ts      # entry point
```

**Data flow**

1. `main.ts` loads persisted local state, mounts UI, then fetches games/prices.
2. `data/loader.ts` tries Supabase (waiting up to 4s for `config.js` + CDN client) and falls back to `data/sample-games.json`.
3. `state/store.ts` enriches games with keys, tracks collection/notes/preferences in `localStorage`, and exposes computed `filteredGames` and `collectionStats`.
4. UI components subscribe to signals for the dashboard, grid (virtualized at ≥100 cards), modal, filters, and settings modal.
5. Export/share/backup helpers live in `src/features/export.ts` and are wired through header/settings actions.

**Styling**

- CSS uses kebab-case classes (e.g., `.game-card-cover`, `.game-card-overlay`).
- `style.css` pulls tokens, base styles, utilities, and component sheets from `style/`.

## Tests

| Test File                            | Tests | Notes                                         |
| ------------------------------------ | ----- | --------------------------------------------- |
| `tests/core.test.ts`                 | 26    | Signals, keys, types                          |
| `tests/state.test.ts`                | 28    | Store, filters, sorting (includes value sort) |
| `tests/features.test.ts`             | 12    | Export/share/backup                           |
| `tests/format.test.ts`               | 36    | Formatting helpers                            |
| `tests/data-loader.test.ts`          | 3     | Data loader with Supabase fallback            |
| `tests/fetch-covers.test.js`         | 48    | Cover fetching script                         |
| `tests/audit-missing-covers.test.js` | 26    | Cover audit script                            |
| `tests/archive-media.test.js`        | 14    | Media archival script                         |
| `tests/build-css.test.js`            | 11    | CSS bundler script                            |
| `tests/e2e/*.spec.js`                | 14    | Playwright smoke/filters/aria specs           |

**Total: 204 unit tests + 14 E2E tests = 218 tests**

## Working Features

- Virtualized card grid with hover overlays, keyboard focus, and placeholder covers.
- Filters: platform + genre checkboxes, search input, sorts for name/rating/year/value/platform.
- Collection status and notes stored locally; modal updates them in-place.
- Settings modal handles theme/view selection, backup/restore, and clearing local data.
- CSV export, JSON backups, and share codes (`?share=`) for imports.
- Dashboard stats and price displays driven by `data/sample-price-history.json` (values in cents).
- Service worker and manifest for basic offline support.

## Known Gaps / Priorities

- Price data only comes from the local snapshot; there is no live pricing fetch.
- Supabase usage depends on `config.js` being present and the CDN client loading; ensure that script exists in deployments that expect cloud data.
- Extra helpers in `src/core` (events/router/storage/worker) are experimental and not wired into the UI.
- Sample dataset is tiny (8 games), so UX under large data sets relies on Supabase providing volume.

## DO / DON’T

- **DO** keep CSS class names in kebab-case and prefer the existing component primitives.
- **DO** respect `archive/` as read-only legacy reference.
- **DO** regenerate `config.js` locally instead of committing secrets.
- **DON’T** assume Supabase is available; code must tolerate sample fallback.
- **DON’T** add dependencies without a concrete need.
