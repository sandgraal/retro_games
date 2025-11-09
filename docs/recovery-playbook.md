# Recovery Playbook

## Backup sources

- **Automated dumps** – `.github/workflows/db-backup.yml` runs daily at 06:00 UTC (and on demand) using `pg_dump` against the `SUPABASE_DB_URL` secret. Artifacts are retained for seven days by default.
- **Manual export** – Run `npm run seed:generate` for a snapshot of static content or `pg_dump "$SUPABASE_DB_URL" > dump.sql` locally.

## Restoring Supabase

1. Download the desired `supabase-backup` artifact from the GitHub Actions run.
2. Ensure `SUPABASE_DB_URL` (or local Postgres connection string) points to the target instance.
3. Execute `psql "$SUPABASE_DB_URL" < supabase-dump.sql` to restore. For large datasets use `pg_restore` options as needed.
4. Re-run migrations (`supabase db push`) if new schema changes have landed since the dump.
5. Regenerate seed data if needed with `npm run seed:generate` followed by executing `supabase/seed.sql`.

## Rotating keys after incident

1. Run `node scripts/rotate-supabase-keys.js` to capture new anon/service keys in `.env` and GitHub secrets.
2. Redeploy config.js via `npm run build:config`.
3. In Supabase Dashboard, revoke old keys and audit API policies.

## Validation checklist post-restore

- [ ] `npm test` / `npm run test:e2e` pass locally pointing to restored DB (if possible via Supabase emulator).
- [ ] CI backup workflow succeeds with the new credentials.
- [ ] Frontend filters, gallery media, and collection exports function against the restored data.
- [ ] Update `docs/current-state.md` with any incidents or schema changes uncovered.

Keep this playbook updated whenever disaster-recovery procedures change.
