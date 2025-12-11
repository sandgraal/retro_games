# Operations & Runbooks

## Environment variables

| Variable                                              | Purpose                                                                                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`                   | Frontend + scripts connect to Supabase for catalog + price views. Required when serving live data.                                 |
| `SUPABASE_SERVICE_ROLE_KEY`                           | Enables price snapshot inserts from `scripts/update-ebay-prices.js` and variant price upserts. Omit to run in read-only/demo mode. |
| `SUPABASE_JWT_SECRET`                                 | Lets the catalog ingest service validate contributor roles when Supabase Auth is enabled.                                          |
| `SUPABASE_STORAGE_*_BUCKET`                           | Bucket names for public/auth/archive/pending media used by moderation decisions.                                                   |
| `EBAY_APP_ID`, `EBAY_GLOBAL_ID`, `EBAY_REFRESH_HOURS` | Credentials + cadence for the pricing fetcher. `EBAY_REFRESH_HOURS` controls staleness before a refresh.                           |
| `DOTENV_PRIVATE_KEY`                                  | Needed in CI to decrypt `.env` when generating `config.js`.                                                                        |
| `CATALOG_DATA_DIR`                                    | Override where catalog snapshots/metrics land when running the ingest worker.                                                      |

## Scheduled jobs / cron

- **Price refresh (GitHub Actions)**: `.github/workflows/price-refresh.yml` runs `npm run prices:update -- --limit 25` twice daily. Configure `EBAY_APP_ID`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; adjust `EBAY_REFRESH_HOURS` to throttle API usage. Use the workflow dispatch inputs to change `limit`, `filter`, or `dry_run` during incidents.
- **Database backups**: `.github/workflows/db-backup.yml` captures `pg_dump` artifacts daily at 06:00 UTC using `SUPABASE_DB_URL` and retains the last 30 days.
- **Catalog ingest**: run `npm run ingest:catalog` locally or via a scheduler. The `scheduleMinutes` field in `services/catalog-ingest/config.example.json` controls cadence when the worker is kept warm with `--serve`.

## Runbooks

### Retry or backfill a failed run

1. Pricing: rerun `npm run prices:update -- --limit 10 --force` to refresh the stalest titles, or pass `--filter "chrono trigger"` for a targeted retry. Keep `EBAY_REFRESH_HOURS` high (e.g., 48) to avoid excessive calls after an incident.
2. Catalog ingest: run `node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.example.json --once` after verifying the source URLs and auth headers. Inspect `data/ingestion-log.json` for the last run summary.

### Handling rate limits

- Raise `EBAY_REFRESH_HOURS` to reduce how often titles are revisited, and lower `--limit` in manual runs. The script already waits between requests; avoid parallelizing it.
- For ingest sources with quotas, set per-source headers/tokens in the config file and increase `scheduleMinutes` so sources have time to reset.

### Rollback and validation

1. Restore the latest Supabase dump following `docs/recovery-playbook.md` if a pricing or ingest job corrupts data.
2. Regenerate `config.js` with `npm run build:config` so clients pick up rotated keys.
3. Verify with `npm test` (or a smoke Playwright run) pointing to the restored backend, then confirm the UI loads catalog + price data without forcing the sample dataset.
