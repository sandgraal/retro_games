# Dragon's Hoard Atlas

A TypeScript + Vite app for tracking video games. It uses a lightweight custom signal system, renders a virtualized card grid, and keeps your collection data local-first with an optional Supabase source for metadata.

## What’s shipping today

- Custom signals with dashboard, filters, modal, and settings built without a framework.
- Game grid with hover overlays, keyboard navigation, and virtualization when lists exceed 100 cards.
- Filters: platform + genre checkboxes, search, and sort (name, rating, year, value, platform).
- Collection status (owned/wishlist/backlog/trade) and notes persisted to `localStorage`; the settings modal handles theme/view/backup/restore/clear actions.
- Export: CSV, JSON backup, and share codes that can be imported via the URL `?share=...`.
- Data sources: Supabase `games_consolidated` view when `config.js` provides credentials; otherwise `data/sample-games.json` (8 games). Prices currently come from `data/sample-price-history.json` (cents) and feed the dashboard/modal value displays.
- Offline basics via `public/sw.js` + `public/manifest.json`.

## Data sources & configuration

- **Supabase**: copy `.env.example` to `.env`, populate `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then run `npm run build:config` to emit `config.js`. The loader waits up to 4s for `window.supabase` and `window.__SUPABASE_CONFIG__` before falling back to the sample file. Set `window.__SANDGRAAL_FORCE_SAMPLE__ = true` or append `?sample=1` to force the sample dataset.
- **Pricing**: a provider first attempts live API endpoints and falls back to the bundled snapshot at `data/sample-price-history.json`. Values are stored in cents and are summed/sorted using the loose price when present; the UI surfaces the last updated timestamp when available.
- **Persistence**: collection statuses, notes, preferences, and filters live in `localStorage` (`dragonshoard_*` keys).
- **Catalog ingest**: a Node-based worker in `services/catalog-ingest/` can normalize external APIs into versioned snapshots; run it with `node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.example.json --once` to seed data and `--serve` to expose `/api/v1/catalog`.

## Services quickstart

1. **Configure environment**: copy `.env.example` to `.env`, set Supabase + eBay credentials, and run `npm run build:config` to emit `config.js` for the frontend.
2. **Seed/serve catalog**: `npm run ingest:catalog` performs a one-off pull based on `services/catalog-ingest/config.example.json`; keep it warm with `node services/catalog-ingest/catalog-ingest.js --config ... --serve` when exposing `/api/v1/catalog` + moderation endpoints.
3. **Refresh prices**: run `npm run prices:update -- --limit 25` to push snapshots into Supabase (requires `SUPABASE_SERVICE_ROLE_KEY`) and update the fallback dataset.
4. **Launch the app**: `npm run dev` for the SPA, or `npm run preview` after building to verify the Supabase/Sandbox paths.

### Data flow diagram

```mermaid
flowchart LR
  subgraph Sources
    A[External catalog APIs]
    B[eBay sold listings]
  end
  A --> C[Catalog ingest worker]\n(normalize + snapshots)
  B --> D[Price refresher]\n(eBay API -> Supabase)
  C --> E[Supabase catalog views]\n(games_consolidated)
  D --> F[Supabase price views]\n(game_price_latest)
  E --> G[Frontend loader]
  F --> G
  G --> H[UI grid, dashboard, modal]\n(sample JSON fallback when Supabase missing)
```

## Community submissions & moderation

- Auth roles: `anonymous`, `contributor`, and `moderator`/`admin` (Supabase Auth when configured, otherwise session-based fallbacks).
- Submission endpoints (when running `catalog-ingest.js --serve`):
  - `POST /api/v1/games/:id/suggestions` to propose updates to existing records (anonymous sessions supported).
  - `POST /api/v1/games/new` to suggest new games.

  **Note:** Anonymous submissions are fully supported for both suggestion endpoints. All anonymous submissions are subject to moderation and require approval by a moderator or admin before being applied, just like submissions from authenticated contributors. There are no additional moderation steps or different approval workflows for anonymous users; all submissions, regardless of authentication status, enter the same moderation queue and are reviewed according to the same criteria.

- Moderation queue: `GET /api/v1/moderation/suggestions` (moderator/admin only) with `POST .../decision` for approvals/rejections; decisions are recorded to `audit-log.json` and approved patches are applied during the next ingest run.

## Development

```
npm install
npm run dev           # Vite dev server on http://localhost:3000
npm run build         # TypeScript check + Vite build
npm run lint          # ESLint over src + scripts
npm test              # Vitest (327 tests)
npm run test:e2e      # Playwright (14 tests); run `npx playwright install --with-deps` once
npm run build:config  # Generate config.js from .env
```

## Project layout

- `src/core` – signals, types, keys, and experimental helpers (events/router/storage/worker).
- `src/state` – signal-based store, computed filters, persistence helpers.
- `src/data` – Supabase client wrapper and loader with sample fallback.
- `src/ui` – component primitives, game grid, cards, dashboard, filters, modal, settings modal.
- `src/features` – export/share/backup logic.
- `style/` – tokens, base styles, utilities, and component CSS; `style.css` composes them.
- `data/` – sample games and price history used when Supabase is unavailable.
- `public/` – service worker and manifest.

## Contributing

- Keep `archive/` untouched (legacy reference).
- Do not commit real credentials; regenerate `config.js` locally when secrets rotate.
- Prefer kebab-case CSS classes to match the existing styles.
- Run `npm test` (and Playwright if you touch the UI) before sending changes.
