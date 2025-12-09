# Architecture Overview

_Last updated: December 2025_

## Overview

Dragon's Hoard Atlas is a **TypeScript single-page application** built with Vite for fast development and optimized production builds. The architecture uses a reactive signals pattern for state management and component updates.

## Tech Stack

| Component | Technology                                 |
| --------- | ------------------------------------------ |
| Language  | TypeScript (strict mode)                   |
| Build     | Vite 7.x                                   |
| Testing   | Vitest (unit), Playwright (e2e)            |
| Runtime   | Vanilla JS/CSS/HTML - no frameworks        |
| Database  | Supabase (optional, localStorage fallback) |
| Styling   | CSS with custom properties (design tokens) |

## Source Structure

\`\`\`
src/
├── core/ # Reactive primitives
│ ├── signals.ts # createSignal, computed, effect
│ ├── types.ts # TypeScript type definitions
│ ├── keys.ts # Game key generation/parsing
│ ├── events.ts # Event emitter utilities
│ ├── router.ts # Client-side routing
│ ├── runtime.ts # Core runtime exports
│ ├── storage.ts # Storage utilities
│ ├── worker.ts # Web worker utilities
│ └── index.ts # Module exports
│
├── state/ # Centralized state management
│ ├── store.ts # Main store with signals
│ └── index.ts # Module exports
│
├── data/ # Data layer
│ ├── supabase.ts # Supabase client
│ ├── loader.ts # Data loading & processing
│ └── index.ts # Module exports
│
├── features/ # Business logic
│ ├── export.ts # CSV export, backup, sharing
│ └── index.ts # Module exports
│
├── ui/ # Component system
│ ├── components.ts # createElement, mount helpers
│ ├── game-card.ts # Game card component
│ ├── game-grid.ts # Game grid with filtering
│ ├── dashboard.ts # Dashboard stats
│ ├── filters.ts # Filter sidebar
│ ├── modal.ts # Game detail modal
│ ├── settings-modal.ts # Settings modal
│ ├── virtual-list.ts # Virtualized list rendering
│ └── index.ts # Module exports
│
├── utils/ # Pure utility functions
│ └── format.ts # Formatting helpers
│
└── main.ts # Application entry point
\`\`\`

## Core Concepts

### Reactive Signals

The app uses a custom signals implementation for fine-grained reactivity:

\`\`\`typescript
import { createSignal, computed, effect } from "./core/signals";

// Create a signal (reactive value)
const count = createSignal(0);

// Read value
count.get(); // 0

// Update value
count.set(5);
count.set(prev => prev + 1);

// Computed values auto-track dependencies
const doubled = computed(() => count.get() \* 2);

// Effects run when dependencies change
effect(() => {
console.log("Count is:", count.get());
});
\`\`\`

### State Management

All application state lives in \`src/state/store.ts\`:

- **gamesSignal**: All loaded games with keys
- **collectionSignal**: User's owned/wishlist/backlog/trade games
- **filterStateSignal**: Current filter settings
- **Computed values**: \`filteredGames\`, \`collectionStats\`, \`availablePlatforms\`

### Game Keys

Games are identified by compound keys: \`gamename\_\_\_platform\`

\`\`\`typescript
import { generateGameKey } from "./core/keys";

const key = generateGameKey({
game_name: "Chrono Trigger",
platform: "SNES"
});
// Result: "chrono trigger\_\_\_snes"
\`\`\`

### Data Flow

1. \`main.ts\` calls \`loadGames()\` from \`src/data/loader.ts\`
2. Loader attempts Supabase, falls back to sample JSON
3. Games stored via \`setGames()\` which adds keys
4. UI components subscribe to \`filteredGames\` computed
5. Filter changes → computed recalculates → UI updates

## CSS Architecture

CSS uses **kebab-case** class naming (not BEM):

\`\`\`css
/_ Correct naming convention _/
.game-card-cover { }
.game-card-status { }
.game-card-overlay { }

/_ NOT used _/
.game-card**cover { }
.game-card**status { }
\`\`\`

### Style Structure

\`\`\`
style/
├── tokens.css # Design system variables
├── base.css # Typography, reset
├── utilities.css # Utility classes
└── components/
├── dashboard.css # Dashboard styles
├── grid.css # Game grid styles
├── filters.css # Filter sidebar
├── modal.css # Modal styles
└── cards.css # Card components
\`\`\`

## Component Pattern

Components follow a consistent pattern:

\`\`\`typescript
// 1. Define component with ComponentContext
export function initComponent(ctx: ComponentContext): void {
const { element, cleanup } = ctx;

// 2. Subscribe to reactive state
const unsub = effect(() => {
const data = someSignal.get();
render(element, data);
});
cleanup.push(unsub);

// 3. Add event listeners
element.addEventListener("click", handleClick);
cleanup.push(() => element.removeEventListener("click", handleClick));
}

// 4. Mount helper
export function mountComponent(selector: string): () => void {
return mount(selector, initComponent);
}
\`\`\`

## Testing

| Test Type | Framework  | Location                 |
| --------- | ---------- | ------------------------ |
| Unit      | Vitest     | \`tests/\*.test.ts\`     |
| E2E       | Playwright | \`tests/e2e/\*.spec.js\` |

### Test Coverage

- 193 unit tests
- 14 E2E tests
- **207 total tests**

## Build & Deploy

\`\`\`bash
npm run dev # Development server (port 3000)
npm run build # Production build to dist/
npm run preview # Preview production build
\`\`\`

### Production Output

\`\`\`
dist/
├── index.html # ~19KB
├── assets/
│ ├── main-_.css # ~43KB (7KB gzipped)
│ └── main-_.js # ~33KB (11KB gzipped)
\`\`\`

## Legacy Code

The \`archive/legacy-app/\` directory contains the original vanilla JavaScript implementation (~9,800 lines). This is for historical reference only and should not be modified or imported.

## Design System

### Colors

\`\`\`css
--accent-primary: #00d4ff; /_ PS2 cyan _/
--bg-primary: #0f1318; /_ Deep dark _/
--bg-elevated: #14181f; /_ Card backgrounds _/
--text-primary: #ffffff; /_ Primary text _/
--text-secondary: #a8b2c0; /_ Muted text _/
\`\`\`

### Typography

- **Display**: Rajdhani (headers)
- **Body**: Inter (content)
- **Monospace**: Space Mono (code)
