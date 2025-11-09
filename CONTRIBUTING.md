# Contributing Guide

Thanks for keeping Sandgraal's Retro Games list sharp. This document captures the essential steps to get set up, code safely, and ship reviews quickly.

## 1. Prerequisites

- Node.js 18+ and npm.
- Python (or any static server) for local preview.
- Supabase anon key + URL (optional while prototyping; fallback sample data is bundled).

## 2. Local setup

1. `git clone https://github.com/sandgraal/retro_games`
2. `cd retro_games && npm install`
3. Copy `.env.example` to `.env` and fill in Supabase credentials when available.
4. Generate `config.js` with `npm run build:config`.
5. Serve locally via `python -m http.server 8080` (or similar).

## 3. Coding standards

- **Formatting & linting**: Run `npm run format` + `npm run lint` before pushing. ESLint + Prettier enforce consistent style.
- **Types & docs**: Prefer JSDoc for new helpers (see `app.js`) and sync typedefs when changing schema.
- **State changes**: Keep localStorage keys backwards compatible; when adding new data shape, provide migration/fallback code and tests.
- **Security**: Never hardcode Supabase keys. Secrets must live in `.env` and enter via `config.js` build step. CI performs `gitleaks` scans.

## 4. Test workflow

- `npm test` (Vitest, jsdom) covers filtering, rendering, and helper logic.
- `npm run test:e2e` (Playwright) smoke-tests the modal, gallery, and controls. Run after major UI changes.
- `npm run lint` and `npm run format:check` must pass; CI blocks otherwise.

## 5. Pull request checklist

- [ ] Feature toggles/flags default to safe values.
- [ ] Updated docs (`README.md`, `docs/current-state.md`, plan checkboxes) to reflect new behavior.
- [ ] Added/updated tests for new logic (unit + e2e where applicable).
- [ ] Ran `npm run lint`, `npm run format:check`, `npm test`, `npm run test:e2e` (if UI change).
- [ ] Linked related issue/plan row in the PR description.

## 6. Review expectations

- Small PRs (<500 LOC) move fastest; split large changes into phases when possible.
- Highlight any data migrations or Supabase schema changes in the PR body.
- Include reproduction or verification steps so reviewers can validate fixes quickly.

Happy hacking!
