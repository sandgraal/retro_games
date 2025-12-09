# Agent Quickstart Guide

_Last updated: December 2025_

👋 **Welcome, AI Agent!** This guide helps you quickly understand Dragon's Hoard Atlas and start contributing effectively.

## 🎯 Project Status at a Glance

| Area          | Status                                 |
| ------------- | -------------------------------------- |
| Application   | ⭐ Feature-complete & production-ready |
| Language      | **TypeScript** (strict mode)           |
| Build         | **Vite 7.x**                           |
| Tests         | ✅ **214 total** (200 unit + 14 E2E)   |
| CI/CD         | ✅ Automated (lint, test, security)    |
| Documentation | ✅ Current and synchronized            |

## 📚 Required Reading (Priority Order)

1. **This document** - Project overview (5 min)
2. **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Architecture & patterns (10 min)
3. **[current-state.md](./current-state.md)** - Current status & next steps (5 min)

## ⚡ Quick Commands

\`\`\`bash
npm install # Install dependencies
npm run dev # Dev server at localhost:3000
npm run build # TypeScript check + production build
npm test # Run unit tests
npm run test:e2e # Run Playwright E2E tests
\`\`\`

## 🏗️ Architecture Overview

### Source Structure

\`\`\`
src/
├── core/ # Reactive primitives
│ ├── signals.ts # createSignal, computed, effect
│ ├── types.ts # TypeScript type definitions
│ └── keys.ts # Game key generation
├── state/ # Centralized reactive state
│ └── store.ts # Signal-based state management
├── data/ # Data layer
│ ├── supabase.ts # Type-safe Supabase client
│ └── loader.ts # Data loading & processing
├── features/ # Business logic
│ └── export.ts # CSV export, backup, sharing
├── ui/ # Component system
│ ├── game-card.ts
│ ├── game-grid.ts
│ ├── dashboard.ts
│ ├── filters.ts
│ └── modal.ts
├── utils/ # Pure utility functions
│ └── format.ts # Formatting helpers
└── main.ts # Application entry point
\`\`\`

### Core Concepts

**Reactive Signals**: The app uses custom signals for fine-grained reactivity:

\`\`\`typescript
const count = createSignal(0);
count.get(); // Read value
count.set(5); // Update value
const doubled = computed(() => count.get() \* 2); // Auto-tracks deps
effect(() => console.log(count.get())); // Runs on change
\`\`\`

**Game Keys**: Games are identified by compound keys: \`gamename\_\_\_platform\` (lowercase, triple underscore)

### Style Classes

CSS uses **kebab-case** class names (not BEM):

- \`.game-card-cover\` (not \`.game-card\_\_cover\`)
- \`.game-card-status\` (not \`.game-card\_\_status\`)
- \`.game-card-overlay\` (not \`.game-card\_\_overlay\`)

## ⚠️ Important Notes

### DO

- Use TypeScript with proper types
- Use signals for reactive state
- Run \`npm run lint && npm test\` before commits
- Match CSS class naming conventions (kebab-case)

### DON'T

- Modify `archive/` directory (legacy reference only)
- Commit `config.js` with real credentials
- Use innerHTML with user data (XSS risk)

## 🧪 Test Structure

| Test File                              | Tests | Purpose                 |
| -------------------------------------- | ----- | ----------------------- |
| \`tests/core.test.ts\`                 | 26    | Signals, keys, types    |
| \`tests/state.test.ts\`                | 27    | Store, collection       |
| \`tests/features.test.ts\`             | 12    | Export, backup, sharing |
| `tests/format.test.ts`                 | 36    | Formatting utilities    |
| \`tests/fetch-covers.test.js\`         | 48    | Cover fetching script   |
| \`tests/audit-missing-covers.test.js\` | 26    | Cover audit script      |
| \`tests/archive-media.test.js\`        | 14    | Media archival script   |
| \`tests/build-css.test.js\`            | 11    | CSS bundler script      |
| \`tests/e2e/\*.spec.js\`               | 14    | E2E tests               |

## 🎯 What to Work On

### Current Priorities

1. **Expand test coverage** - Add integration tests for UI components
2. **Media workflow automation** - Improve cover import and archival tooling
3. **User Growth features** - Blocked on analytics/email service decisions

### Completed ✅

- TypeScript migration from vanilla JS
- Reactive signals architecture
- Game grid with masonry layout
- Modal with collection management
- Filters (platform, genre, region, status, search)
- Export/import (CSV, JSON backup, share codes)
- All E2E tests passing
- Documentation synchronized with codebase
- V3 experimental files cleaned up

## 📁 Legacy Code Warning

The \`archive/legacy-app/\` directory contains the **original vanilla JavaScript implementation** (~9,800 lines).

**Do NOT**:

- Import from \`archive/\`
- Modify files in \`archive/\`
- Reference \`archive/\` code for new features

It exists only for historical reference.
