# Copilot Instructions for AI Coding Agents

## Project Overview

**Retro Games List** is a privacy-first, single-page static web app for tracking classic and retro games with a museum-quality interface. Key traits:

- No user registration; all data stays local by default
- Museum-quality design with glassmorphism, masonry grid, PS2-era aesthetic
- Modular ES6 architecture with design tokens and component system
- Instant search/filter across thousands of games
- Collections shareable via base64-encoded codes (not URLs or accounts)
- Vanilla JS/CSS/HTML; no build step or frameworks
- Optional Supabase backend for cloud data; gracefully falls back to sample JSON

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

| File                      | Purpose                          | Patterns                                                                                     |
| ------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `index.html`              | DOM scaffold, semantic structure | Hero dashboard, masonry grid, filters sidebar, mobile nav; Supabase JS loaded via CDN        |
| `app/main-redesign.js`    | Application bootstrap            | Loads data (Supabase → sample JSON fallback), initializes UI modules, sets up event handlers |
| `app/ui/dashboard-new.js` | Dashboard stats & rendering      | `calculateStats()`, `updateDashboard()`, `animateNumber()` - 6 stat cards with animations    |
| `app/ui/grid-new.js`      | Game grid rendering              | `renderGrid()`, `createGameCard()`, masonry layout, quick actions, loading skeletons         |
| `app/utils/*.js`          | Utility functions                | DOM helpers, formatting, game key generation (`gameName___platformName`)                     |
| `style.css`               | Master stylesheet                | Imports modular CSS from `style/` directory                                                  |
| `style/tokens.css`        | Design system tokens             | CSS custom properties: colors, typography, spacing, shadows, animations                      |
| `style/components/*.css`  | Component styles                 | Dashboard, grid, filters, modal, cards - all glassmorphism & PS2 aesthetic                   |
| `config.js`               | Supabase credentials             | Generated from `.env` via `npm run build:config`; `.gitignore` protects it                   |
| `data/sample-games.json`  | Fallback offline data            | Full JSON dataset when Supabase unavailable                                                  |

## Critical Patterns

### Data Loading & Bootstrap (app/main-redesign.js)

1. Load localStorage state (`roms_owned`, `rom_notes`, `roms_wishlist`, etc.)
2. Try Supabase connection with `window.__SUPABASE_CONFIG__`
3. Fallback to `data/sample-games.json` if Supabase unavailable
4. Store data in `window.__GAMES_DATA__` for filter operations
5. Calculate stats and render dashboard
6. Setup filters with platform/genre options
7. Render grid with masonry layout
8. Setup event handlers

### Filtering Logic (app/main-redesign.js ~line 180)

All filters compose with AND logic:

- Platform filter (checkbox selection, exact match)
- Genre filter (checkbox selection, checks comma-separated genre field)
- Search filter (case-insensitive substring across all game fields)
- Status filter (owned/wishlist/backlog/trade from localStorage)
- Sort options (name, rating, year, value)

Updates trigger full grid re-render. Debounced search (300ms).

### Grid Rendering (app/ui/grid-new.js)

- `renderGrid(games, owned, statuses)` - Main rendering function
- `createGameCard(game, gameKey, owned, statuses)` - Individual card creation
- Cards show cover art, title, platform, hover overlay with quick actions
- Status badges (Owned, Wishlist, etc.) shown on cards
- Click card → dispatch `openGameModal` event (to be wired)
- Quick action buttons → dispatch `gameStatusChange` event → update localStorage

### Dashboard Stats (app/ui/dashboard-new.js)

- `calculateStats(games, owned, statuses)` - Compute metrics from game data
- `updateDashboard(stats)` - Render 6 stat cards with animated numbers
- `animateNumber(element, start, end, duration)` - Count-up animation
- Stats: Total Games, Owned, Wishlist, Backlog, Trade, Completion %
- Progress bars for Owned and Backlog cards

### State Persistence

- `localStorage[STORAGE_KEY]` - `roms_owned` JSON object `{gameKey: true}`
- Game key format: `gameName___platformName` (triple underscore)
- Other keys: `rom_notes`, `roms_wishlist`, `roms_backlog`, `roms_trade`
- Events dispatch `gameStatusChange` with `{gameKey, action}` details
- Listeners update localStorage and refresh UI

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
