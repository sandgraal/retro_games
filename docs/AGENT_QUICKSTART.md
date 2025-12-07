# Agent Quickstart Guide

_Last updated: December 2025_

👋 **Welcome, AI Agent!** This guide helps you quickly understand the Retro Games List project and start contributing effectively.

## 🎯 Project Status at a Glance

- **Application**: ⭐ Feature-complete & production-ready
- **Architecture**: ✅ **REDESIGNED** (December 2025) - Modular structure with museum-quality UI
- **Tests**: 🟡 Working but coverage low (~12%)
- **CI/CD**: ✅ Automated (lint, test, security, Lighthouse)
- **Documentation**: ✅ Comprehensive

## 📚 Required Reading (Priority Order)

1. **This document** - Project overview & quick start (5 min)
2. **[architecture.md](./architecture.md)** - ✅ **NEW** - Complete architecture documentation (15 min)
3. **[current-state.md](./current-state.md)** - Current status & next steps (10 min)
4. **[implementation-plan.md](./implementation-plan.md)** - Full roadmap Phases 1-4 (20 min)
5. **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Coding standards & workflow (10 min)
6. **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Detailed coding patterns (20 min)

## 🎨 Recent Changes (December 2025)

**Complete Redesign**: Museum-quality visual overhaul with modular architecture

- ✅ New design system with design tokens and glassmorphism
- ✅ Modular CSS architecture (`style/` directory)
- ✅ ES6 modules (`app/main-redesign.js`, `ui/`, `utils/`)
- ✅ Hero dashboard with 6 animated stat cards
- ✅ Masonry grid layout for game showcase
- ✅ Collapsible filters sidebar/drawer
- ✅ Mobile-first responsive design

## 🎯 What to Work On

### Highest Priority: Integration & Testing

1. **Complete Modal Integration** - Wire new modal to game card clicks
2. **Add Test Coverage** - Tests for new UI modules (dashboard, grid, filters)
3. **Verify Functionality** - All features working with new architecture
4. **Archive Legacy Code** - Clean up old `app.js` after verification

### Medium Priority: Feature Completion

1. **Price Data Integration** - Complete PriceCharting integration
2. **Performance Optimization** - Virtualization for 10k+ game datasets
3. **Media Workflows** - Automated cover import and archival
4. **Documentation Updates** - Keep docs in sync with code

### Lower Priority: Future Features

- Phase 2: Advanced media workflows, content preservation
- Phase 3: Community features, SEO, content marketing
- Phase 4: Monetization, marketplace integration

## 🏗️ Architecture Overview

### Current Architecture (December 2025)

```
retro_games/
├── index.html                      # Main entry point
├── style.css                       # Master stylesheet (imports)
├── app/
│   ├── main-redesign.js           # Bootstrap
│   ├── design/tokens.js           # Design tokens
│   ├── ui/                        # UI modules
│   │   ├── dashboard-new.js
│   │   └── grid-new.js
│   └── utils/                     # Utilities
│       ├── dom.js
│       ├── format.js
│       └── keys.js
├── style/
│   ├── tokens.css                 # Design system
│   ├── base.css                   # Base styles
│   ├── utilities.css              # Utilities
│   └── components/                # Components
│       ├── dashboard.css
│       ├── grid.css
│       ├── filters.css
│       ├── modal.css
│       └── cards.css
└── tests/
```

### Legacy Code (To Archive)

```
retro_games/
├── index.html
├── style.css
├── app/
│   ├── main.js (orchestration)
│   ├── state/ (collection, filters, preferences, cache)
│   ├── data/ (supabase, loader, aggregates, pricing, storage)
│   ├── ui/ (grid, modal, filters, dashboard, carousel, theme)
│   ├── features/ (virtualization, pagination, search, sharing, sorting, filtering)
│   └── utils/ (dom, format, validation, keys)
└── tests/ (mirrors app/ structure)
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
npm test                  # Unit tests (Vitest)
npm run test:watch        # Watch mode
npm run test:e2e          # E2E tests (Playwright)
npm run lighthouse        # Performance audit

# Before committing
npm run lint && npm run format:check && npm test
```

## 🧪 Testing Strategy

- **Unit tests** (`tests/*.test.js`): Filter logic, data transformations, helpers
- **E2E tests** (`tests/e2e/*.spec.js`): User workflows, modal interactions
- **Coverage target**: 60% minimum, 80% aspirational
- **Add tests** for each new module during refactoring

## 📋 Task Workflow

1. **Check Phase 0 status** in `refactoring-roadmap.md`
2. **Pick unclaimed track** (or next task in current track)
3. **Create/claim GitHub issue** with clear acceptance criteria
4. **Make minimal changes** - Surgical extraction, not rewrite
5. **Write/update tests** - Verify no regressions
6. **Run full test suite** - Must pass before PR
7. **Update documentation** - Keep roadmap current
8. **Create PR** - Reference issue, include before/after metrics
9. **Get review** - One track = one PR (reviewable size)

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

## 🐛 Known Issues & Technical Debt

### Critical

1. **Monolithic app.js** - 5,940 lines (Phase 0 addresses this)
2. **Low test coverage** - ~12% (target 60%+)
3. **ESLint timeouts** - File too large (fixed by refactoring)

### High

4. **50+ global variables** - Need state management
5. **CSS duplication** - Theme variables repeated
6. **Long functions** - Some exceed 200 lines

### Medium

7. **Type safety** - Inconsistent JSDoc usage
8. **Error handling** - Mixed patterns
9. **Performance** - No systematic monitoring

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

## 🎯 Success Criteria for Phase 0

- ✅ No file exceeds 500 lines
- ✅ No function exceeds 50 lines
- ✅ ESLint completes in <10 seconds
- ✅ Test coverage ≥60%
- ✅ All existing tests passing
- ✅ Zero functional regressions
- ✅ Documentation complete

## 💡 Tips for AI Agents

### DO

- ✅ Read refactoring roadmap FIRST
- ✅ Make minimal, surgical changes
- ✅ Test after each extraction
- ✅ Update documentation inline
- ✅ Ask questions when blocked
- ✅ Follow existing patterns
- ✅ Preserve working functionality

### DON'T

- ❌ Rewrite working code
- ❌ Add new features during Phase 0
- ❌ Skip tests
- ❌ Create circular dependencies
- ❌ Mix multiple concerns in one module
- ❌ Make large PRs (one track at a time)
- ❌ Break existing functionality

## 🆘 Getting Unstuck

### Common Questions

**Q: Which task should I work on?**
A: Check `refactoring-roadmap.md` for unclaimed Phase 0 tasks. Follow the order: Utilities → State → Data → UI → Features.

**Q: How do I know if a module is too big?**
A: Target <500 lines. If you can't describe it in one sentence, split it.

**Q: What if I find a bug while refactoring?**
A: Fix critical bugs immediately. Log minor issues for later.

**Q: Should I add TypeScript?**
A: No. Use JSDoc with `@ts-check`. TypeScript requires build step (against project principles).

**Q: How do I handle circular dependencies?**
A: Use events/callbacks or dependency injection. Document in architecture.md.

**Q: Tests are failing after my changes?**
A: Rollback and extract smaller piece. Run tests more frequently.

## 📞 Communication

- **Progress updates**: Update roadmap checkboxes in PRs
- **Blockers**: Document in GitHub issues immediately
- **Questions**: Bundle in one message with clear options
- **Decisions**: Record in `docs/architecture.md` as ADRs

## 🎉 Phase 0 Completion

When all tracks are done:

1. Performance smoke test (same or better than before)
2. Create before/after metrics report
3. Update all documentation
4. Close Phase 0 milestone
5. Announce feature freeze lift
6. **Celebrate!** 🎊

---

**Remember**: We're not rewriting, we're **reorganizing working code** to make it maintainable. The application is already excellent—we're just making it easier to improve further.

**Ready to start?** → Read [`refactoring-roadmap.md`](./refactoring-roadmap.md) for day-by-day Phase 0 tasks.

---

## 🔄 Agent Handoff Protocol

**Starting a new agent session?** Use the standardized handoff prompt in [`../.github/AGENT_HANDOFF_PROMPT.md`](../.github/AGENT_HANDOFF_PROMPT.md).

This ensures:

- You pick up where the previous agent left off
- You work on the highest-priority task
- You know when to stop and create a PR
- You document your stopping point clearly for the next agent
