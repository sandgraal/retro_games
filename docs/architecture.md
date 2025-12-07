# Architecture Overview

_Last updated: December 7, 2025_

## Current Architecture

### Museum-Quality Design System (December 2025)

The application underwent a complete visual redesign from retro arcade aesthetic to a **museum-quality collector's gallery** with PS2-era sophistication.

**Design Philosophy:**

- Museum gallery darks with PS2 cyan accents (#00d4ff)
- Modern typography: Rajdhani (headers), Inter (body), Space Mono (monospace)
- Glassmorphism effects with frosted glass cards
- Masonry grid layout for visual game showcase
- Micro-animations and smooth transitions

### File Structure

```
retro_games/
├── index.html                      # Main entry point (new redesigned structure)
├── style.css                       # Master stylesheet (modular imports)
├── config.js                       # Supabase config (generated from .env)
│
├── app/
│   ├── main.js                    # Application bootstrap
│   ├── design/
│   │   └── tokens.js              # Design tokens in JavaScript
│   ├── ui/
│   │   ├── dashboard.js           # Dashboard stats & rendering
│   │   ├── grid.js                # Game grid rendering
│   │   ├── carousel.js            # Featured games carousel
│   │   ├── modal.js               # Game detail modal
│   │   └── theme.js               # Theme switching
│   ├── utils/
│   │   ├── dom.js                 # DOM utilities
│   │   ├── format.js              # Formatting helpers
│   │   ├── keys.js                # Game key generation
│   │   └── validation.js          # Input validation
│   ├── data/
│   │   └── ...                    # (Future) Data layer modules
│   └── features/
│       └── ...                    # (Future) Feature modules
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
│   ├── app.test.js                # Unit tests
│   └── e2e/
│       └── *.spec.js              # End-to-end tests
│
└── docs/
    └── ...                        # Documentation
```

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

## Future Architecture Plans

### Data Layer Modularization

Extract data operations into dedicated modules:

- `app/data/supabase.js` - Supabase client wrapper
- `app/data/loader.js` - Data loading logic
- `app/data/aggregates.js` - Stats calculations
- `app/data/pricing.js` - Price data integration

### Feature Modules

Isolate complex features:

- `app/features/virtualization.js` - Grid virtualization
- `app/features/pagination.js` - Pagination logic
- `app/features/search.js` - Search/filter logic
- `app/features/sharing.js` - Share codes & export

### State Management

Centralize state:

- `app/state/collection.js` - Owned/wishlist state
- `app/state/filters.js` - Filter state
- `app/state/preferences.js` - User preferences
- `app/state/cache.js` - Caching layer

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
```

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
