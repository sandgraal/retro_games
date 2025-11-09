# Retro Game Site

WIP: A fast, private, and no-nonsense tracker for classic and retro games. A place for retro gamers to get their fix.

**Features:**

- Instantly search, sort, and filter a growing database of console classics
- Mark games as “owned” (can be stored locally in your browser for privacy)
- Share your collection with anyone via code—no registration required
- See box art, details, and direct links to gameplay videos or GameFAQs
- Fully mobile and desktop compatible

This is not another bloated ROM launcher or subscription service.
It’s a clean, modern tool for serious collectors, archivists, and retro fans who want control over their library.

## Setup

1. Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key.
2. Install dependencies once with `npm install`, then run `npm run build:config` to generate `config.js` from your `.env`.
3. Serve the site locally with any static server, e.g. `python -m http.server 8080`.
4. Anytime you rotate credentials, update `.env` and rerun `npm run build:config`.

No Supabase project yet? The UI now auto-loads the curated `data/sample-games.json` dataset so everything renders immediately. Add real credentials later to swap in live data.

See `docs/setup.md` for more detailed guidance.

## Development

- `npm run lint` / `npm run lint:fix` – Run ESLint (with Prettier compat) across the main app file and build scripts.
- `npm run format:check` / `npm run format` – Validate or rewrite formatting for JS/JSON/Markdown/CSS/HTML files.
- `npm test` / `npm run test:watch` – Execute the Vitest suite (jsdom) that covers filter logic and table rendering.
- `npm run test:e2e` – Playwright smoke test that spins up a static server, forces the sample dataset, and verifies the modal workflow (run `npx playwright install --with-deps` once after cloning).

## Continuous Integration

All pull requests run through `.github/workflows/ci.yml`, which:

- Installs dependencies with `npm ci` on Node 20.
- Runs `npm run lint`, `npm run format:check`, and `npm test`.
- Executes a `gitleaks` scan to block accidental secret commits.
- (optional future step) Add `npm run test:e2e` to the workflow when headless browsers are available in CI runners.

Keep these commands green locally before pushing to avoid CI failures.
