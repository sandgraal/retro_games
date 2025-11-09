# Retro Game Site

WIP: A fast, private, and no-nonsense tracker for classic and retro games. A place for retro gamers to get their fix.

**Features:**

- Instantly search, sort, and filter (platform, genre, status, rating, release-year range) a growing database of console classics
- Assign Owned/Wishlist/Backlog/Trade statuses (stored locally for privacy)
- Attach personal notes to every game—synced with share codes for easy collaboration
- One-click JSON backups to move statuses/notes/filters across devices
- Share your collection with anyone via code—no registration required
- See box art, details, and direct links to gameplay videos or GameFAQs
- Fully mobile and desktop compatible
- Supabase-powered typeahead search with a local fallback so you can jump to titles instantly

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

No Supabase project yet? The UI now auto-loads the curated `data/sample-games.json` dataset so everything renders immediately. Add real credentials later to swap in live data.

See `docs/setup.md` for more detailed guidance.

Supabase schema + migration workflow lives in `docs/data-pipeline.md`.

## Development

- `npm run lint` / `npm run lint:fix` – Run ESLint (with Prettier compat) across the main app file and build scripts.
- `npm run format:check` / `npm run format` – Validate or rewrite formatting for JS/JSON/Markdown/CSS/HTML files.
- `npm test` / `npm run test:watch` – Execute the Vitest suite (jsdom) that covers filter logic and table rendering.
- `npm run test:e2e` – Playwright smoke test that spins up a static server, forces the sample dataset, and verifies the modal workflow (run `npx playwright install --with-deps` once after cloning).

## SEO & Discoverability

- The UI now emits JSON-LD `VideoGame` + `Review` structured data for the highest-rated titles as soon as the dataset loads, improving search result richness without manual exports.
- Generate an XML sitemap anytime you deploy by running `SITE_BASE_URL="https://yourdomain.example" npm run sitemap`. The script scans every HTML entry point (currently just `index.html`) and writes `sitemap.xml` at the repo root with fresh timestamps.
- Submit the generated sitemap to Google Search Console/Bing Webmaster Tools after each production deploy so crawlers pick up collection changes quickly.

## Continuous Integration

All pull requests run through `.github/workflows/ci.yml`, which:

- Installs dependencies with `npm ci` on Node 20.
- Runs `npm run lint`, `npm run format:check`, and `npm test`.
- Executes a `gitleaks` scan to block accidental secret commits.
- (optional future step) Add `npm run test:e2e` to the workflow when headless browsers are available in CI runners.

Keep these commands green locally before pushing to avoid CI failures.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup tips, coding standards, and the pull-request checklist.
