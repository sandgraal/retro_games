# Local Development Setup

Use this guide to configure Supabase credentials without committing secrets.

## Prerequisites

- Node.js 20.19+ and npm.
- Supabase project URL and anon key with access to the `games_consolidated` view.

## 1. Install dependencies

```bash
npm install
```

## 2. Create your `.env`

```bash
cp .env.example .env
```

Edit `.env` and provide:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=anon-key
# The client queries the `games_consolidated` view for game data.
# Optional streaming/aggregate overrides
# SUPABASE_STREAM_PAGE_SIZE=400
# SUPABASE_RPC_GENRES=rpc_genre_counts
# SUPABASE_RPC_TIMELINE=rpc_timeline_counts
# Optional PriceCharting integration (leave unset to disable)
# PRICECHARTING_TOKEN=your-api-token
# PRICECHARTING_CURRENCY=USD
# PRICECHARTING_CACHE_HOURS=12
```

## 3. Generate `config.js`

```bash
npm run build:config
```

The script reads `.env` and writes `config.js` (already gitignored). Re-run this command anytime you rotate Supabase credentials.

### Optional flags

You can point to alternative files if needed:

```bash
node scripts/generate-config.js --env .env.staging --out public/config.js
```

## 4. Run the site

Preferred: Vite dev server with HMR

```bash
npm run dev
```

Opens `http://localhost:3000`. For a production build preview:

```bash
npm run build && npm run preview
```

### Instant demo mode

If Supabase credentials are missing or the fetch fails, the app automatically falls back to `data/sample-games.json` and surfaces the reason in an info banner. This guarantees that first-time contributors still see a populated UI while backend access is being configured.
Append `?sample=1` to the URL (or set `window.__SANDGRAAL_FORCE_SAMPLE__ = true` before loading) to force the sample dataset even when real credentials are present—useful for demos and automated testing.

## Price data (optional)

1. Add the PriceCharting token and Supabase service-role key to `.env`:

   ```
   PRICECHARTING_TOKEN=your-token
   SUPABASE_SERVICE_ROLE_KEY=service-role-key
   # Optional:
   # PRICECHARTING_BASE_URL=https://www.pricecharting.com/api
   # PRICECHARTING_REFRESH_HOURS=24
   ```

2. Fetch valuations and upsert them into Supabase:

   ```bash
   npm run prices:update -- --limit 25
   ```

   Use `--filter "mario"` for targeted runs or `--dry-run` to verify credentials without writes. Snapshots populate the `game_price_snapshots` table / `game_price_latest` view automatically consumed by the frontend.

## Troubleshooting

- **Missing .env** – The generator will exit with instructions if `.env` is not found. Copy `.env.example` and try again.
- **Undefined variables** – Ensure both `SUPABASE_URL` and `SUPABASE_ANON_KEY` are present and do not contain quotes.
- **Stale config** – Delete `config.js` and rerun `npm run build:config` after updating `.env`.

## Quality checks

- `npm run lint` / `npm run lint:fix` keep the JavaScript consistent with ESLint + Prettier rules.
- `npm run format:check` / `npm run format` verify or apply Prettier formatting across JS/JSON/Markdown/CSS/HTML files.
- `npm test` / `npm run test:watch` run the Vitest suite (jsdom) for core filter/render behavior.
- `npm run test:e2e` launches Playwright against a static server (ensure you run `npx playwright install --with-deps` once).
