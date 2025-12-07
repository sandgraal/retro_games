# Current State Overview

_Last updated: December 2025_

## Architecture

- Single-page application served as static assets (`index.html`, `style.css`, `app.js`).
- Vanilla JavaScript (5,940 lines) orchestrates DOM rendering, Supabase queries, and browser `localStorage` for owned-game tracking.
- **⚠️ CRITICAL**: Monolithic structure (`app.js`) needs refactoring—see [`docs/refactoring-roadmap.md`](./refactoring-roadmap.md) for detailed plan.
- Supabase acts as the backing data store. The frontend expects a `games` table whose columns match the CSV header (`Game Name`, `Platform`, `Rating`, etc.).
- No build tooling or bundler; assets are edited by hand and delivered directly to the browser via ES6 module syntax support in modern browsers.
- Supabase requests now stream in 400-row pages (configurable) using `.range()`; the UI renders the first chunk immediately and hydrates additional chunks only when the virtualized grid/pagination controls need more data.

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

### Code Organization (CRITICAL 🔴)

- **Monolithic structure**: 5,940-line `app.js` with 218 functions creates unsustainable maintenance burden
- **ESLint timeouts**: File too large for efficient linting
- **High cognitive load**: Impossible to understand entire codebase at once
- **Difficult testing**: Monolithic structure hampers unit testing
- **Contributor friction**: New developers overwhelmed by file size
- **Merge conflicts**: Multiple developers risk conflicts editing same giant file
- **Solution**: See [`docs/refactoring-roadmap.md`](./refactoring-roadmap.md) for 4-week modularization plan

### Technical Debt

- Test coverage only ~12% (22KB tests for 5,940 lines code) - need 60%+ target
- CSS has duplication in theme variables (2,808 lines) - needs DRY refactoring
- Some functions exceed 200 lines (`refreshFilteredView`) - need decomposition
- 50+ global variables scattered - need state management centralization

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

1. **Complete Phase 0 Refactoring** (4 weeks) - Modularize `app.js` into maintainable ES6 modules. See [`docs/refactoring-roadmap.md`](./refactoring-roadmap.md).
2. **Increase Test Coverage** - Target 60% minimum after refactoring makes testing easier.
3. **CSS Refactoring** - DRY up theme variables, consider CSS architecture patterns.

**Medium Priority**: 4. **Media Workflow Completion** - Finish automated cover import, archival tooling per [`docs/implementation-plan.md`](./implementation-plan.md) Phase 2. 5. **Performance Profiling** - Systematic performance monitoring with large datasets (10k+ games). 6. **Type Safety** - Consistent JSDoc or TypeScript integration.

**Lower Priority**: 7. **Community Features** - Per implementation plan Phase 3-4. 8. **Monitoring & Analytics** - User behavior insights respecting privacy.

See [`docs/implementation-plan.md`](./implementation-plan.md) for comprehensive roadmap.
