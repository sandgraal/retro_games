# Data Pipeline & Backend Plan

This project now tracks its Supabase schema in `supabase/migrations/`. The initial migration (`20250107120000_init.sql`) creates normalized tables for:

- `platforms` – canonical platform list with `slug`, `manufacturer`, `release_year`.
- `genres` – normalized genre names.
- `games` – core metadata linked to `platforms`, including rating, release info, cover/detail URLs.
- `game_genres` – many-to-many join between games and genres.
- `game_media` – screenshot/box art URLs for use in the modal gallery.
- `user_game_notes` – placeholder table for future server-side statuses/notes once auth lands.
- `20250301100000_dashboard_aggregates.sql` layers on top with the `rpc_genre_counts` and `rpc_timeline_counts` helper functions. The frontend calls these RPCs (falling back to SQL group queries) to keep dashboard charts accurate without downloading the entire dataset.

## Workflow

1. Install Supabase CLI (`npm install -g supabase` or follow Supabase docs).
2. Authenticate and link your project (`supabase login`, `supabase link --project-ref <ref>`).
3. Apply migrations: `supabase db push` (dev) or `supabase db reset` (local Docker).
4. Validate migrations with `scripts/run-supabase-lint.sh` (wraps `supabase db lint` but gracefully skips if the `plpgsql_check` extension is unavailable on the target database).
5. Populate lookup tables and games via the seeding SQL generator: `npm run seed:generate` to produce `supabase/seed.sql`, then run `supabase db remote commit --file supabase/seed.sql` or `psql` against your instance.
6. Schedule backups via `.github/workflows/db-backup.yml` (requires `SUPABASE_DB_URL` secret); artifacts retain the latest dump.

## Next steps

- [x] Author CSV → SQL seeding utility that loads `games.csv` into `platforms`, `games`, `game_genres`, and `game_media` (`scripts/generate-seed-sql.js`).
- [x] Schedule automated backups (GitHub Action `.github/workflows/db-backup.yml`).
- [x] Document recovery playbook once backup automation is in place (`docs/recovery-playbook.md`).

Keep this document updated whenever schema/migration workflows change.

## Price data ingestion

PriceCharting valuations now feed the app via the `game_price_snapshots` table (and the `game_price_latest` view). Each row stores:

- `game_key` / `game_name` / `platform` – ties the snapshot back to the frontend compound key (`game_name___platform`).
- `product_id`, `product_name`, `console_name` – metadata returned by PriceCharting.
- `loose_price_cents`, `cib_price_cents`, `new_price_cents`, `currency` – integer cents for easy arithmetic.
- `source`, `snapshot_date`, `fetched_at`, `metadata` – auditing + optional extras (release date, raw payload).

Row Level Security allows public read access while inserts/deletes are restricted to the service role. The accompanying ingestion helper lives at `scripts/update-price-snapshots.js` and:

1. Reads `games.csv` to build a de-duped list of `game_name + platform`.
2. Uses the PriceCharting API (`PRICECHARTING_TOKEN`, optionally `PRICECHARTING_BASE_URL`) to fetch the latest price for the next stale title.
3. Writes/upserts a snapshot via Supabase REST (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) and keeps a local cache in `data/pricecharting-cache.json`.
4. Updates the fallback dataset `data/sample-price-history.json` so the UI still showcases the feature when Supabase credentials aren’t present.

Run it with:

```bash
PRICECHARTING_TOKEN=... SUPABASE_SERVICE_ROLE_KEY=... npm run prices:update -- --limit 25
```

Use `--filter "chrono trigger"` for targeted refreshes or `--dry-run` to validate credentials without writing. The scheduled GitHub Actions workflow described below now runs this utility regularly; fall back to the CLI when you need manual overrides or local debugging.

## Automated price refresh workflow

The repository ships `.github/workflows/price-refresh.yml`, which installs dependencies, restores the cached `data/pricecharting-cache.json`, and runs `npm run prices:update -- --limit 25` twice per day. Configure the `PRICECHARTING_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` secrets (plus optional `PRICECHARTING_REFRESH_HOURS`) in GitHub to enable the job. Trigger it manually when you need an ad-hoc update, override the default limit/filter via `workflow_dispatch` inputs, or pass `dry_run=true` to verify credentials without writing snapshots.
