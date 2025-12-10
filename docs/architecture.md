# Architecture Overview

_Last updated: February 2026_

## Overview

Dragon's Hoard Atlas is a small, framework-free **TypeScript** single-page app built with **Vite 7**. A custom signals implementation powers UI updates, and data is pulled from Supabase when available or from local JSON snapshots otherwise. All collection data is stored locally.

## Tech Stack

| Layer    | Details                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Language | TypeScript (strict)                                                                                        |
| Build    | Vite 7 (base `./`, dev server on 3000)                                                                     |
| Runtime  | Vanilla JS + custom signals                                                                                |
| Data     | Supabase (`games_consolidated`) or `data/sample-games.json`; pricing from `data/sample-price-history.json` |
| Storage  | `localStorage` for collection, notes, preferences, filters                                                 |
| Testing  | Vitest (unit) + Playwright (e2e)                                                                           |

## Source Structure

```
src/
├── core/            # signals + helpers
│   ├── signals.ts   # createSignal, computed, effect, batch
│   ├── types.ts     # shared types
│   ├── keys.ts      # game key helpers
│   ├── events.ts    # experimental event-store (unused by UI)
│   ├── router.ts    # lightweight route helper (unused)
│   ├── runtime.ts   # alternate signal API surface
│   ├── storage.ts   # simple storage wrapper
│   └── worker.ts    # worker helper
├── state/           # centralized state
│   └── store.ts     # signals, computed filteredGames/collectionStats, persistence
├── data/            # data access
│   ├── supabase.ts  # waits for CDN client + config.js, queries games_consolidated
│   └── loader.ts    # chooses Supabase or sample JSON; loads price snapshot
├── features/        # business logic
│   └── export.ts    # CSV export, backups, share codes, clipboard/download helpers
├── ui/              # components
│   ├── components.ts      # mount helper, element factory, debounce/throttle
│   ├── game-grid.ts       # grid + virtualization (≥100 cards)
│   ├── game-card.ts       # card rendering + modal trigger
│   ├── dashboard.ts       # stats and price display
│   ├── filters.ts         # platform/genre filters, search, sort controls
│   ├── modal.ts           # game detail modal (status + notes)
│   ├── settings-modal.ts  # preferences + backup/restore/clear
│   └── index.ts           # re-exports
├── utils/           # pure helpers
│   └── format.ts    # currency/number/date formatting
├── main.ts          # entry point: mounts UI, loads data, wires actions
└── index.ts         # public API exports
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

## Styling

- CSS lives under `style/` with tokens, base styles, utilities, and component sheets (`cards`, `grid`, `dashboard`, `filters`, `modal`, `settings`).
- `style.css` imports the token/base/component layers.
- Class naming uses kebab-case (`.game-card-cover`, `.game-card-overlay`, `.game-card-status`).

## Deployment Notes

- `vite.config.ts` sets `base: "./"` for GitHub Pages compatibility.
- Supabase requires both `config.js` (generated via `npm run build:config`) and the CDN client script declared in `index.html`.
- Service worker and manifest live in `public/`.

## Gaps

- Live pricing is not implemented; only the local snapshot is read.
- Experimental helpers in `src/core` are not wired into the UI.
- Sample data is minimal; large-data behavior depends on Supabase providing volume.
