# Current State Overview

_Last updated: January 2025_

## Architecture

- Single-page application served as static assets with modular ES6 JavaScript.
- **Museum-quality redesign** (December 2025): Complete visual overhaul from retro arcade to PS2-era sophistication with glassmorphism, masonry grid, and modern design system.
- **Phase 0 refactoring** (January 2025): Complete modular extraction from 5,940-line `app-legacy.js` into 27 focused modules.
- Vanilla JavaScript with modular structure: `app/main.js` (456 lines) bootstraps all modules.
- **27 ES6 modules** across 6 directories: `ui/`, `features/`, `state/`, `data/`, `utils/`, `design/`.
- **488 tests** covering all extracted modules (up from ~120 pre-refactoring).
- Supabase acts as the backing data store with graceful fallback to `data/sample-games.json`.
- No build tooling or bundler; modular CSS architecture with design tokens in `style/` directory.
- See [`docs/architecture.md`](./architecture.md) for complete technical documentation.

## Data Flow

1. `config.js` (ignored by git) exposes `window.__SUPABASE_CONFIG__` with the Supabase URL and anon key.
2. `app.js` instantiates a Supabase client and fetches the first paged chunk (default 400 rows) from the `games` table, ordered alphabetically; additional chunks and filter/search requests are executed server-side so only the relevant rows are hydrated.
   - If Supabase credentials are missing or unreachable, the frontend transparently loads `data/sample-games.json` so the UI stays functional.
3. The dataset populates filter dropdowns and an interactive table. Per-row status (owned, wishlist, backlog, trade) is stored in `localStorage` under the key `roms_owned` and drives both the stats widget and sharing/export flows.
4. Users can export owned titles to CSV, backup their entire collection (statuses, notes, filters) as JSON, or create a share code (base64-encoded JSON). Importing a share code or backup restores a read-only or editable view, respectively.
5. Clicking a row opens a modal with metadata and quick links to Google, YouTube gameplay, and GameFAQs searches.
6. When Supabase is available, dashboard stats/aggregates hydrate on-demand: status metrics fetch only the rows tied to your Owned/Wishlist/Backlog/Trade entries, and the top-genre / release-timeline widgets call lightweight Supabase RPCs (falling back to SQL grouping) so the charts reflect the full dataset without downloading it all.
7. Price snapshots from PriceCharting live in the `game_price_snapshots` table (surfaceable via the `game_price_latest` view). The frontend pulls those lightweight rows to power the new Collection Value dashboard card plus per-game modal insights, falling back to `data/sample-price-history.json` when Supabase or API credentials are unavailable.

## UI & Styling

- Retro-inspired theme built around the "Press Start 2P" Google Font, neon gradients, and glowing accents (`style.css`).
- Responsive adjustments for screens below 800px and 700px adjust layout and modal sizes.
- Filter toolbar now exposes platform, genre, search, status, minimum rating, and release-year range inputs for precise slicing.
- A browse toolbar surfaces batch-size controls, an infinite-scroll vs. paginated toggle, and a live summary (`browseSummary`) so collectors (or crawlers) can load long lists in manageable chunks or deep-link to `?page=X` routes.
- Card rendering is virtualized: only the rows within (or near) the viewport mount, with spacer elements maintaining scroll height for buttery navigation through thousands of entries.
- Accessibility helpers include focus trapping in the modal and keyboard shortcuts (Escape closes modal, Enter triggers import field).
- Table headers are now interactive, enabling ascending/descending sorting per column with keyboard support.
- A dedicated Collection Value card surfaces loose/CIB/new totals per status (Owned/Wishlist/Backlog/Trade) and the latest snapshot timestamp, while the modal presents a price panel with current values plus a sparkline showing recent history for each title.
- The modal now groups metadata into “Release & Rating,” “Gameplay,” and “Regions & Versions” cards so rating tiers, player modes/counts, regions, notes, and reference links are easy to scan instead of living in an undifferentiated list.

## Operational Notes

- Supabase credentials were previously hard-coded; they are now externalised. Without valid credentials the app surfaces a descriptive error.
- `games.csv` provides a snapshot of the canonical dataset for reseeding Supabase or offline work. It is not automatically ingested by the frontend.
- `.github/ISSUE_TEMPLATE` offers generic bug/feature templates but no workflows/CI are configured.
- Legacy HTML/CSS/JS backups are stored in `backups/` for reference when evaluating regressions or historical styling choices.

## Gaps & Risks

### Current Focus Areas

- **Modal integration**: Wire modal component to game card clicks (placeholder at `app/main.js:447`)
- **Legacy cleanup**: ✅ Old `app.js` archived to `archive/app-legacy.js`
- **Module extraction**: ✅ **COMPLETE** - All 5 tracks extracted with 488 tests passing
- **Price data integration**: Complete PriceCharting API integration for modal and dashboard
- **Test coverage**: ✅ 488 tests passing; coverage tooling not installed (@vitest/coverage-v8)
- **Feature completion**: Virtualization helpers extracted; needs DOM wiring for 10k+ games

### Technical Debt

- Modular CSS architecture complete, but could further optimize bundle size
- Some utility functions could be extracted to dedicated modules
- Need comprehensive E2E test coverage for new UI flows
- Documentation for new architecture patterns

### Data & Security

- Data integrity relies on manual Supabase updates—seeding scripts exist but need automation
- Security: Supabase anon key rotation process documented, Gitleaks in CI prevents secret commits
- Accessibility relies on manual QA; Lighthouse CI now enforces thresholds but manual screen reader testing needed

### Performance

- Supabase pagination streams data in 400-row chunks and server-side filters ensure we only hydrate rows matching current query
- Virtualized grid handles large datasets efficiently
- For 10k+ titles with no filters, we eventually download full dataset—could explore more server-side aggregation
- PriceCharting integration adds price data without blocking main UI

## Next Steps

**Highest Priority**:

1. **Complete Modal Integration** - Wire modal component to game card clicks (currently placeholder)
2. **Install Coverage Tooling** - Add @vitest/coverage-v8 to track test coverage metrics
3. **Wire Virtualization** - Connect extracted `features/virtualization.js` to grid rendering

**Medium Priority**:

4. **Price Data Integration** - Complete PriceCharting integration for dashboard and modal
5. **Performance Testing** - Test with 10k+ game datasets to validate virtualization
6. **Media Workflow** - Automated cover import and archival tooling

**Lower Priority**:

7. **Community Features** - User profiles, collection sharing, discussions
8. **Advanced Analytics** - Collection insights, trending games, recommendations

See [`docs/implementation-plan.md`](./implementation-plan.md) for comprehensive roadmap.

## Module Inventory (January 2025)

**27 ES6 modules** totaling 6,670 lines:

| Directory       | Modules | Lines | Purpose                                                                         |
| --------------- | ------- | ----- | ------------------------------------------------------------------------------- |
| `app/ui/`       | 6       | 1,989 | UI rendering (grid, dashboard, modal, filters, carousel, theme)                 |
| `app/features/` | 6       | 1,646 | Feature logic (virtualization, filtering, sorting, search, pagination, sharing) |
| `app/state/`    | 4       | 829   | State management (collection, filters, preferences, cache)                      |
| `app/data/`     | 5       | 721   | Data layer (supabase, loader, aggregates, pricing, storage)                     |
| `app/utils/`    | 4       | 262   | Pure utilities (dom, format, keys, validation)                                  |
| `app/design/`   | 1       | 127   | Design tokens                                                                   |
| `app/main.js`   | 1       | 456   | Bootstrap orchestration                                                         |

**Test Coverage:**

- `tests/utils.test.js`: 460 tests (covers all extracted helpers)
- `tests/app.test.js`: 25 tests (integration tests)
- `tests/archive-media.test.js`: 3 tests
- **Total: 488 tests passing**
