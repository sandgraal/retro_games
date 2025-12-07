# Architecture Refactoring Roadmap

_Created: December 2025_  
_Status: 🔴 CRITICAL - Must complete before major new features_

## Executive Summary

The Retro Games List application is **feature-complete and production-ready**, but has grown organically into a 5,940-line monolithic file (`app.js`) that creates unsustainable maintenance burden. This document provides a clear, actionable roadmap for refactoring the codebase into maintainable ES6 modules **without rewriting working code**.

**Key Metrics**:

- Current: 5,940 lines, 218 functions, 50+ global variables in single file
- Target: <500 lines per file, <50 functions per file, <10 global variables
- Timeline: 4 weeks (3-4 hours/day for solo developer)
- Risk: LOW (surgical refactoring, not rewrite)

## Why Refactor Now?

### Current Pain Points

1. **ESLint timeouts** - File too large for linters to process efficiently
2. **High cognitive load** - Impossible to hold entire codebase in working memory
3. **Hard to test** - Monolithic structure makes unit testing difficult
4. **Onboarding friction** - New contributors overwhelmed by file size
5. **Merge conflicts** - Multiple developers editing same giant file
6. **Slow dev tools** - IDEs struggle with large files

### What We're NOT Doing

- ❌ Rewriting from scratch
- ❌ Changing frameworks or build tools
- ❌ Removing features
- ❌ Breaking existing functionality
- ❌ Requiring a bundler

### What We ARE Doing

- ✅ Extracting functions into ES6 modules
- ✅ Maintaining zero regressions
- ✅ Improving test coverage (target 60%)
- ✅ Preserving no-build-step approach
- ✅ Creating clear module boundaries

## Proposed Architecture

```
retro_games/
├── index.html                    # Entry point
├── style.css                     # (to be modularized later)
├── app/                          # NEW: Modular JavaScript
│   ├── main.js                   # Orchestration & bootstrap
│   │
│   ├── state/                    # State management
│   │   ├── collection.js         # Game statuses & notes
│   │   ├── filters.js            # Filter state
│   │   ├── preferences.js        # UI preferences (theme, browse mode)
│   │   └── cache.js              # Client-side caches
│   │
│   ├── data/                     # External I/O
│   │   ├── supabase.js           # Supabase client
│   │   ├── loader.js             # Data fetching & streaming
│   │   ├── aggregates.js         # Dashboard aggregates
│   │   ├── pricing.js            # PriceCharting integration
│   │   └── storage.js            # Supabase Storage helpers
│   │
│   ├── ui/                       # DOM rendering
│   │   ├── grid.js               # Game grid
│   │   ├── modal.js              # Modal dialogs
│   │   ├── filters.js            # Filter controls
│   │   ├── dashboard.js          # Dashboard widgets
│   │   ├── carousel.js           # Carousels
│   │   └── theme.js              # Theme toggle
│   │
│   ├── features/                 # Complex features
│   │   ├── virtualization.js     # Grid virtualization
│   │   ├── pagination.js         # Browse controls
│   │   ├── search.js             # Typeahead search
│   │   ├── sharing.js            # Share codes
│   │   ├── sorting.js            # Sort logic
│   │   └── filtering.js          # Filter logic
│   │
│   └── utils/                    # Pure utilities
│       ├── dom.js                # DOM helpers
│       ├── format.js             # Formatters
│       ├── validation.js         # Input validation
│       └── keys.js               # Key generation
│
├── tests/                        # Test files (mirror structure)
│   ├── app.test.js               # Integration tests
│   ├── state/
│   ├── data/
│   ├── ui/
│   ├── features/
│   └── utils/
│
└── docs/
    ├── architecture.md           # NEW: Architecture docs
    └── migration-guide.md        # NEW: Refactoring notes
```

## Module Design Principles

### 1. Single Responsibility

Each module should have ONE clear purpose. If you can't describe it in one sentence, it's too big.

### 2. Clear Interfaces

Modules export functions/objects with explicit contracts:

```javascript
// Good: Clear exports
export { loadStatuses, saveStatuses, getStatusForKey };

// Bad: Exporting everything
export * from "./collection";
```

### 3. Dependency Direction

```
main.js → features → ui → data → state → utils
```

- Utils depend on nothing
- State depends only on utils
- Data depends on state + utils
- UI depends on data + state + utils
- Features coordinate multiple layers

### 4. No Circular Dependencies

Use dependency injection or events to break circles:

```javascript
// Bad: Circular
// grid.js imports modal.js, modal.js imports grid.js

// Good: Event-driven
// grid.js emits 'showModal' event, modal.js listens
```

### 5. Testability First

Each module should be easily testable in isolation:

```javascript
// Export testable functions
export function formatPrice(cents) { ... }

// Don't export everything as one object unless needed
```

## Refactoring Strategy

### Phase 0A: Setup (Week 1, Days 1-2)

**Goal**: Create structure without breaking anything

#### Day 1: Foundation

- [x] Create `app/` directory structure
- [x] Create empty module files with TODO comments
- [x] Update `index.html` to load `<script type="module" src="app/main.js">`
- [x] Create minimal `app/main.js` that imports old `app.js`
- [x] Test: Everything still works
- [ ] Commit: "Phase 0A: Create module structure"

#### Day 2: Documentation

- [ ] Create `docs/architecture.md` (this structure)
- [ ] Update `CONTRIBUTING.md` with module guidelines
- [ ] Create `docs/migration-guide.md` (tracking decisions)
- [ ] Set up module templates in docs
- [ ] Commit: "Phase 0A: Add architecture documentation"

### Phase 0B: Extract Utilities (Week 1, Days 3-5)

**Goal**: Extract pure functions first (safest)

#### Day 3: DOM Utilities

- [ ] Extract `escapeHtml`, `sanitizeForId`, `buildRowKey` → `utils/dom.js`
- [ ] Extract `getRegionCodesForRow`, `computeRegionCodes` → `utils/dom.js`
- [ ] Update imports in `app.js`
- [ ] Write unit tests for utilities
- [ ] Run full test suite
- [ ] Commit: "Phase 0B: Extract DOM utilities"

#### Day 4: Formatters

- [ ] Extract `formatCurrency*`, `formatPercent`, `timeAgo` → `utils/format.js`
- [ ] Extract `formatFieldLabel`, `formatPriceTrend` → `utils/format.js`
- [ ] Extract `formatAbsoluteDate`, `formatRelativeDate` → `utils/format.js`
- [ ] Update imports, test, commit

#### Day 5: Validation & Keys

- [ ] Extract `parseYear`, `parseRating`, `normalizeCoverUrl` → `utils/validation.js`
- [ ] Extract `buildRowKey`, `buildRemoteFilterSignature` → `utils/keys.js`
- [ ] Extract `slugifyStructuredDataId`, `extractWikipediaTitleFromUrl` → `utils/keys.js`
- [ ] Update imports, test, commit

### Phase 0C: Extract State (Week 2, Days 1-3)

**Goal**: Centralize state management

#### Day 1: Collection State

- [ ] Extract `gameStatuses`, `gameNotes`, `importedCollection`, `importedNotes`
- [ ] Extract `loadStatuses`, `saveStatuses`, `loadNotes`, `saveNotes`
- [ ] Extract `getStatusForKey`, `setStatusForKey`, `getNoteForKey`, `setNoteForKey`
- [ ] Extract `getActiveStatusMap` → `state/collection.js`
- [ ] Update all consumers, test, commit

#### Day 2: Filter State

- [ ] Extract all filter variables (`filterPlatform`, `filterGenre`, etc.)
- [ ] Extract `persistedFilters`, `loadPersistedFilters`, `savePersistedFilters`
- [ ] Extract `applyFiltersToInputs` → `state/filters.js`
- [ ] Update consumers, test, commit

#### Day 3: Preferences & Cache

- [ ] Extract `browseMode`, `paginationState`, theme state → `state/preferences.js`
- [ ] Extract `fallbackCoverCache`, `priceState` → `state/cache.js`
- [ ] Extract `loadBrowsePreferences`, `saveBrowsePreferences`
- [ ] Update consumers, test, commit

### Phase 0D: Extract Data Layer (Week 2, Days 4-5 + Week 3, Day 1)

**Goal**: Isolate all external I/O

#### Day 4: Supabase & Loader

- [ ] Extract Supabase client initialization → `data/supabase.js`
- [ ] Extract `loadGameData`, `fetchGamesPage`, `fetchSampleGames` → `data/loader.js`
- [ ] Extract streaming logic (`streamState`, `fetchNextSupabaseChunk`) → `data/loader.js`
- [ ] Update consumers, test, commit

#### Day 5: Aggregates & Pricing

- [ ] Extract `fetchGenreAggregates`, `fetchTimelineAggregates` → `data/aggregates.js`
- [ ] Extract `createPriceInsights` and related → `data/pricing.js`
- [ ] Extract price data hydration → `data/pricing.js`
- [ ] Update consumers, test, commit

#### Week 3, Day 1: Storage

- [ ] Extract `resolveStorageCover`, `buildStoragePublicUrl` → `data/storage.js`
- [ ] Extract cover hydration logic → `data/storage.js`
- [ ] Extract Wikipedia fallback → `data/storage.js`
- [ ] Update consumers, test, commit

### Phase 0E: Extract UI (Week 3, Days 2-4)

**Goal**: Separate rendering from logic

#### Day 2: Grid & Modal

- [ ] Extract `renderTable`, `renderGameCard`, `renderWindowedGrid` → `ui/grid.js`
- [ ] Extract `showGameModal`, gallery controls, metadata builders → `ui/modal.js`
- [ ] Update consumers, test, commit

#### Day 3: Filters & Dashboard

- [ ] Extract `setupFilters`, `setupRegionToggle`, typeahead UI → `ui/filters.js`
- [ ] Extract `updateDashboard`, all dashboard widgets → `ui/dashboard.js`
- [ ] Update consumers, test, commit

#### Day 4: Carousel & Theme

- [ ] Extract `initCarouselControls`, `updateCarouselButtons` → `ui/carousel.js`
- [ ] Extract `initThemeToggle`, `applyThemeChoice` → `ui/theme.js`
- [ ] Extract `updateTrendingCarousel` → `ui/carousel.js`
- [ ] Update consumers, test, commit

### Phase 0F: Extract Features (Week 3, Day 5 + Week 4, Days 1-2)

**Goal**: Isolate complex feature logic

#### Day 5: Virtualization & Pagination

- [ ] Extract all virtualization state/logic → `features/virtualization.js`
- [ ] Extract pagination/infinite scroll → `features/pagination.js`
- [ ] Update consumers, test, commit

#### Week 4, Day 1: Search & Sharing

- [ ] Extract typeahead logic → `features/search.js`
- [ ] Extract share codes, backup/restore → `features/sharing.js`
- [ ] Update consumers, test, commit

#### Week 4, Day 2: Sorting & Filtering

- [ ] Extract `compareRows`, `applySortSelection`, `toggleSort` → `features/sorting.js`
- [ ] Extract `applyFilters`, `doesRowMatchFilters` → `features/filtering.js`
- [ ] Update consumers, test, commit

### Phase 0G: Testing & Cleanup (Week 4, Days 3-5)

**Goal**: Ensure quality and completeness

#### Day 3: Test Updates

- [ ] Update `tests/app.test.js` to import from modules
- [ ] Add `tests/utils/*.test.js` for utilities
- [ ] Add `tests/state/*.test.js` for state management
- [ ] Verify all tests passing
- [ ] Check test coverage (target 60%)

#### Day 4: Documentation

- [ ] Complete `docs/architecture.md` with actual structure
- [ ] Update `docs/migration-guide.md` with lessons learned
- [ ] Update `.github/copilot-instructions.md` with new patterns
- [ ] Update `CONTRIBUTING.md` with module examples
- [ ] Create module README templates if needed

#### Day 5: Final Cleanup

- [ ] Remove all extracted code from old `app.js`
- [ ] Verify old `app.js` is now just exports/compatibility layer
- [ ] Delete any dead code
- [ ] Run full lint/test/e2e suite
- [ ] Performance smoke test (should be same or better)
- [ ] Create before/after metrics report
- [ ] Celebrate! 🎉

## Success Criteria

### Must Have

- ✅ All existing tests passing
- ✅ Zero functional regressions
- ✅ No file exceeds 500 lines
- ✅ No function exceeds 50 lines
- ✅ ESLint completes successfully in <10 seconds
- ✅ Test coverage ≥60%

### Should Have

- ✅ Clear module documentation
- ✅ Migration guide completed
- ✅ Performance maintained or improved
- ✅ No new linting warnings

### Nice to Have

- ✅ Improved test coverage (>70%)
- ✅ Performance improvements documented
- ✅ Contributor onboarding guide updated
- ✅ Architecture decision records (ADRs)

## Risk Mitigation

### Feature Freeze

**During refactoring**: Only critical bug fixes allowed, no new features

### Incremental PRs

**Strategy**: One track = one PR (reviewable size)

### Testing Strategy

- Run full test suite after each module extraction
- Daily E2E smoke tests
- Performance regression tests weekly

### Rollback Plan

- Keep old `app.js` as compatibility layer until Phase 0G complete
- Each PR can be reverted independently
- Feature flags for new module usage if needed

### Communication

- Daily standup updates on progress
- Document blockers immediately
- Pair program on first few modules
- Code review within 24 hours

## Post-Refactoring Benefits

### Developer Experience

- **Onboarding**: New devs can understand one module at a time
- **Testing**: Easy to test individual features in isolation
- **Debugging**: Smaller files, clearer stack traces
- **Tooling**: Linters and IDEs work fast again

### Code Quality

- **Maintainability**: Changes isolated to relevant modules
- **Testability**: Higher coverage, easier mocking
- **Readability**: Clear boundaries and responsibilities
- **Reusability**: Utility modules can be used anywhere

### Team Velocity

- **Parallel Work**: Multiple devs can work without conflicts
- **Faster Reviews**: Smaller, focused PRs
- **Less Tech Debt**: Issues caught earlier
- **Better Architecture**: Clear patterns for new features

## Next Steps After Phase 0

Once refactoring is complete, we can:

1. **Increase Test Coverage** (Target 80%)
2. **CSS Modularization** (Extract theme variables, component styles)
3. **Type Safety** (Consider TypeScript or stricter JSDoc)
4. **Performance Optimization** (Profile with clean modules)
5. **New Features** (From Phase 2-4 roadmap)

## Questions & Decisions

### Q: Why not use a bundler?

**A**: Project principle is no-build-step. ES6 modules work natively in all modern browsers. Can add bundler later if needed.

### Q: What about backwards compatibility?

**A**: Keep old `app.js` as thin compatibility layer until migration complete. No external API changes.

### Q: How do we handle circular dependencies?

**A**: Use events/callbacks or dependency injection. Document in `architecture.md`.

### Q: What if a module gets too big?

**A**: Split it further. Target is <500 lines per file.

### Q: How do we decide what goes in which module?

**A**: Follow single responsibility principle. When in doubt, consult architecture doc or ask team.

---

**Document Owner**: Development Team  
**Last Updated**: December 2025  
**Next Review**: After Phase 0G completion
