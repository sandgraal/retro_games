# Current State Overview

_Last updated: December 2025_

## Architecture

- **TypeScript single-page application** built with Vite 7.x
- **Reactive signals architecture** with custom signals implementation for fine-grained reactivity
- Production build creates optimized bundles (~33KB JS, ~43KB CSS gzipped)
- Supabase backend with graceful fallback to `data/sample-games.json`
- Museum-quality design with glassmorphism, masonry grid, and PS2-era aesthetic

### Tech Stack

| Component | Technology                                 |
| --------- | ------------------------------------------ |
| Language  | TypeScript (strict mode)                   |
| Build     | Vite 7.x                                   |
| Testing   | Vitest (unit), Playwright (e2e)            |
| Runtime   | Vanilla JS/CSS/HTML - no frameworks        |
| Database  | Supabase (optional, localStorage fallback) |

### Source Structure

\`\`\`
src/
├── core/ # Reactive primitives (signals, types, keys)
├── state/ # Centralized reactive state (store.ts)
├── data/ # Data layer (supabase.ts, loader.ts)
├── features/ # Business logic (export.ts)
├── ui/ # Component system (game-card, grid, modal, filters)
├── utils/ # Pure utility functions
└── main.ts # Application entry point
\`\`\`

### Legacy Code

The \`archive/legacy-app/\` directory contains the original vanilla JavaScript implementation. This is kept for historical reference only and should not be modified or imported.

## Data Flow

1. \`main.ts\` initializes the app, loads persisted state from localStorage
2. \`loadGames()\` attempts Supabase, falls back to sample JSON
3. Games are stored via \`setGames()\` which adds compound keys (\`gamename\_\_\_platform\`)
4. UI components subscribe to \`filteredGames\` computed signal
5. Filter changes trigger automatic UI updates via reactive signals

## Test Coverage

**Total: 193 unit tests + 14 E2E tests = 207 tests**

| Test File                              | Tests | Purpose                    |
| -------------------------------------- | ----- | -------------------------- |
| \`tests/core.test.ts\`                 | 26    | Signals, keys, types       |
| \`tests/state.test.ts\`                | 27    | Store, collection, filters |
| \`tests/features.test.ts\`             | 12    | Export, backup, sharing    |
| \`tests/format.test.ts\`               | 29    | Formatting utilities       |
| \`tests/fetch-covers.test.js\`         | 48    | Cover fetching script      |
| \`tests/audit-missing-covers.test.js\` | 26    | Cover audit script         |
| \`tests/archive-media.test.js\`        | 14    | Media archival script      |
| \`tests/build-css.test.js\`            | 11    | CSS bundler script         |
| \`tests/e2e/\*.spec.js\`               | 14    | Playwright E2E tests       |

## Current Focus Areas

### Working

- ✅ Game grid with masonry layout and card interactions
- ✅ Modal with game details, collection status, and notes
- ✅ Filters (platform, genre, region, status, search)
- ✅ Collection management (owned, wishlist, backlog, trade)
- ✅ Export/import (CSV, JSON backup, share codes)
- ✅ Service worker for offline support
- ✅ Responsive design (mobile-first)
- ✅ Keyboard navigation and accessibility
- ✅ All E2E tests passing

### Technical Debt

- Documentation referenced outdated \`app/\` directory structure (now \`src/\`)
- Some v3 experimental files in \`src/\` that should be cleaned up
- CSS uses kebab-case while some code initially used BEM (now aligned)

### Data & Security

- Supabase anon key rotation process documented
- Gitleaks in CI prevents secret commits
- Data integrity relies on manual Supabase updates

## Development Commands

\`\`\`bash
npm install # Install dependencies
npm run dev # Start Vite dev server (port 3000)
npm run build # TypeScript check + Vite build
npm test # Run unit tests (Vitest)
npm run test:e2e # Run Playwright E2E tests
npm run lint # ESLint check
npm run format # Prettier format
\`\`\`

## Next Steps

1. **Consolidate documentation** - Remove references to legacy \`app/\` structure
2. **Clean up v3 experimental files** - Remove or finalize \`_.v3._\` files in \`src/\`
3. **Expand test coverage** - Add more integration tests for UI components
4. **Media workflow automation** - Improve cover import and archival tooling

See [\`docs/implementation-plan.md\`](./implementation-plan.md) for comprehensive roadmap.
