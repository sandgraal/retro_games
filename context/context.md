# Repository Context Snapshot (2024-06)

## project_summary

- Static web application that lists retro video games with filtering, ownership tracking via `localStorage`, and modal detail views.
- Data is expected from a Supabase table named `games`; a large `games.csv` is committed as a reference dataset.
- UI is a single-page experience built with vanilla HTML/CSS/JS and external fonts/icons.

## dependency_graph

- **Frontend runtime**: Browser + vanilla JavaScript.
- **External services**: Supabase (REST over `supabase-js` CDN).
- **Assets**: Google Fonts ("Press Start 2P"), remote cover art URLs stored in Supabase/CSV.
- **Tooling**: None bundled; development uses ad-hoc static servers.

## commands_map

- **Develop**: `python -m http.server 8080` (or any static server) from repo root.
- **Build**: Not required; assets served as-is.
- **Test/Lint**: `npm run lint`, `npm run format:check`, `npm test`, and `npm run lighthouse` (via Lighthouse CI).
- **Data maintenance**: Update Supabase `games` table (optionally regenerate `games.csv`).

## key_paths_by_feature

- `index.html` – page shell, filter controls, and script/style includes.
- `style.css` – comprehensive styling for desktop/mobile layouts and modal UI.
- `app.js` – Supabase integration, table rendering, ownership tracking, share/import logic, modal interactions.
- `games.csv` – canonical list of retro games used to seed/update Supabase.
- `.github/ISSUE_TEMPLATE/` – templates for bug reports and feature requests.

## known_constraints_and_feature_flags

- No authentication or authorization; ownership data stays local to the browser unless exported/imported manually.
- Data schema is implicit—column names derived from Supabase response, so schema changes require updating both Supabase and frontend constants.
- No bundler or modularization; large single JS/CSS files can become hard to maintain as features grow.
- Accessibility relies on manual DOM management; modal focus handling exists but lacks automated testing.
