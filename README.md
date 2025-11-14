# Retro Game Site

WIP: A fast, private, and no-nonsense tracker for classic and retro games. A place for retro gamers to get their fix.

**Features:**

- Instantly search, sort, and filter (platform, genre, status, rating, release-year range) a growing database of console classics
- Assign Owned/Wishlist/Backlog/Trade statuses (stored locally for privacy)
- Attach personal notes to every game—synced with share codes for easy collaboration
- One-click JSON backups to move statuses/notes/filters across devices
- Share your collection with anyone via code—no registration required
- Choose between infinite scroll batches or paginated pages (with adjustable batch sizes and shareable `?page=` links) so both humans and crawlers can browse huge lists
- Virtualized grid keeps the DOM lean by only rendering what's in (or near) the viewport, so even five-digit libraries stay silky smooth
- Supabase data streams in 400-row pages (configurable), so the UI becomes interactive instantly while new chunks hydrate the grid on-demand
- Filters/search now execute directly against Supabase, so you only download the rows you actually need—even for massive, high-cardinality queries
- Collection status totals and dashboard charts (top genres, release timeline) hydrate lazily from Supabase, keeping insights accurate without pulling the entire dataset
- Live valuations powered by PriceCharting snapshots show loose/CIB/new totals per status plus per-game price history sparklines inside the modal
- See box art, details, and direct links to gameplay videos or GameFAQs
- Fully mobile and desktop compatible
- Supabase-powered typeahead search with a local fallback so you can jump to titles instantly
- Optional PriceCharting integration surfaces loose/CIB/new valuations per game, keeps a price-history sparkline in the modal, and estimates total collection value by status.

This is not another bloated ROM launcher or subscription service.
It’s a clean, modern tool for serious collectors, archivists, and retro fans who want control over their library.

## Setup

1. Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key. Optionally set `SUPABASE_TABLE`
   (single table) or `SUPABASE_TABLES` (comma-separated priority list) if your dataset lives in a custom view such as
   `games_new`.
2. Install dependencies once with `npm install`, then run `npm run build:config` to generate `config.js` from your `.env`.
   Commit the generated `config.js` so GitHub Pages (or any static host) can read the public anon key; rerun and commit the file
   whenever you rotate credentials.
3. Serve the site locally with any static server, e.g. `python -m http.server 8080`.
4. Anytime you rotate credentials, update `.env` and rerun `npm run build:config`.

- Rotate Supabase anon/service keys with `node scripts/rotate-supabase-keys.js` (updates `.env` and optionally GitHub secrets).
- (Optional) Add `SUPABASE_STREAM_PAGE_SIZE=<int>` to tune the paginated `.range()` queries (defaults to 400 rows per chunk).
- (Optional) Provide RPC names for dashboard aggregates via `SUPABASE_RPC_GENRES` and `SUPABASE_RPC_TIMELINE` (or `rpc.genres` / `rpc.timeline` in `config.js`). The default migrations already ship `rpc_genre_counts` / `rpc_timeline_counts`, so you can leave these unset unless you rename the functions.
- (Optional) Enable live valuations by adding `PRICECHARTING_TOKEN=<your-token>` (plus optional `PRICECHARTING_CURRENCY` and `PRICECHARTING_CACHE_HOURS`)—the dashboard will fetch PriceCharting data, cache it locally, and chart per-status totals.

No Supabase project yet? The UI now auto-loads the curated `data/sample-games.json` dataset so everything renders immediately. Add real credentials later to swap in live data.

See `docs/setup.md` for more detailed guidance.

Supabase schema + migration workflow lives in `docs/data-pipeline.md`.

For artwork guidance, see [`docs/image-sourcing.md`](docs/image-sourcing.md) for vetted cover-image sources, seeding tips, and hosting best practices. The UI now falls back to Wikipedia box art when a record lacks a `cover` URL, but seeding explicit links keeps Supabase exports and offline mode deterministic.

## Price data (optional)

Want the Collection Value card and modal price panel to light up with real valuations?

1. Request a token from [PriceCharting](https://www.pricecharting.com/api) and add the following to `.env` (alongside your Supabase values):

   ```
   PRICECHARTING_TOKEN=your-token
   SUPABASE_SERVICE_ROLE_KEY=service-role-key
   # Optional overrides:
   # PRICECHARTING_BASE_URL=https://www.pricecharting.com/api
   # PRICECHARTING_REFRESH_HOURS=24
   ```

2. Run the ingestion helper to fetch the latest prices and upsert them into Supabase:

   ```bash
   npm run prices:update -- --limit 25
   ```

   Use `--filter "chrono trigger"` for targeted refreshes or `--dry-run` to verify credentials without writing. Snapshots land in the `game_price_snapshots` table (surfaceable via the `game_price_latest` view), and the client automatically consumes them without further configuration.

3. When Supabase or API credentials are unavailable, the UI falls back to `data/sample-price-history.json` so contributors can still see how the experience behaves.

### Automated refresh via GitHub Actions

Once your Supabase project and API token are configured, you can let GitHub keep valuations fresh automatically:

- Populate the `PRICECHARTING_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` secrets in your repository (optionally add `PRICECHARTING_REFRESH_HOURS` to fine-tune the minimum refresh window).
- The scheduled workflow at `.github/workflows/price-refresh.yml` runs twice per day (and can be triggered manually) to execute `npm run prices:update` with a default limit of 25 titles per run, persisting its progress in `data/pricecharting-cache.json` via the GitHub Actions cache.
- Use the manual `workflow_dispatch` inputs to override the limit, target games via substring filter, force a refresh regardless of cache age, or perform a dry run before enabling production secrets.

## Development

- `npm run lint` / `npm run lint:fix` – Run ESLint (with Prettier compat) across the main app file and build scripts.
- `npm run format:check` / `npm run format` – Validate or rewrite formatting for JS/JSON/Markdown/CSS/HTML files.
- `npm test` / `npm run test:watch` – Execute the Vitest suite (jsdom) that covers filter logic and table rendering.
- `npm run test:e2e` – Playwright smoke test that spins up a static server, forces the sample dataset, and verifies the modal workflow (run `npx playwright install --with-deps` once after cloning).

## Performance Instrumentation

- Rendering and data-load steps emit lightweight metrics. Inspect them via `window.__SANDGRAAL_PERF__.buffer` in DevTools.
- Enable verbose console logs by running `window.__SANDGRAAL_DEBUG_METRICS__ = true` in DevTools _before_ refreshing (or set it on `globalThis` in tests).
- Metrics currently captured: Supabase vs. sample data load times and every table re-render (search/filter, sort, share import, etc.) with row counts and sort state.
- The new virtualized grid windows cards in and out of the DOM (with spacer paddings) so the browse controls can request thousands of games without forcing the browser to mount every card at once.
- Supabase hydration now occurs via paginated `.range()` queries (default 400 rows). The first page renders immediately, while subsequent pages stream in when you approach the end of the list (or switch pages), keeping bandwidth predictable for huge libraries.
- Filter/search changes are executed server-side; the client only hydrates the rows returned by the Supabase query, which prevents runaway downloads for giant result sets.
- Collection status totals and aggregate widgets (top genres, release timeline) hydrate lazily from Supabase—only the rows tied to your Owned/Wishlist/Backlog/Trade entries or the required aggregates are fetched, so dashboard stats stay accurate without pulling the full games table.

## SEO & Discoverability

- The UI now emits JSON-LD `VideoGame` + `Review` structured data for the highest-rated titles as soon as the dataset loads, improving search result richness without manual exports.
- Generate an XML sitemap anytime you deploy by running `SITE_BASE_URL="https://yourdomain.example" npm run sitemap`. The script scans every HTML entry point (currently just `index.html`) and writes `sitemap.xml` at the repo root with fresh timestamps.
- Submit the generated sitemap to Google Search Console/Bing Webmaster Tools after each production deploy so crawlers pick up collection changes quickly.
- Use the new browse controls (or manually append `?view=paged&page=2&pageSize=60`) to expose crawlable, deterministic routes when you need static snapshots for SEO audits or content campaigns.

## Continuous Integration

All pull requests run through `.github/workflows/ci.yml`, which:

- Installs dependencies with `npm ci` on Node 20.
- Runs `npm run lint`, `npm run format:check`, and `npm test`.
- Executes a `gitleaks` scan to block accidental secret commits.
- Audits the built site with Lighthouse CI (`npm run lighthouse`), enforcing performance, accessibility, best-practices, and SEO thresholds.
- (optional future step) Add `npm run test:e2e` to the workflow when headless browsers are available in CI runners.

Keep these commands green locally before pushing to avoid CI failures.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup tips, coding standards, and the pull-request checklist.
