# Copilot Instructions for AI Coding Agents

## Project Overview

**Retro Games List** is a privacy-first, single-page static web app for tracking classic and retro games. Key traits:

- No user registration; all data stays local by default
- Instant search/filter across thousands of games
- Collections are shareable via base64-encoded codes (not URLs or accounts)
- Vanilla JS/CSS/HTML; no build step or frameworks
- Optional Supabase backend for cloud data; gracefully falls back to local CSV

## Data Architecture

### Column Model (from games.csv and Supabase)

Game records use these columns (track these constants in `app.js`):

- `game_name`, `platform`, `genre`, `cover` (image URL), `rating`, plus flexible metadata (release year, region, player mode, etc.)
- Genre field stores comma-separated values for filtering (e.g., "RPG, Tactical RPG")
- Ratings parsed as floats for statistics

### Data Flow

1. **Load Phase**: `fetchGames()` attempts Supabase; if credentials missing, falls back to CSV
2. **Memory**: All games cached in `rawData` array (never re-fetched during session)
3. **Filters Applied**: `applyFilters()` chains platform/genre/search predicates, then applies owned-collection filter
4. **State Persistence**: User's owned games saved to `localStorage[STORAGE_KEY]` (JSON of `{gameKey: true, ...}`)
   - Game key format: `gameName___platformName` (compound key prevents duplicates across platforms)

### Dual View Modes

- **User's Collection**: Shows checkboxes for edit; localStorage persists choices
- **Imported Collection**: Read-only view of shared code's owned games; editing disabled

## File Responsibilities

| File                | Purpose                                          | Patterns                                                                                                                   |
| ------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `index.html`        | DOM scaffold, script/style loading               | Supabase JS loaded via CDN; `config.js` injected as `window.__SUPABASE_CONFIG__`                                           |
| `app.js`            | All logic: fetch, filter, render, modal, sharing | Long procedural file (~422 lines); global state (`rawData`, `owned`, `importedCollection`); event delegation on table rows |
| `config.example.js` | Supabase credentials template                    | Must be copied to `config.js` locally; `.gitignore` protects `config.js`                                                   |
| `games.csv`         | Fallback offline data                            | RFC 4180 CSV; quoted fields for commas in data                                                                             |
| `style.css`         | Retro arcade aesthetic                           | CSS variables for themes; responsive grid/table layouts                                                                    |

## Critical Patterns

### Filtering Logic (app.js ~line 100)

All three filters compose with AND logic:

- Platform filter (exact match on `COL_PLATFORM`)
- Genre filter (parses comma-separated genre field, checks inclusion)
- Search filter (case-insensitive substring across all object values)
- Owned filter (applied only if `importedCollection` or `owned` state exists)

Updates trigger full re-render + stats recalculation. No incremental updates.

### Table Rendering & Interaction (app.js ~line 130)

- Owned checkbox tied to `localStorage` save via `saveOwned()`
- Row click (except on checkbox/link) opens modal
- Row highlighting via CSS class `owned-row` for rows in current collection
- Modal built server-side (no innerHTML injection risk from data fields)

### Collection Sharing (app.js ~line 280)

- Export: Filtered `owned` games → CSV download with escaped quotes
- Share Code: `btoa(encodeURIComponent(ownedKeyArray.join("|")))`
- Import Code: Reverse: `atob()` → decode → split → populate `importedCollection` object
- **Note**: Codes grow large for big collections; no URL shortening implemented

### Modal & Accessibility (app.js ~line 340)

- External links constructed from game data (Google, YouTube, GameFAQs searches)
- Focus trap inside modal; ESC key closes
- Image alt text auto-generated from cover field
- Close button and background click both dismiss

## Build, Test, and Development Commands

### Essential Commands

Before making changes, always run these commands to understand the baseline:

```bash
npm install              # Install dependencies (run once after clone)
npm run lint             # Check code style and common errors
npm run format:check     # Verify code formatting
npm test                 # Run unit tests (Vitest)
npm run test:e2e         # Run end-to-end tests (Playwright)
npm run build:config     # Generate config.js from .env
```

### Development Workflow

```bash
# 1. Start local development server
python -m http.server 8080    # Or any static server

# 2. Make changes, then validate frequently
npm run lint:fix              # Auto-fix linting issues
npm run format                # Auto-format code
npm test                      # Verify unit tests pass
npm run test:e2e              # Verify e2e tests pass (after UI changes)

# 3. Before committing
npm run lint && npm run format:check && npm test
```

### Test Creation Guidelines

- **Unit tests** (Vitest): Cover filtering logic, data transformations, helper functions
  - Located in `tests/*.test.js`
  - Use jsdom for DOM testing
  - Mock Supabase calls to avoid external dependencies
- **E2E tests** (Playwright): Cover user workflows, modal interactions, navigation
  - Located in `tests/*.spec.js`
  - Test against sample data (not live Supabase)
  - Verify accessibility and keyboard navigation
- Always add tests for new features; update tests when changing behavior
- Maintain test coverage for critical paths (search, filter, modal, collection management)

## Setup & Debugging

**First-Time Setup:**

```bash
npm install
cp .env.example .env
# Edit .env with Supabase URL + anonKey (optional for development)
npm run build:config     # Generate config.js from .env
python -m http.server 8080
# Open http://localhost:8080
```

**Offline Development:**
To test without Supabase:

1. Comment out `fetchGames()` call in app.js tail
2. Manually populate `rawData` with parsed CSV or mock data
3. Supabase fallback warning will appear but app loads from CSV

**Debugging Checklist:**

- Console for "Supabase credentials missing" warning
- `owned` object structure: `{"Chrono Trigger___SNES": true, ...}`
- `importedCollection` is `null` unless viewing shared code
- Stats reflect _filtered_ data, not all data
- Check row key generation: `gameName___platformName` with triple underscore

## Conventions & Anti-Patterns

✅ **DO:**

- Preserve offline-first design; cloud is optional enhancement
- Handle missing/malformed data gracefully (null coalescing, empty string checks)
- Use compound game keys (`game___platform`) for ownership tracking to prevent collisions
- Keep CSS minimal; use CSS variables (defined in `:root`) for theming
- Maintain vanilla JS/HTML/CSS stack
- Run linters and tests before every commit
- Write tests for new features and bug fixes
- Document complex logic with JSDoc comments
- Use existing constants and avoid magic strings/numbers

❌ **DON'T:**

- Commit `config.js` with real credentials (`.gitignore` protects it)
- Add npm/build tooling without consensus; no bundlers or transpilers
- Store user data server-side without explicit opt-in
- Use innerHTML for dynamic content from Supabase fields
- Refactor table/modal into components without considering backward compatibility
- Skip tests or remove existing tests
- Commit unformatted code (run `npm run format` first)
- Add external dependencies without justification

## CI/CD Pipeline

All pull requests must pass these checks (enforced by `.github/workflows/ci.yml`):

1. **Linting**: `npm run lint` - ESLint with Prettier compatibility
2. **Formatting**: `npm run format:check` - Prettier formatting validation
3. **Unit Tests**: `npm test` - Vitest test suite
4. **Security Scan**: `gitleaks` - Prevents accidental secret commits
5. **Lighthouse CI**: Performance, accessibility, SEO, and best practices audits

Before pushing changes:

- Ensure all commands pass locally
- Fix any linting or formatting issues with `npm run lint:fix` and `npm run format`
- Add or update tests as needed
- Verify no secrets are committed (check `.env` vs `.env.example`)

## Security Guidelines

### Secret Management

- **NEVER** commit real Supabase credentials or API tokens
- Use `.env` for local secrets (gitignored)
- Use `.env.example` as a template (committed)
- `config.js` is generated from `.env` via `npm run build:config`
- CI uses GitHub Secrets for automated workflows

### Common Security Pitfalls

- Don't use `innerHTML` with user-generated or Supabase content (XSS risk)
- Validate and sanitize all input before storing in localStorage
- Escape CSV content when exporting collections
- Use `textContent` or `createElement` for dynamic DOM updates
- Supabase RLS policies protect server-side data; client-side code assumes anon key exposure

### Dependency Security

- Run `npm audit` periodically to check for vulnerabilities
- Review dependency changes in PRs carefully
- Prefer minimal, well-maintained libraries
- The gitleaks CI check blocks secret commits

## Common Pitfalls & Troubleshooting

### Issue: "Supabase credentials missing" warning

- **Cause**: No `.env` file or missing `SUPABASE_URL`/`SUPABASE_ANON_KEY`
- **Solution**: Copy `.env.example` to `.env` and add credentials, or continue with sample data
- **Expected**: App gracefully falls back to `data/sample-games.json`

### Issue: Tests fail with "window is not defined"

- **Cause**: Missing jsdom setup in test file
- **Solution**: Check that test imports from `tests/app.test.js` properly setup jsdom environment

### Issue: E2E tests timeout

- **Cause**: Static server not running or page not loading
- **Solution**: Verify `npm run serve:lighthouse` works, check Playwright config

### Issue: Linting errors after code changes

- **Cause**: Code doesn't follow ESLint/Prettier rules
- **Solution**: Run `npm run lint:fix` and `npm run format`

### Issue: Build config fails

- **Cause**: Malformed `.env` file
- **Solution**: Compare `.env` structure with `.env.example`, ensure proper key=value format

## Roadmap & Documentation

Per `docs/implementation-plan.md`, this project follows a phased development approach.

**Key Documentation Files:**

- `docs/current-state.md` - Current feature status and architecture decisions
- `docs/implementation-plan.md` - Roadmap and future features
- `docs/data-pipeline.md` - Supabase schema and data flow
- `docs/setup.md` - Detailed setup instructions
- `CONTRIBUTING.md` - Contributor guidelines and PR checklist

For questions about unclear patterns, review these docs, then ask the user for clarification before proceeding.

## Working with Copilot

When assigned an issue:

1. **Understand the scope**: Read issue description, acceptance criteria, and linked docs
2. **Explore the codebase**: Review relevant files and understand existing patterns
3. **Run baseline tests**: Verify current state with `npm run lint && npm test`
4. **Make minimal changes**: Focus on solving the specific issue without refactoring
5. **Add/update tests**: Ensure new behavior is covered
6. **Validate thoroughly**: Run all checks before creating PR
7. **Document changes**: Update relevant docs if behavior or setup changes

**Best suited for Copilot:**

- Bug fixes with clear reproduction steps
- Adding tests for existing functionality
- Small feature additions that follow existing patterns
- Documentation updates
- Code formatting and linting fixes

**Not ideal for Copilot:**

- Large architectural refactors
- Security-sensitive authentication changes
- Complex Supabase schema migrations
- Features requiring UX/design decisions
