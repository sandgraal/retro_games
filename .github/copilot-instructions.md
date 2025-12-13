# Copilot Instructions for AI Coding Agents

## Project Overview

**Dragon's Hoard Atlas** is a privacy-first, single-page web app for tracking ALL video games (retro, modern, indie, mobile, VR) with a museum-quality interface.

### Key Traits

- No user registration; all data stays local by default
- Museum-quality design with glassmorphism, masonry grid, modern aesthetic
- **Universal coverage**: retro classics, modern AAA, indie games, mobile, VR, and emerging platforms
- **TypeScript** with reactive signals architecture
- Vite build system with hot module replacement
- Instant search/filter across thousands of games
- Collections shareable via base64-encoded codes (URL or clipboard)
- Optional Supabase backend for cloud data; gracefully falls back to sample JSON

### Tech Stack

- **Language**: TypeScript (strict mode)
- **Build**: Vite 7.x
- **Testing**: Vitest (unit), Playwright (e2e)
- **Runtime**: Vanilla JS/CSS/HTML - no frameworks
- **Database**: Supabase (optional, with localStorage fallback)

## Architecture (v2.0 - December 2025)

```
src/
├── core/           # Reactive primitives
│   ├── signals.ts  # createSignal, computed, effect
│   ├── types.ts    # TypeScript type definitions
│   └── keys.ts     # Game key generation
├── state/          # Centralized reactive state
│   └── store.ts    # Signal-based state management
├── data/           # Data layer
│   ├── auth.ts           # Auth session + role management
│   ├── guides.ts         # Markdown guide loading
│   ├── loader.ts         # Game data loading & processing
│   ├── pricing-provider.ts # Price data loading
│   ├── suggestions.ts    # Community submission APIs
│   └── supabase.ts       # Type-safe Supabase client
├── features/       # Business logic
│   └── export.ts   # CSV export, backup, sharing
├── ui/             # Component system
│   ├── game-card.ts
│   ├── game-grid.ts
│   ├── dashboard.ts
│   ├── filters.ts
│   ├── guides.ts
│   ├── modal.ts
│   ├── moderation.ts
│   └── settings-modal.ts
├── utils/          # Pure utility functions
│   └── format.ts   # Formatting helpers
└── main.ts         # Application entry point
```

## Core Concepts

### Reactive Signals

The app uses a custom signals implementation for fine-grained reactivity:

```typescript
// Create a signal
const count = createSignal(0);

// Read value
count.get(); // 0

// Update value
count.set(5);
count.set((prev) => prev + 1);

// Computed values auto-track dependencies
const doubled = computed(() => count.get() * 2);

// Effects run when dependencies change
effect(() => {
  console.log("Count is:", count.get());
});
```

### State Management

All app state lives in `src/state/store.ts`:

- **gamesSignal**: All games with keys
- **collectionSignal**: User's owned/wishlist/backlog/trade games
- **filterStateSignal**: Current filter settings
- **Computed values**: `filteredGames`, `collectionStats`, `availablePlatforms`

### Game Keys

Games are identified by compound keys: `gamename___platform` (lowercase, triple underscore)

```typescript
import { generateGameKey } from "./core/keys";
const key = generateGameKey("Chrono Trigger", "SNES");
// "chrono trigger___snes"
```

### Data Flow

1. `main.ts` calls `loadGames()` from `src/data/loader.ts`
2. Loader attempts Supabase, falls back to sample JSON
3. Games stored via `setGames()` which adds keys
4. UI components subscribe to `filteredGames` computed
5. Filter changes → computed recalculates → UI updates

## File Responsibilities

| File                           | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `src/main.ts`                  | App entry, mounts components, sets up event handlers       |
| `src/core/signals.ts`          | Reactive primitives (Signal, computed, effect)             |
| `src/core/types.ts`            | All TypeScript interfaces and types                        |
| `src/state/store.ts`           | Centralized state, computed values, actions                |
| `src/data/loader.ts`           | Load games from Supabase or sample JSON                    |
| `src/data/supabase.ts`         | Supabase client wrapper                                    |
| `src/data/auth.ts`             | Auth session, GitHub OAuth, role management                |
| `src/data/suggestions.ts`      | Community submission + moderation APIs                     |
| `src/data/pricing-provider.ts` | Price data loading with fallback                           |
| `src/data/guides.ts`           | Markdown guide loading + rendering                         |
| `src/features/export.ts`       | CSV export, backup/restore, share codes                    |
| `src/ui/*.ts`                  | UI components (game-card, grid, modal, moderation, guides) |

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (port 3000)
npm run build        # TypeScript check + Vite build
npm test             # Run unit tests
npm run test:e2e     # Run Playwright e2e tests
npm run lint         # ESLint check
npm run format       # Prettier format
npm run build:config # Generate config.js from .env
```

## Testing

- **Unit tests**: `tests/*.test.ts` - Vitest with jsdom
- **E2E tests**: `tests/e2e/*.spec.js` - Playwright
- Current: 390 unit tests + 16 e2e tests = 406 total

```bash
npm test                    # Run all unit tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

## Data Architecture

### Game Type

```typescript
interface Game {
  game_name: string;
  platform: string;
  genre: string;
  rating: string | number;
  release_year: string | number;
  cover?: string;
  region?: string;
  // ... other optional fields
}
```

### Collection Status

Games can have one status: `none | owned | wishlist | backlog | trade`

### Storage Keys

```typescript
const STORAGE_KEYS = {
  collection: "dragonshoard_collection",
  notes: "dragonshoard_notes",
  preferences: "dragonshoard_preferences",
};
```

## Conventions

### DO

- Write TypeScript with proper types
- Use signals for reactive state
- Add tests for new features
- Run `npm run lint && npm test` before commits
- Keep UI components small and focused

### DON'T

- Modify `archive/` directory (legacy code for reference only)
- Commit `config.js` with real credentials
- Add npm dependencies without justification
- Use innerHTML with user data (XSS risk)

## Common Tasks

### Add a new filter

1. Add filter field to `FilterState` in `src/core/types.ts`
2. Update `DEFAULT_FILTER_STATE` in `src/state/store.ts`
3. Add filter logic in `filteredGames` computed
4. Add UI controls in `src/ui/filters.ts`
5. Add tests

### Add a new collection action

1. Add action function in `src/state/store.ts`
2. Export from `src/state/index.ts`
3. Wire up in relevant UI component
4. Add tests

### Export feature change

1. Modify `src/features/export.ts`
2. Update tests in `tests/features.test.ts`
3. Wire up in `src/main.ts` if needed

## Legacy Code

The `archive/legacy-app/` directory contains the original vanilla JavaScript implementation (9,848 lines). This is kept for historical reference only. **Do not modify or import from archive/**.
