# Agent Quickstart Guide

_Last updated: January 2025_

👋 **Welcome, AI Agent!** This guide helps you quickly understand the Retro Games List project and start contributing effectively.

## 🎯 Project Status at a Glance

- **Application**: ⭐ Feature-complete & production-ready
- **Architecture**: ✅ **REFACTORED** (January 2025) - 29 ES6 modules extracted
- **Tests**: ✅ **954 unit tests + 14 E2E tests passing** (87% coverage)
- **CI/CD**: ✅ Automated (lint, test, security, Lighthouse)
- **Documentation**: ✅ Comprehensive & current
- **Phase 0-2**: ✅ Complete
- **Phase 3 SEO/Content**: ✅ Content Marketing COMPLETE (6/6)

## 📚 Required Reading (Priority Order)

1. **This document** - Project overview & quick start (5 min)
2. **[architecture.md](./architecture.md)** - Complete module inventory (15 min)
3. **[current-state.md](./current-state.md)** - Current status & next steps (10 min)
4. **[implementation-plan.md](./implementation-plan.md)** - Full roadmap Phases 1-4 (20 min)
5. **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Coding standards & workflow (10 min)
6. **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Detailed coding patterns (20 min)

## 🎨 Recent Changes (January 2025)

**Phase 3 Content Marketing COMPLETE**: SEO track complete, content pipeline established, outreach plan drafted

- ✅ **29 ES6 modules** extracted from 5,940-line `app-legacy.js`
- ✅ **7,600+ total lines** across all modules
- ✅ **954 unit tests + 14 E2E tests passing** with 87% coverage
- ✅ **6 UI modules**: dashboard, grid, modal, filters, carousel, theme
- ✅ **8 feature modules**: virtualization, filtering, sorting, search, pagination, sharing, seo, embed
- ✅ **4 state modules**: collection, filters, preferences, cache
- ✅ **5 data modules**: supabase, loader, aggregates, pricing, storage
- ✅ **4 utility modules**: format, validation, keys, dom
- ✅ **1 design module**: tokens
- ✅ **Content pipeline**: Markdown guides with templates (docs/guides/)
- ✅ **Console references**: NES, SNES, N64, Genesis, PS1, PS2 reference pages live
- ✅ **Collecting guides**: NES, SNES, N64, Genesis, PS1, PS2, RPG guides published
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
3. ~~**Embeddable Widgets**~~ ✅ Done (app/features/embed.js)
4. ~~**Community Contribution Workflow**~~ ✅ Done (issue templates + pending_media table)

### Lower Priority: Future Features

- Phase 3 User Growth: Analytics, onboarding, referrals (BLOCKED - requires external services)
- Phase 4: Monetization, marketplace integration (BLOCKED - requires business decisions)

## 🏗️ Architecture Overview

### Current Architecture (January 2025)

```
retro_games/
├── index.html                      # Main entry point
├── style.css                       # Master stylesheet (imports)
├── app/
│   ├── main.js                    # Bootstrap (575 lines)
│   │
│   ├── ui/                        # 6 modules, 2,558 lines
│   │   ├── grid.js                # Grid rendering (639 lines)
│   │   ├── modal.js               # Modal helpers (600 lines)
│   │   ├── dashboard.js           # Stats & calculations (515 lines)
│   │   ├── carousel.js            # Carousel helpers (313 lines)
│   │   ├── theme.js               # Theme switching (259 lines)
│   │   └── filters.js             # Filter UI (232 lines)
│   │
│   ├── features/                  # 8 modules, 2,290 lines
│   │   ├── virtualization.js      # Virtual scrolling (371 lines)
│   │   ├── embed.js               # Embeddable widgets (369 lines)
│   │   ├── filtering.js           # Filter predicates (342 lines)
│   │   ├── seo.js                 # JSON-LD structured data (316 lines)
│   │   ├── search.js              # Search logic (282 lines)
│   │   ├── pagination.js          # Pagination (220 lines)
│   │   ├── sharing.js             # Share codes (219 lines)
│   │   └── sorting.js             # Sort helpers (172 lines)
│   │
│   ├── state/                     # 4 modules, 829 lines
│   │   ├── filters.js             # Filter state (239 lines)
│   │   ├── preferences.js         # User prefs (218 lines)
│   │   ├── collection.js          # Owned state (190 lines)
│   │   └── cache.js               # Cover cache (182 lines)
│   │
│   ├── data/                      # 5 modules, 911 lines
│   │   ├── pricing.js             # Price logic (263 lines)
│   │   ├── loader.js              # Data loading (184 lines)
│   │   ├── supabase.js            # Supabase config (170 lines)
│   │   ├── aggregates.js          # Stats aggregates (156 lines)
│   │   └── storage.js             # Storage helpers (138 lines)
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
├── docs/guides/                   # Content marketing pipeline
│   ├── templates/                 # Guide templates
│   ├── consoles/                  # NES, Genesis, PS2, SNES
│   └── genres/                    # RPG, etc.
│
├── tests/
│   ├── utils.test.js              # 804 tests (all modules)
│   ├── app.test.js                # 25 tests
│   ├── performance.test.js        # 26 tests
│   ├── fetch-covers.test.js       # 48 tests
│   └── e2e/                       # 14 Playwright tests
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
npm test                  # Unit tests (Vitest) - 954 tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report (87%)
npm run test:e2e          # E2E tests (Playwright) - 14 tests
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

## 🐛 Current Status & Next Steps

### ✅ COMPLETE (January 2025)

All Phase 0-3 implementation tasks are complete:

1. **Modal integration** - Modal helpers wired to grid card clicks
2. **Virtualization** - Virtual scrolling integrated with DOM
3. **Coverage tooling** - `@vitest/coverage-v8` installed (87% coverage)
4. **Price integration** - PriceCharting API integration complete
5. **Performance testing** - 26 tests for 10k+ game datasets
6. **Media workflows** - Automated cover import with fallback workers

### Content Library Complete

- **6 Console Reference Guides**: NES, SNES, N64, Genesis, PS1, PS2
- **6 Console Collecting Guides**: NES, SNES, N64, Genesis, PS1, PS2
- **1 Genre Collecting Guide**: RPG
- **Outreach Plan**: Community & influencer strategy documented

### ⛔ BLOCKED (Requires External Services)

- **Phase 3 User Growth**: Analytics, onboarding, referrals - requires PostHog/Segment
- **Phase 4 Monetization**: Requires business decisions on revenue model

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
- ✅ Check implementation-plan.md for task status before starting

### DON'T

- ❌ Reinvent patterns that already exist in modules
- ❌ Skip tests
- ❌ Create circular dependencies between modules
- ❌ Mix multiple concerns in one PR
- ❌ Duplicate constants (use imports)
- ❌ Break existing functionality
- ❌ Work on BLOCKED tasks without external service setup

## 🆘 Getting Unstuck

### Common Questions

**Q: Which task should I work on?**
A: Check `implementation-plan.md` for blocked/unblocked tasks. Most implementation is complete - focus on content expansion or test coverage improvements.

**Q: Where do I find helper functions?**
A: Check the appropriate module in `app/`. Use grep or semantic search to find existing helpers before writing new ones.

**Q: How do I know if a helper exists?**
A: Run `grep -r "export function" app/` to list all exports. Check `architecture.md` for module inventory.

**Q: Should I add TypeScript?**
A: No. Use JSDoc with `@ts-check`. TypeScript requires build step (against project principles).

**Q: Tests are failing after my changes?**
A: Check that you're using the correct imports. Many constants are duplicated across modules for backward compatibility.

**Q: What content can I create?**
A: Check `docs/guides/consoles/README.md` "Coming Soon" section for planned guides. Use templates in `docs/guides/templates/`.

## 📞 Communication

- **Progress updates**: Update roadmap checkboxes in PRs
- **Blockers**: Document in GitHub issues immediately
- **Questions**: Bundle in one message with clear options
- **Decisions**: Record in `docs/architecture.md` as ADRs

## 🎉 Current Status

Phase 0-3 implementation is **complete**. All module extraction and content marketing tasks are done. The codebase is now:

- **29 focused modules** instead of 1 monolithic file
- **954 tests** providing 87% statement coverage
- **Well-documented** with updated architecture docs
- **Content-rich** with 6 console references, 6 collecting guides, and outreach strategy
- **Production-ready** with CI/CD, security, and performance monitoring

### What's Left?

- **Phase 3 User Growth**: BLOCKED on analytics/email service decisions
- **Phase 4 Monetization**: BLOCKED on business decisions
- **Content Expansion**: More console/genre guides per "Coming Soon" list

---

**Remember**: The application is feature-complete. Focus on quality improvements, content expansion, and documentation unless external services are configured for User Growth features.

**Ready to contribute?** → Check [`docs/guides/consoles/README.md`](./guides/consoles/README.md) for content gaps or [`implementation-plan.md`](./implementation-plan.md) for task status.

---

## 🔄 Agent Handoff Protocol

**Starting a new agent session?** Use the standardized handoff prompt in [`../.github/AGENT_HANDOFF_PROMPT.md`](../.github/AGENT_HANDOFF_PROMPT.md).

This ensures:

- You pick up where the previous agent left off
- You work on the highest-priority task
- You know when to stop and create a PR
- You document your stopping point clearly for the next agent
