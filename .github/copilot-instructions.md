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

**Design System (December 2025):**

- Color Palette: Museum darks (#0a0e14, #14181f, #1a1f29), PS2 cyan (#00d4ff)
- Typography: Rajdhani (display), Inter (body), Space Mono (monospace)
- Layout: Hero dashboard → Masonry grid → Filters sidebar → Mobile nav
- Effects: Glassmorphism, smooth animations, micro-interactions

## Data Architecture

### Column Model (from games.csv and Supabase)

Game records use these columns (track these constants in `app/main.js`):

- `game_name`, `platform`, `genre`, `cover` (image URL), `rating`, plus flexible metadata (release year, region, player mode, etc.)
- Genre field stores comma-separated values for filtering (e.g., "RPG, Tactical RPG")
- Ratings parsed as floats for statistics

### Data Flow

1. **Load Phase**: `bootstrapNewUI()` in `app/main.js` attempts Supabase; if credentials missing, falls back to `data/sample-games.json`
2. **Memory**: All games cached in `window.__GAMES_DATA__` array (never re-fetched during session)
3. **Filters Applied**: `applyFilters()` chains platform/genre/search predicates, then applies owned-collection filter
4. **State Persistence**: User's owned games saved to `localStorage[STORAGE_KEY]` (JSON of `{gameKey: true, ...}`)
   - Game key format: `gameName___platformName` (compound key prevents duplicates across platforms)

### Dual View Modes

- **User's Collection**: Shows checkboxes for edit; localStorage persists choices
- **Imported Collection**: Read-only view of shared code's owned games; editing disabled

## File Responsibilities

**Module Architecture (January 2025):** 27 ES6 modules across 6 directories with 488 tests.

### Core Files

| File                     | Purpose                           | Patterns                                                                                      |
| ------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `index.html`             | DOM scaffold, semantic structure  | Hero dashboard, masonry grid, filters sidebar, mobile nav; Supabase JS loaded via CDN         |
| `app/main.js`            | Application bootstrap (456 lines) | Loads data, initializes UI modules, sets up event handlers. Modal at line 447 is placeholder. |
| `config.js`              | Supabase credentials              | Generated from `.env` via `npm run build:config`; `.gitignore` protects it                    |
| `data/sample-games.json` | Fallback offline data             | Full JSON dataset when Supabase unavailable                                                   |
| `archive/app-legacy.js`  | Legacy monolithic code            | 5,940-line original app.js - archived for reference only                                      |

### UI Modules (`app/ui/` - 6 modules, 1,989 lines)

| File                  | Lines | Purpose                        | Key Exports                                                                                         |
| --------------------- | ----- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `app/ui/dashboard.js` | 493   | Dashboard stats & calculations | `calculateAverageRating()`, `countPlatforms()`, `calculatePlatformBreakdown()`, `getTopPlatforms()` |
| `app/ui/grid.js`      | 453   | Game grid rendering helpers    | `normalizeCoverUrl()`, `resolveCoverUrl()`, `STATUS_CLASSES`, `STATUS_DISPLAY_LABELS`, placeholders |
| `app/ui/carousel.js`  | 313   | Carousel scroll calculations   | `calculateScrollStep()`, `computeButtonStates()`, trending pick helpers, ARIA helpers               |
| `app/ui/theme.js`     | 259   | Theme & motion preferences     | `getPreferredTheme()`, `applyThemeChoice()`, `prefersReducedMotion()`, motion preference helpers    |
| `app/ui/modal.js`     | 240   | Modal metadata helpers         | `buildMetadataCard()`, `calculateGalleryIndex()`, focus trap helpers (TODO: wire to grid)           |
| `app/ui/filters.js`   | 232   | Filter UI builders             | `extractUniquePlatforms()`, `extractUniqueGenres()`, `buildSelectOptions()`, dropdown builders      |

### Feature Modules (`app/features/` - 6 modules, 1,646 lines)

| File                             | Lines | Purpose                   | Key Exports                                                                                    |
| -------------------------------- | ----- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| `app/features/virtualization.js` | 371   | Virtual scrolling helpers | `computeVirtualWindow()`, `updateVirtualScrollState()`, `VIRTUALIZE_MIN_ITEMS`, scroll helpers |
| `app/features/filtering.js`      | 342   | Filter predicates         | `rowMatchesPlatform()`, `rowMatchesGenre()`, `rowMatchesStatus()`, `detectRegion()`            |
| `app/features/search.js`         | 282   | Search & typeahead        | `normalizeSearchQuery()`, `scoreSearchMatch()`, `buildSearchPredicate()`, typeahead constants  |
| `app/features/pagination.js`     | 220   | Pagination calculations   | `computePageRange()`, `computePageWindowRange()`, `PAGE_SIZE_CHOICES`, page size constants     |
| `app/features/sharing.js`        | 219   | Share codes & export      | `encodeSharePayload()`, `decodeSharePayload()`, `buildBackupPayload()`, CSV export helpers     |
| `app/features/sorting.js`        | 212   | Sort comparators          | `buildSortComparator()`, `parseSortConfig()`, `SORT_OPTIONS`, column constants                 |

### State Modules (`app/state/` - 4 modules, 829 lines)

| File                       | Lines | Purpose                 | Key Exports                                                                                   |
| -------------------------- | ----- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `app/state/filters.js`     | 239   | Filter state & defaults | `FILTER_STORAGE_KEY`, column constants (`COL_GAME`, `COL_PLATFORM`, etc.), filter defaults    |
| `app/state/preferences.js` | 218   | User preferences        | `getStoredThemeChoice()`, `persistThemeChoice()`, browse preference helpers                   |
| `app/state/collection.js`  | 190   | Owned/wishlist state    | `STORAGE_KEY`, status constants (`STATUS_OWNED`, `STATUS_WISHLIST`, etc.), collection helpers |
| `app/state/cache.js`       | 182   | Cover URL caching       | `getCoverCacheStorage()`, `FALLBACK_COVER_CACHE_KEY`, cache TTL helpers                       |

### Data Modules (`app/data/` - 5 modules, 721 lines)

| File                     | Lines | Purpose                   | Key Exports                                                                                  |
| ------------------------ | ----- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `app/data/pricing.js`    | 263   | Price normalization       | `normalizePriceValue()`, `selectStatusPrice()`, `resolvePriceValue()`, `formatPriceValue()`  |
| `app/data/loader.js`     | 184   | Data loading & processing | `applySupabaseFilters()`, `computeRegionCodes()`, `normalizeIncomingRows()`, `buildRowKey()` |
| `app/data/aggregates.js` | 163   | Stats aggregates          | `computeLocalGenreAggregates()`, `computeLocalTimelineSeries()`, RPC response parsers        |
| `app/data/supabase.js`   | 70    | Supabase client config    | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, table/bucket constants                                  |
| `app/data/storage.js`    | 41    | Storage URL helpers       | `normalizeImageUrl()`, `buildStoragePublicUrl()`, `normalizeCoverUrl()`                      |

### Utility Modules (`app/utils/` - 4 modules, 262 lines)

| File                      | Lines | Purpose             | Key Exports                                                                                     |
| ------------------------- | ----- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `app/utils/format.js`     | 162   | Formatting helpers  | `formatCurrency()`, `formatNumber()`, `formatRating()`, `formatPercent()`, `formatFieldLabel()` |
| `app/utils/validation.js` | 46    | Input validation    | `parseYear()`, `parseRating()`, `sanitizeForId()`, `isValidTheme()`                             |
| `app/utils/keys.js`       | 30    | Game key generation | `generateGameKey()`, `parseGameKey()`                                                           |
| `app/utils/dom.js`        | 24    | DOM utilities       | `escapeHtml()`                                                                                  |

### Design & Style Files

| File                     | Purpose                     | Patterns                                                                   |
| ------------------------ | --------------------------- | -------------------------------------------------------------------------- |
| `app/design/tokens.js`   | Design tokens in JavaScript | JS constants matching CSS custom properties (127 lines)                    |
| `style.css`              | Master stylesheet           | Imports modular CSS from `style/` directory                                |
| `style/tokens.css`       | Design system tokens        | CSS custom properties: colors, typography, spacing, shadows, animations    |
| `style/base.css`         | Base styles                 | Typography, reset, global element styles                                   |
| `style/utilities.css`    | Utility classes             | Layout helpers, spacing, typography utilities                              |
| `style/components/*.css` | Component styles            | Dashboard, grid, filters, modal, cards - all glassmorphism & PS2 aesthetic |

## Critical Patterns

### Data Loading & Bootstrap (app/main.js)

The `bootstrapNewUI()` function coordinates application startup:

1. Show loading skeletons immediately (`showLoadingSkeletons()`)
2. Load localStorage state (`roms_owned`, `rom_notes`, `roms_wishlist`, `roms_backlog`, `roms_trade`)
3. Try Supabase connection with `window.__SUPABASE_CONFIG__`
   - Create Supabase client if credentials available
   - Query `games` table with `select("*").order("game_name", { ascending: true })`
4. Fallback to `data/sample-games.json` if Supabase unavailable or errors
5. Store data in global variables:
   - `window.__GAMES_DATA__` - All games array
   - `window.__OWNED_DATA__` - Owned games object
   - `window.__STATUSES_DATA__` - Wishlist/backlog/trade objects
   - `window.__NOTES_DATA__` - Game notes object
6. Calculate stats with `calculateStats(games, owned, statuses)`
7. Render dashboard with `updateDashboard(stats)`
8. Setup filters with `setupFilters(games)` - populate platform/genre options
9. Render grid with `renderGrid(games, owned, statuses)`
10. Setup event handlers:
    - `setupQuickActions()` - Quick action buttons on cards
    - `setupFilterHandlers()` - Filter change listeners
    - `setupMobileNavigation()` - Mobile nav toggle
11. Show status message if using sample data

### Filtering Logic (app/main.js)

The `applyFilters()` function chains predicates with AND logic:

1. **Platform filter**: Checkbox selection, exact match on `game.platform`
2. **Genre filter**: Checkbox selection, checks comma-separated `game.genre` field
3. **Search filter**: Case-insensitive substring match across `game_name`, `platform`, `genre`, and other fields
4. **Status filter**: Matches owned/wishlist/backlog/trade from localStorage
5. **Sort options**: Name (alphabetical), rating (numeric), year, value

Filter changes trigger `applyFilters()` → `renderGrid()` for full re-render. Search input is debounced (300ms).

**Key functions:**

- `setupFilters(games)` - Populate filter options from game data
- `setupFilterHandlers()` - Attach event listeners to filter inputs
- `applyFilters()` - Chain filter predicates and return filtered array
- `renderGrid(filteredGames, owned, statuses)` - Re-render grid with filtered data

### Grid Rendering (app/ui/grid.js)

- `renderGrid(games, owned, statuses)` - Main rendering function, clears grid and renders all cards
- `createGameCard(game, gameKey, owned, statuses, index)` - Individual card creation with proper ARIA
- `showLoadingSkeletons()` - Display skeleton cards during data load
- `renderEmptyState(gridElement)` - Show message when no games match filters
- `animateCards()` - Stagger animation for card entrance
- `getGameStatus(gameKey, owned, statuses)` - Determine status badge (owned/wishlist/backlog/trade)
- `renderQuickActions(gameKey, status)` - Generate quick action buttons based on status

**Card Structure:**

- Cover image with lazy loading
- Status badge overlay (if applicable)
- Hover overlay with title, platform, rating, genre
- Quick action buttons (Add to Collection, Wishlist, etc.)
- Click card → `openGameModal(game, gameKey)` (TODO: wire modal)
- Quick actions → dispatch `gameStatusChange` event → update localStorage

### Dashboard Stats (app/ui/dashboard.js)

- `calculateStats(games, owned, statuses)` - Compute metrics from game data (total, owned, wishlist, backlog, trade counts, platform breakdown, collection value, recent additions)
- `updateDashboard(stats)` - Render 6 stat cards with animated numbers
- `updateOwnedCard(stats)` - Owned games count with platform breakdown and progress bar
- `updateValueCard(stats)` - Collection value with trend indicator
- `updateRecentAdditionsCard(stats)` - Recent additions count with carousel
- `updateWishlistCard(stats)` - Wishlist count and details
- `updateBacklogCard(stats)` - Backlog count with progress bar
- `animateNumber(element, start, end, duration)` - Count-up animation with easing

**Dashboard Cards:**

1. **Total Games** - Database total count
2. **Owned** - User's collection with platform breakdown and % of total
3. **Collection Value** - Estimated value with trend indicator
4. **Recent Additions** - Latest 5 games with cover carousel
5. **Wishlist** - Games to acquire
6. **Backlog** - Games to play with progress tracking

### State Persistence

- `localStorage[STORAGE_KEY]` - `roms_owned` JSON object `{gameKey: true}`
- Game key format: `gameName___platformName` (triple underscore) - generated by `generateGameKey()` in `app/utils/keys.js`
- Other keys: `rom_notes`, `roms_wishlist`, `roms_backlog`, `roms_trade`
- Events dispatch `gameStatusChange` with `{gameKey, action}` details
- Listeners update localStorage and refresh UI
- Compound keys prevent collisions across platforms (e.g., "Final Fantasy VII**_PS1" vs "Final Fantasy VII_**PC")

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

1. Remove or leave empty `.env` file (Supabase credentials missing)
2. App automatically falls back to `data/sample-games.json`
3. Status message appears: "Showing sample dataset. Configure Supabase for cloud sync."

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
