# Agent Quickstart Guide

_Last updated: December 2025_

👋 **Welcome, AI Agent!** This guide helps you quickly understand the Retro Games List project and start contributing effectively.

## 🎯 Project Status at a Glance

- **Application**: ⭐ Feature-complete & production-ready
- **Architecture**: ✅ **REFACTORED** (January 2025) - 28 ES6 modules extracted
- **Tests**: ✅ **815 unit tests + 14 E2E tests passing** (78% coverage)
- **CI/CD**: ✅ Automated (lint, test, security, Lighthouse)
- **Documentation**: ✅ Comprehensive & current

## 📚 Required Reading (Priority Order)

1. **This document** - Project overview & quick start (5 min)
2. **[architecture.md](./architecture.md)** - Complete module inventory (15 min)
3. **[current-state.md](./current-state.md)** - Current status & next steps (10 min)
4. **[implementation-plan.md](./implementation-plan.md)** - Full roadmap Phases 1-4 (20 min)
5. **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Coding standards & workflow (10 min)
6. **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Detailed coding patterns (20 min)

## 🎨 Recent Changes (December 2025)

**Phase 0-1 Complete**: All module extraction finished with comprehensive test coverage

- ✅ **28 ES6 modules** extracted from 5,940-line `app-legacy.js`
- ✅ **7,200+ total lines** across all modules
- ✅ **815 unit tests + 14 E2E tests passing** with 78% coverage
- ✅ **6 UI modules**: dashboard, grid, modal, filters, carousel, theme
- ✅ **7 feature modules**: virtualization, filtering, sorting, search, pagination, sharing, seo
- ✅ **4 state modules**: collection, filters, preferences, cache
- ✅ **5 data modules**: supabase, loader, aggregates, pricing, storage
- ✅ **4 utility modules**: format, validation, keys, dom
- ✅ **1 design module**: tokens
- ✅ Legacy code archived to `archive/app-legacy.js`

## 🎯 What to Work On

### Highest Priority: Content & Media

1. ~~**Complete Modal Integration**~~ ✅ Done
2. ~~**Wire Virtualization**~~ ✅ Done
3. ~~**Install Coverage Tooling**~~ ✅ Done
4. ~~**Price Data Integration**~~ ✅ Done
5. ~~**Performance Testing**~~ ✅ Done (26 tests for 10k+ datasets)
6. ~~**Media Archival Strategy**~~ ✅ Done (media-archive.yml workflow)

### Medium Priority: Feature Completion

1. ~~**E2E Test Expansion**~~ ✅ Done (14 tests)
2. ~~**Cover Import Automation**~~ ✅ Done (cover-refresh.yml workflow)
3. **Community Contribution Workflow** - Edits with review queue

### Lower Priority: Future Features

- Phase 2: Advanced media workflows, content preservation
- Phase 3: Community features, SEO, content marketing
- Phase 4: Monetization, marketplace integration

## 🏗️ Architecture Overview

### Current Architecture (January 2025)

```
retro_games/
├── index.html                      # Main entry point
├── style.css                       # Master stylesheet (imports)
├── app/
│   ├── main.js                    # Bootstrap (456 lines)
│   │
│   ├── ui/                        # 6 modules, 1,989 lines
│   │   ├── dashboard.js           # Stats & calculations (493 lines)
│   │   ├── grid.js                # Grid rendering (453 lines)
│   │   ├── carousel.js            # Carousel helpers (313 lines)
│   │   ├── theme.js               # Theme switching (259 lines)
│   │   ├── modal.js               # Modal helpers (240 lines)
│   │   └── filters.js             # Filter UI (232 lines)
│   │
│   ├── features/                  # 6 modules, 1,646 lines
│   │   ├── virtualization.js      # Virtual scrolling (371 lines)
│   │   ├── filtering.js           # Filter predicates (342 lines)
│   │   ├── search.js              # Search logic (282 lines)
│   │   ├── pagination.js          # Pagination (220 lines)
│   │   ├── sharing.js             # Share codes (219 lines)
│   │   └── sorting.js             # Sort helpers (212 lines)
│   │
│   ├── state/                     # 4 modules, 829 lines
│   │   ├── filters.js             # Filter state (239 lines)
│   │   ├── preferences.js         # User prefs (218 lines)
│   │   ├── collection.js          # Owned state (190 lines)
│   │   └── cache.js               # Cover cache (182 lines)
│   │
│   ├── data/                      # 5 modules, 721 lines
│   │   ├── pricing.js             # Price logic (263 lines)
│   │   ├── loader.js              # Data loading (184 lines)
│   │   ├── aggregates.js          # Stats aggregates (163 lines)
│   │   ├── supabase.js            # Supabase config (70 lines)
│   │   └── storage.js             # Storage helpers (41 lines)
│   │
│   ├── utils/                     # 4 modules, 262 lines
│   │   ├── format.js              # Formatting (162 lines)
│   │   ├── validation.js          # Validation (46 lines)
│   │   ├── keys.js                # Game keys (30 lines)
│   │   └── dom.js                 # DOM helpers (24 lines)
│   │
│   └── design/
│       └── tokens.js              # Design tokens (127 lines)
│
├── archive/
│   └── app-legacy.js              # Archived (5,940 lines)
│
├── tests/
│   ├── utils.test.js              # 460 tests
│   ├── app.test.js                # 25 tests
│   └── archive-media.test.js      # 3 tests
│
└── style/                         # Modular CSS
    └── components/
```

## 🛠️ Essential Commands

```bash
# Setup (first time)
npm install
cp .env.example .env
# Edit .env with Supabase credentials (or leave empty for sample data)
npm run build:config
python -m http.server 8080

# Development workflow
npm run lint              # Check code quality
npm run lint:fix          # Auto-fix issues
npm run format            # Format code
npm run format:check      # Check formatting
npm test                  # Unit tests (Vitest) - 674 tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report (70.48%)
npm run test:e2e          # E2E tests (Playwright)
npm run lighthouse        # Performance audit

# Before committing
npm run lint && npm run format:check && npm test
```

## 🧪 Testing Strategy

- **Unit tests** (`tests/*.test.js`): Filter logic, data transformations, helpers - **674 tests**
- **E2E tests** (`tests/e2e/*.spec.js`): User workflows, modal interactions
- **Coverage**: 70.48% statement coverage via @vitest/coverage-v8 (`npm run test:coverage`)
- **All module helpers have test coverage**

## 📋 Task Workflow

1. **Check current-state.md** for priority tasks
2. **Pick appropriate task** from "What to Work On" above
3. **Create/claim GitHub issue** with clear acceptance criteria
4. **Follow existing patterns** - Use constants, match code style
5. **Write/update tests** - Verify no regressions
6. **Run full test suite** - Must pass before PR
7. **Update documentation** - Keep docs current
8. **Create PR** - Reference issue, describe changes
9. **Get review** - Keep PRs focused and reviewable

## 🚦 Code Quality Gates

All PRs must pass:

- ✅ ESLint (no new warnings)
- ✅ Prettier formatting
- ✅ Vitest unit tests
- ✅ Gitleaks security scan
- ✅ Lighthouse CI thresholds (performance, a11y, SEO)

## 🎨 Coding Standards

### JavaScript

- **Style**: ESLint + Prettier (auto-formatted)
- **Types**: JSDoc with `@ts-check` for type safety
- **Functions**: <50 lines, single responsibility
- **Files**: <500 lines per module
- **Naming**: `camelCase` for functions/variables, `PascalCase` for classes
- **Constants**: `UPPER_SNAKE_CASE` for true constants

### Testing

- Prefer pure functions for testability
- Mock external dependencies (Supabase, localStorage)
- Test edge cases and error paths
- Use descriptive test names (`it('should render empty state when no games')`)

### Documentation

- JSDoc for public functions
- Inline comments only for complex logic
- Update relevant docs when changing behavior
- Keep roadmap checkboxes current

## 🐛 Known Issues & Next Steps

### High Priority

1. **Modal not wired** - Modal helpers exist in `ui/modal.js` but not connected to grid card clicks
2. **Virtualization not wired** - Helpers in `features/virtualization.js` need DOM integration
3. **Coverage tooling missing** - Need to install `@vitest/coverage-v8`

### Medium Priority

4. **Price integration** - Complete PriceCharting API integration
5. **Performance testing** - Test with 10k+ game datasets
6. **Media workflows** - Automated cover import

See [`current-state.md`](./current-state.md) for complete list.

## 📖 Data Architecture

### Tables (Supabase)

- `games` - Core game metadata
- `platforms` - Console/platform reference
- `genres` - Genre taxonomy
- `game_genres` - Many-to-many join
- `game_media` - Screenshots, box art
- `game_price_snapshots` - PriceCharting data
- `pending_media` - Community contributions (moderation queue)

### Views

- `game_price_latest` - Latest price per game

### RPC Functions

- `rpc_genre_counts` - Genre aggregates
- `rpc_timeline_counts` - Release year aggregates

### localStorage

- `roms_owned` - Game statuses (owned/wishlist/backlog/trade)
- `game_notes` - Personal notes per game
- Various UI preferences (theme, browse mode, etc.)

## 🔒 Security Notes

- **Never commit secrets** - Gitleaks prevents this in CI
- **Use `.env`** for local secrets (gitignored)
- **Rotate keys** with `npm run rotate-keys`
- **Supabase anon key** is public (RLS protects data)
- **Service role key** is SECRET (never expose to client)

## 🎯 Success Criteria for Phase 0 ✅ COMPLETE

All metrics achieved:

- ✅ No file exceeds 500 lines (largest: 493 lines)
- ✅ No function exceeds 50 lines
- ✅ ESLint completes in <10 seconds
- ✅ 674 tests passing with 76% coverage
- ✅ All existing tests passing
- ✅ Zero functional regressions
- ✅ Documentation complete

## 💡 Tips for AI Agents

### DO

- ✅ Read current-state.md and architecture.md first
- ✅ Follow existing module patterns and constants
- ✅ Run tests after each change
- ✅ Update documentation inline
- ✅ Ask questions when blocked
- ✅ Use existing exports from modules
- ✅ Keep PRs focused and reviewable

### DON'T

- ❌ Reinvent patterns that already exist in modules
- ❌ Skip tests
- ❌ Create circular dependencies between modules
- ❌ Mix multiple concerns in one PR
- ❌ Duplicate constants (use imports)
- ❌ Break existing functionality

## 🆘 Getting Unstuck

### Common Questions

**Q: Which task should I work on?**
A: Check `current-state.md` "Next Steps" section. Priority order: Modal wiring → Virtualization wiring → Coverage tooling.

**Q: Where do I find helper functions?**
A: Check the appropriate module in `app/`. Use grep or semantic search to find existing helpers before writing new ones.

**Q: How do I know if a helper exists?**
A: Run `grep -r "export function" app/` to list all exports. Check `architecture.md` for module inventory.

**Q: Should I add TypeScript?**
A: No. Use JSDoc with `@ts-check`. TypeScript requires build step (against project principles).

**Q: Tests are failing after my changes?**
A: Check that you're using the correct imports. Many constants are duplicated across modules for backward compatibility.

## 📞 Communication

- **Progress updates**: Update roadmap checkboxes in PRs
- **Blockers**: Document in GitHub issues immediately
- **Questions**: Bundle in one message with clear options
- **Decisions**: Record in `docs/architecture.md` as ADRs

## 🎉 Current Status

Phase 0 refactoring is **complete**. All module extraction is done. The codebase is now:

- **27 focused modules** instead of 1 monolithic file
- **674 tests** providing 76% statement coverage
- **Well-documented** with updated architecture docs
- **Ready for Phase 2 feature work** (price data, media workflows)

---

**Remember**: We're not rewriting, we're **reorganizing working code** to make it maintainable. The application is already excellent—we're just making it easier to improve further.

**Ready to start?** → Read [`implementation-plan.md`](./implementation-plan.md) for day-by-day Phase 0 tasks.

---

## 🔄 Agent Handoff Protocol

**Starting a new agent session?** Use the standardized handoff prompt in [`../.github/AGENT_HANDOFF_PROMPT.md`](../.github/AGENT_HANDOFF_PROMPT.md).

This ensures:

- You pick up where the previous agent left off
- You work on the highest-priority task
- You know when to stop and create a PR
- You document your stopping point clearly for the next agent
