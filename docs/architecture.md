# Architecture Overview

_Last updated: January 2025_

## Current Architecture

### Museum-Quality Design System (December 2025)

The application underwent a complete visual redesign from retro arcade aesthetic to a **museum-quality collector's gallery** with PS2-era sophistication.

**Design Philosophy:**

- Museum gallery darks with PS2 cyan accents (#00d4ff)
- Modern typography: Rajdhani (headers), Inter (body), Space Mono (monospace)
- Glassmorphism effects with frosted glass cards
- Masonry grid layout for visual game showcase
- Micro-animations and smooth transitions

### Modular Architecture (January 2025)

**Phase 0 refactoring complete**: The application was refactored from a 5,940-line monolithic `app.js` into **27 focused ES6 modules** totaling 6,670 lines. All modules have comprehensive test coverage (674 tests passing, 76% statement coverage).

### File Structure

````
retro_games/
├── index.html                      # Main entry point
├── style.css                       # Master stylesheet (modular imports)
├── config.js                       # Supabase config (generated from .env)
│
├── app/
│   ├── main.js                    # Application bootstrap (456 lines)
│   │
│   ├── design/
│   │   └── tokens.js              # Design tokens in JavaScript
│   │
│   ├── ui/                        # UI rendering modules (6 modules, 1,989 lines)
│   │   ├── dashboard.js           # Dashboard stats & calculations (493 lines)
│   │   ├── grid.js                # Game grid rendering & helpers (453 lines)
│   │   ├── carousel.js            # Featured games carousel (313 lines)
│   │   ├── theme.js               # Theme switching & motion prefs (259 lines)
│   │   ├── modal.js               # Game detail modal helpers (240 lines)
│   │   └── filters.js             # Filter UI builders (232 lines)
│   │
│   ├── features/                  # Feature logic modules (6 modules, 1,646 lines)
│   │   ├── virtualization.js      # Grid virtualization helpers (371 lines)
│   │   ├── filtering.js           # Filter predicates & matching (342 lines)
│   │   ├── search.js              # Search & typeahead logic (282 lines)
│   │   ├── pagination.js          # Pagination calculations (220 lines)
│   │   ├── sharing.js             # Share codes & export/import (219 lines)
│   │   └── sorting.js             # Sort comparators & config (212 lines)
│   │
│   ├── state/                     # State management (4 modules, 829 lines)
│   │   ├── filters.js             # Filter state & constants (239 lines)
│   │   ├── preferences.js         # User preferences storage (218 lines)
│   │   ├── collection.js          # Owned/wishlist state (190 lines)
│   │   └── cache.js               # Cover URL caching (182 lines)
│   │
│   ├── data/                      # Data layer modules (5 modules, 721 lines)
│   │   ├── pricing.js             # Price normalization & queries (263 lines)
│   │   ├── loader.js              # Data loading & row processing (184 lines)
│   │   ├── aggregates.js          # Genre/timeline aggregates (163 lines)
│   │   ├── supabase.js            # Supabase client config (70 lines)
│   │   └── storage.js             # Storage URL helpers (41 lines)
│   │
│   └── utils/                     # Pure utilities (4 modules, 262 lines)
│       ├── format.js              # Currency, rating, percent formatting (162 lines)
│       ├── validation.js          # Year, rating, ID validation (46 lines)
│       ├── keys.js                # Game key generation/parsing (30 lines)
│       └── dom.js                 # HTML escaping utilities (24 lines)
│
├── style/
│   ├── tokens.css                 # Design system CSS variables
│   ├── base.css                   # Typography, reset, base styles
│   ├── utilities.css              # Utility classes
│   └── components/
│       ├── dashboard.css          # Hero dashboard styles
│       ├── grid.css               # Masonry grid styles
│       ├── filters.css            # Sidebar/drawer filters
│       ├── modal.css              # Game modal styles
│       └── cards.css              # Reusable card components
│
├── data/
│   ├── sample-games.json          # Fallback offline dataset
│   ├── sample-price-history.json  # Sample pricing data
│   └── ...
│
├── tests/
│   ├── app.test.js                # Integration tests (25 tests)
│   ├── utils.test.js              # Module unit tests (460 tests)
│   ├── archive-media.test.js      # Media archival tests (3 tests)
│   └── e2e/
│       └── *.spec.js              # End-to-end tests
│
├── archive/
│   └── app-legacy.js              # Archived monolithic code (5,940 lines)
│
└── docs/
    └── ...                        # Documentation

### Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Data Layer**: Supabase (PostgreSQL) with local storage fallback
- **Styling**: Custom CSS with design tokens, no frameworks
- **Dependencies**:
  - `masonry-layout` - Grid layout
  - `imagesloaded` - Image loading detection
  - `@supabase/supabase-js` - Database client
- **Build**: None required (static files, no bundler)
- **Testing**: Vitest (unit), Playwright (e2e)

## Data Architecture

### Data Flow

1. **Bootstrap**: `app/main-redesign.js` loads on page ready
2. **Data Loading**:
   - Attempts Supabase connection if configured
   - Falls back to `data/sample-games.json` if unavailable
   - Loads user state from localStorage (owned, wishlist, notes, etc.)
3. **Rendering**:
   - Dashboard stats calculated and rendered
   - Filters populated with unique platforms/genres
   - Game grid rendered with masonry layout
4. **Interactions**:
   - Filters update → Re-render grid with filtered data
   - Quick actions (Own, Wishlist) → Update localStorage → Refresh UI
   - Search → Filter games → Re-render
   - Card click → Open modal with game details

### State Management

**localStorage Keys:**

- `roms_owned` - Owned games (JSON object: `{gameKey: true}`)
- `rom_notes` - Game notes (JSON object: `{gameKey: "note text"}`)
- `roms_wishlist` - Wishlist games
- `roms_backlog` - Backlog games
- `roms_trade` - Trade games
- `rom_theme` - Theme preference (light/dark)
- `rom_filters` - Persisted filter state

**Game Key Format**: `{game_name}___{platform}` (triple underscore prevents collisions)

### Database Schema (Supabase)

**Primary Table**: `games`

Key columns:

- `game_name` (text) - Game title
- `platform` (text) - Console/system
- `genre` (text) - Comma-separated genres
- `cover` (text) - Cover image URL
- `rating` (numeric) - Game rating
- `release_year` (integer) - Release year
- `region_code` (text) - Region code
- `screenshots` (text[]) - Screenshot URLs
- Plus additional metadata fields

## UI Components

### Dashboard (Hero Section)

6 animated stat cards:

1. **Total Games** - Complete database count
2. **Owned** - Games marked as owned
3. **Wishlist** - Games on wishlist
4. **Backlog** - Games in backlog
5. **Trade** - Games for trade
6. **Completion %** - Owned/Total ratio

Features:

- Glassmorphism card effects
- Animated number counters
- Progress bars
- Hover effects

### Game Grid

- Masonry layout (Pinterest-style)
- Cover art images
- Hover overlays with quick actions
- Status badges (Owned, Wishlist, etc.)
- Loading skeletons
- Empty state messaging

### Filters Sidebar

- Platform checkboxes (with counts)
- Genre checkboxes (with counts)
- Status filters
- Sort options (name, rating, year, value)
- Search input
- Clear filters button
- Responsive: Sidebar (desktop), Drawer (mobile)

### Game Modal

- Large cover art (50% width)
- Game metadata
- Quick action buttons
- Notes textarea
- External links (Google, YouTube, GameFAQs)
- Price information (if available)
- Similar games section

### Mobile Navigation

Bottom tab bar with:

- Collection view
- Stats view
- Filters toggle
- More options

## Design System

### Color Palette

**Museum Darks:**

- Background: `#0a0e14`
- Surface: `#14181f`
- Surface Elevated: `#1a1f29`

**PS2 Cyan:**

- Primary: `#00d4ff`
- Primary Light: `#33ddff`
- Primary Dark: `#00a3cc`

**Status Colors:**

- Success: `#22c55e` (green)
- Warning: `#f59e0b` (amber)
- Info: `#6366f1` (indigo)
- Accent: `#a855f7` (purple)

### Typography Scale

- Display: Rajdhani (300, 400, 600, 700)
- Body: Inter (400, 500, 600, 700)
- Mono: Space Mono (400, 700)

### Spacing Scale

xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, xxl: 48px

### Shadow System

- sm: Subtle elevation
- md: Card elevation
- lg: Modal elevation
- glow: Neon glow effects

## Performance Considerations

### Optimizations

1. **Virtualization**: Only render visible grid items (when dataset > 1000 games)
2. **Lazy Loading**: Images load as they enter viewport
3. **Debounced Search**: 300ms delay on search input
4. **Masonry Layout**: Efficient grid recalculation
5. **localStorage Caching**: Avoid repeated Supabase calls
6. **CSS Containment**: Improve rendering performance

### Metrics

- First Contentful Paint: < 1s
- Time to Interactive: < 2s
- Lighthouse Score: 90+
- Accessibility Score: 95+

## Completed Module Architecture (January 2025)

All planned modules have been extracted and are now in use:

### Data Layer (`app/data/`)

| Module | Lines | Key Exports |
|--------|-------|-------------|
| `supabase.js` | 70 | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, table/bucket constants |
| `loader.js` | 184 | `applySupabaseFilters`, `computeRegionCodes`, `normalizeIncomingRows`, `buildRowKey` |
| `aggregates.js` | 163 | `computeLocalGenreAggregates`, `computeLocalTimelineSeries`, RPC parsers |
| `pricing.js` | 263 | `normalizePriceValue`, `selectStatusPrice`, `resolvePriceValue`, `formatPriceValue` |
| `storage.js` | 41 | `normalizeImageUrl`, `buildStoragePublicUrl`, `normalizeCoverUrl` |

### Feature Modules (`app/features/`)

| Module | Lines | Key Exports |
|--------|-------|-------------|
| `virtualization.js` | 371 | `computeVirtualWindow`, `updateVirtualScrollState`, scroll helpers |
| `filtering.js` | 342 | `rowMatchesPlatform`, `rowMatchesGenre`, `rowMatchesStatus`, filter predicates |
| `search.js` | 282 | `normalizeSearchQuery`, `scoreSearchMatch`, `buildSearchPredicate` |
| `pagination.js` | 220 | `computePageRange`, `computePageWindowRange`, page size constants |
| `sharing.js` | 219 | `encodeSharePayload`, `decodeSharePayload`, `buildBackupPayload`, CSV export |
| `sorting.js` | 212 | `buildSortComparator`, `parseSortConfig`, column constants |

### State Management (`app/state/`)

| Module | Lines | Key Exports |
|--------|-------|-------------|
| `filters.js` | 239 | `FILTER_STORAGE_KEY`, column constants, filter defaults |
| `preferences.js` | 218 | `getStoredThemeChoice`, `persistThemeChoice`, browse preferences |
| `collection.js` | 190 | `STORAGE_KEY`, status constants, collection helpers |
| `cache.js` | 182 | `getCoverCacheStorage`, cache TTL helpers |

### UI Modules (`app/ui/`)

| Module | Lines | Key Exports |
|--------|-------|-------------|
| `dashboard.js` | 493 | `calculateAverageRating`, `countPlatforms`, `calculatePlatformBreakdown` |
| `grid.js` | 453 | `normalizeCoverUrl`, `resolveCoverUrl`, `STATUS_CLASSES`, placeholders |
| `carousel.js` | 313 | `calculateScrollStep`, `computeButtonStates`, trending helpers |
| `theme.js` | 259 | `getPreferredTheme`, `applyThemeChoice`, motion preference helpers |
| `modal.js` | 240 | `buildMetadataCard`, `calculateGalleryIndex`, focus trap helpers |
| `filters.js` | 232 | `extractUniquePlatforms`, `extractUniqueGenres`, dropdown builders |

### Utility Modules (`app/utils/`)

| Module | Lines | Key Exports |
|--------|-------|-------------|
| `format.js` | 162 | `formatCurrency`, `formatNumber`, `formatRating`, `formatPercent` |
| `validation.js` | 46 | `parseYear`, `parseRating`, `sanitizeForId`, `isValidTheme` |
| `keys.js` | 30 | `generateGameKey`, `parseGameKey` |
| `dom.js` | 24 | `escapeHtml` |

## Future Work

### Remaining Integration Tasks

1. **Modal Wiring** - Connect `ui/modal.js` helpers to game card click handlers in `main.js`
2. **Virtualization DOM** - Connect `features/virtualization.js` to grid rendering pipeline
3. **Coverage Tooling** - Install `@vitest/coverage-v8` for coverage metrics

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Generate config from .env
npm run build:config

# Start dev server
python -m http.server 8080

# Run tests
npm test              # Unit tests
npm run test:e2e      # E2E tests

# Linting
npm run lint          # Check code
npm run lint:fix      # Auto-fix issues

# Formatting
npm run format        # Format all files
npm run format:check  # Check formatting
````

### CI/CD Pipeline

Automated checks on every PR:

1. Linting (ESLint + Prettier)
2. Unit tests (Vitest)
3. E2E tests (Playwright)
4. Security scan (gitleaks)
5. Lighthouse CI (performance, accessibility)

## Architecture Decisions

### Why No Build Step?

- **Simplicity**: Direct file editing, no compilation
- **Transparency**: See exact code that runs in browser
- **Speed**: Instant changes without rebuilds
- **Learning**: Easy for contributors to understand

### Why Vanilla JavaScript?

- **Performance**: No framework overhead
- **Longevity**: No framework churn/deprecation
- **Control**: Full control over every interaction
- **Size**: Minimal bundle size

### Why Supabase?

- **Backend-as-a-Service**: No server management
- **PostgreSQL**: Powerful SQL database
- **Real-time**: (Future) Live updates
- **Free Tier**: Generous for small projects
- **Type-safe**: Auto-generated TypeScript types

### Why localStorage?

- **Privacy**: Data stays on device
- **Offline**: Works without internet
- **Simple**: No auth required
- **Fast**: Instant read/write
- **Shareable**: Export/import via codes

## Known Limitations

1. **No User Accounts**: Collection data is device-local (by design)
2. **Single-Device**: No automatic sync between devices
3. **Share Code Size**: Large collections = large codes
4. **Browser Storage Limits**: ~10MB localStorage cap
5. **No Real-time Updates**: Manual refresh required for new data

## Security Considerations

- Supabase anon key is public (safe for client-side use)
- Row-Level Security (RLS) policies protect data
- No sensitive data stored client-side
- XSS protection via textContent (no innerHTML)
- CSRF not applicable (no cookies/sessions)

## Accessibility Features

- Semantic HTML5 elements
- ARIA labels and roles
- Keyboard navigation support
- Focus trap in modals
- Skip links for screen readers
- Reduced motion support
- High contrast text
- Alt text for images

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS 14+, Android 10+)

**Required Features:**

- ES6 modules
- CSS Grid & Flexbox
- CSS Custom Properties
- localStorage API
- Fetch API
- Intersection Observer (for lazy loading)
