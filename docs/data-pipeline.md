# Data Pipeline & Backend Plan

This project now tracks its Supabase schema in `supabase/migrations/`. The initial migration (`20250107120000_init.sql`) creates normalized tables for:

- `platforms` – canonical platform list with `slug`, `manufacturer`, `release_year`.
- `genres` – normalized genre names.
- `games` – core metadata linked to `platforms`, including rating, release info, cover/detail URLs.
- `game_genres` – many-to-many join between games and genres.
- `game_media` – screenshot/box art URLs for use in the modal gallery.
- `user_game_notes` – placeholder table for future server-side statuses/notes once auth lands.

## Workflow

1. Install Supabase CLI (`npm install -g supabase` or follow Supabase docs).
2. Authenticate and link your project (`supabase login`, `supabase link --project-ref <ref>`).
3. Apply migrations: `supabase db push` (dev) or `supabase db reset` (local Docker).
4. Populate lookup tables and games via the seeding SQL generator: `npm run seed:generate` to produce `supabase/seed.sql`, then run `supabase db remote commit --file supabase/seed.sql` or `psql` against your instance.
5. Schedule backups via `.github/workflows/db-backup.yml` (requires `SUPABASE_DB_URL` secret); artifacts retain the latest dump.

## Next steps

- [x] Author CSV → SQL seeding utility that loads `games.csv` into `platforms`, `games`, `game_genres`, and `game_media` (`scripts/generate-seed-sql.js`).
- [x] Schedule automated backups (GitHub Action `.github/workflows/db-backup.yml`).
- [x] Document recovery playbook once backup automation is in place (`docs/recovery-playbook.md`).

Keep this document updated whenever schema/migration workflows change.
