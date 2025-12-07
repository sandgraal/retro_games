# Implementation Plan – World-Class Retro Games Hub

_Last updated: January 2025_

## Purpose

This document operationalizes the high-level implementation plan into actionable, bite-sized tasks so any contributor (human or AI agent) can understand what to build next. It should be read alongside [`docs/current-state.md`](./current-state.md) for baseline architecture details and the Phase 0 section below for the critical modularization work.

## Guiding Principles

- **Performance-first** – Prioritize sub-second interactions for datasets of 10k+ games through efficient data access, virtualized rendering, and Core Web Vitals monitoring.
- **Local-first with optional cloud sync** – Ensure the experience works entirely offline with seamless Supabase-backed synchronization for persistence and multi-device usage.
- **Collector-centric UX** – Design every feature to help collectors manage, value, and share their collections.
- **Operational excellence** – Maintain high code quality via automated testing, CI, observability, and clear contributor workflows.
- **Maintainable architecture** – Keep codebase modular, testable, and approachable for new contributors.
- **Retro-inspired modern UI** – Blend nostalgic visual cues with accessible, responsive design.
- **Preservation & archival** – Capture and safeguard rare media, metadata, and historical context for retro titles.
- **Comprehensive & unified platform** – Combine metadata, pricing, collection management, and community features into a cohesive hub.

## Roadmap Structure

Work is organized into five build phases plus operational cadences. Each phase is subdivided into tracks with goal statements, exit criteria, and granular tasks. Tracks can run in parallel when dependencies are satisfied.

**✅ UPDATE: Phase 0 Complete (January 2025)** - All 5 tracks extracted with 488 tests passing. See [`docs/architecture.md`](./architecture.md) for complete module inventory.

### Phase 0 – Architecture Redesign ✅ **COMPLETE**

**Objective**: Transform application with maintainable modular architecture and museum-quality design.

**Status**: COMPLETE (January 2025)

**Final Metrics**:

- **27 ES6 modules** extracted from 5,940-line `app-legacy.js`
- **6,670 total lines** across all modules
- **488 tests passing** (up from ~120 pre-refactoring)
- **No file exceeds 500 lines** (largest: `ui/dashboard.js` at 493 lines)
- **All 5 tracks complete** with full test coverage

**Achievements**:

- ✅ Complete visual redesign from retro arcade to museum-quality gallery aesthetic
- ✅ Modular CSS architecture with design tokens in `style/` directory
- ✅ ES6 module structure with `app/main.js` bootstrap (456 lines)
- ✅ UI modules: `ui/dashboard.js`, `ui/grid.js`, `ui/modal.js`, `ui/filters.js`, `ui/carousel.js`, `ui/theme.js`
- ✅ Feature modules: `features/virtualization.js`, `features/filtering.js`, `features/sorting.js`, `features/search.js`, `features/pagination.js`, `features/sharing.js`
- ✅ State modules: `state/collection.js`, `state/filters.js`, `state/preferences.js`, `state/cache.js`
- ✅ Data modules: `data/supabase.js`, `data/loader.js`, `data/aggregates.js`, `data/pricing.js`, `data/storage.js`
- ✅ Utility modules: `utils/format.js`, `utils/validation.js`, `utils/keys.js`, `utils/dom.js`
- ✅ Design tokens: `design/tokens.js`
- ✅ Glassmorphism design system with PS2 cyan accents
- ✅ Masonry grid layout for game showcase
- ✅ 6-card hero dashboard with animated stats
- ✅ Collapsible filter sidebar (desktop) and drawer (mobile)
- ✅ Mobile-first responsive design with bottom navigation
- ✅ Legacy code archived to `archive/app-legacy.js`

**📖 See [`docs/architecture.md`](./architecture.md) for complete technical documentation.**

| Track                          | Goal                            | Exit Criteria                                                        | Key Deliverables                                                                                                                                    | Status |
| ------------------------------ | ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Module Structure Setup**     | Create organizational framework | Folder structure created, module loading working                     | `app/` directory with `main.js`, `state/`, `data/`, `ui/`, `features/`, `utils/` subdirectories                                                     | ✅     |
| **Extract Utilities**          | Isolate pure functions first    | All utility functions in dedicated modules, tests passing            | `utils/dom.js`, `utils/format.js`, `utils/validation.js`, `utils/keys.js`                                                                           | ✅     |
| **Extract State Management**   | Centralize application state    | All state in modules, localStorage abstraction complete              | `state/collection.js`, `state/filters.js`, `state/preferences.js`, `state/cache.js`                                                                 | ✅     |
| **Extract Data Layer**         | Isolate all external I/O        | Clean API boundary, Supabase logic isolated, tests mock easily       | `data/supabase.js`, `data/loader.js`, `data/aggregates.js`, `data/pricing.js`, `data/storage.js`                                                    | ✅     |
| **Extract UI Modules**         | Separate rendering from logic   | Each UI component in own file, clean interfaces                      | `ui/grid.js`, `ui/modal.js`, `ui/filters.js`, `ui/dashboard.js`, `ui/carousel.js`, `ui/theme.js`                                                    | ✅     |
| **Extract Feature Modules**    | Isolate complex feature logic   | Features independently testable, clear boundaries                    | `features/virtualization.js`, `features/pagination.js`, `features/search.js`, `features/sharing.js`, `features/sorting.js`, `features/filtering.js` | ✅     |
| **Update Test Infrastructure** | Tests work with new structure   | All tests passing, coverage maintained/improved                      | Module-specific tests, integration tests, 488 tests passing                                                                                         | ✅     |
| **Documentation & Cleanup**    | Clear handoff to next phase     | Architecture documented, old code archived, migration guide complete | `docs/architecture.md`, updated contributing docs, `archive/app-legacy.js`                                                                          | ✅     |

**Success Metrics for Phase 0** (All achieved ✅):

- ✅ No file exceeds 500 lines (largest: `ui/dashboard.js` at 493 lines)
- ✅ No function exceeds 50 lines
- ✅ ESLint completes in <10 seconds
- ✅ Test coverage: 488 tests passing
- ✅ All existing tests passing
- ✅ Zero regressions in functionality
- ✅ Documentation complete

**Risk Mitigation**:

- Feature freeze during refactoring (only bug fixes)
- Daily smoke tests on staging
- Incremental PR strategy (one track at a time)
- Pair with senior dev for first module extraction
- Keep `app.js` as fallback until migration complete

---

### Phase 1 – Foundation Hardening (COMPLETE ✅)

| Track                   | Goal                                  | Exit Criteria                                                                                                            | Bite-Sized Tasks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration & Secrets | Secure, repeatable environment setup. | Supabase keys rotated, configuration injected at build, onboarding doc published.                                        | - [x] Add `.env.example` with Supabase vars.<br>- [x] Add build step (Vite or similar) that consumes env vars and outputs `config.js`.<br>- [x] Document setup in `docs/setup.md`.<br>- [x] Script to rotate Supabase service/anon keys and update secrets store (`node scripts/rotate-supabase-keys.js`).<br>- [x] Enable Row Level Security, define roles & policies (see migration).<br>- [x] Add CI job that fails if secrets accidentally committed (secret scan).                                                                                                                                                                                                                                                                       |
| Developer Experience    | Guardrails for consistency.           | ESLint + Prettier enforced, TypeScript/JSDoc adopted, unit/E2E testing baseline in place, GitHub Actions pipeline green. | - [x] Introduce tooling (ESLint, Prettier) with configs.<br>- [x] Convert critical modules to TypeScript or add JSDoc types.<br>- [x] Add Vitest with sample tests (render games table, filter logic).<br>- [x] Add Playwright smoke test (modal open/close).<br>- [x] Configure GitHub Actions to run lint, tests, secret scan.<br>- [x] Update CONTRIBUTING with coding standards & review checklist.<br>- [x] Add CI step that verifies Supabase migrations/RPCs (`supabase db lint` + seed smoke test). CI job: `.github/workflows/ci.yml`’s `supabase-verify` reset spins up Postgres 15, runs `supabase db reset`, seeds via `npm run seed:generate`, and lint-checks migrations so schema drift and RPC failures surface before merge. |
| Data Pipeline & Backend | Reliable Supabase data model.         | Migration files committed, seeding automated from `games.csv`, backup automation documented.                             | - [x] Design normalized schema (tables for games, platforms, genres, media, notes).<br>- [x] Add SQL migrations to repo (Supabase CLI) — see `supabase/migrations/20250107120000_init.sql`.<br>- [x] Write seeding script to import `games.csv` and enrichment data (`scripts/generate-seed-sql.js` → `supabase/seed.sql`).<br>- [x] Add cron or GitHub Action to export database dumps to secure storage (`.github/workflows/db-backup.yml`).<br>- [x] Document recovery playbook and data ownership (`docs/recovery-playbook.md`).                                                                                                                                                                                                          |

### Phase 2 – UX & Feature Enhancements (Weeks 7–16)

Objective: deliver delightful exploration tools and collector workflows.

| Track                   | Goal                                | Exit Criteria                                                                                  | Bite-Sized Tasks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dynamic Exploration     | Fast browsing and discovery.        | Virtualized list implemented, instant search with fuzzy matching, scalable navigation shipped. | - [x] Integrate virtualized list (e.g., `react-virtualized` equivalent in chosen framework).<br>- [x] Add multi-field filters (platform, genre, rating, release range).<br>- [x] Implement typeahead search hitting Supabase indexes.<br>- [x] Add pagination or infinite scroll fallback for SEO-critical routes.<br>- [x] Instrument performance metrics (TTFB, search latency).<br>- [x] Stream Supabase data in bounded pages so the renderer hydrates new chunks only when the user requests them.<br>- [x] Hydrate dashboard/status aggregates via Supabase lookups so high-cardinality queries don’t require downloading the entire dataset.<br>- [x] Expose aggregate RPC endpoints (genres/timeline) through a shared wrapper for future metrics (price data, etc.).                                                                                                                                                                                                                                    |
| Collector Tools         | Empower user collection management. | Users can tag statuses, view dashboards, import/export data, and see valuation insights.       | - [x] Implement owned/wishlist/backlog/trade states persisted per user (local-first + share/import).<br>- [x] Build dashboard components (stats, charts, timelines) – see inline status mix, genre list, and release timeline widgets.<br>- [x] Add CSV/JSON export/import workflows with validation (owned CSV, JSON backup).<br>- [x] Integrate external APIs (PriceCharting) for pricing data.<br>- [x] Display price history charts per game and aggregated totals per user.<br>- [ ] Set up background jobs to refresh pricing data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Content Quality & Media | Rich, accessible content.           | Media gallery, metadata completeness targets defined, region/version details surfaced.         | - [ ] Extend schema for media assets (Supabase Storage/CDN setup).<br>- [x] Build gallery component with alt text requirements (modal carousel + keyboard nav).<br>- [ ] Expand metadata fields (ratings, modes, regions) with UI sections.<br>- [ ] Support region toggles / filters and variant linking.<br>- [ ] Establish contribution workflow for community edits with review queue.<br>- [ ] Add archival strategy (backups for media, checksum verification).<br>- [ ] Implement automated cover import using IGDB or alternative APIs; schedule Supabase Edge Function/cron job to enqueue missing titles, download assets, and persist reviewed URLs in Storage/DB.<br>- [ ] Build Wikipedia/MobyGames fallback worker that refreshes unresolved covers nightly and writes successes back into Supabase and offline JSON datasets.<br>- [x] Add `scripts/audit-missing-covers.js` to list unresolved titles, trigger re-fetch jobs, and surface manual-review issues when automation exhausts sources. |

### Phase 3 – Community & Growth (Weeks 17–26)

Objective: foster engagement, content marketing, and growth loops.

| Track                                   | Goal                                 | Exit Criteria                                                                               | Bite-Sized Tasks                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEO & Web Vitals                        | High visibility and performance.     | Structured data live, sitemap automated, Lighthouse ≥95 sustained.                          | 1. [x] Add JSON-LD for `VideoGame` and `Review` schemas.<br>2. [x] Automate XML sitemap generation & submission instructions.<br>3. Implement SSR/SSG for key pages or prerendering pipeline.<br>4. Optimize assets (lazy loading, code splitting, CDN config).<br>5. [x] Add Lighthouse CI to GitHub Actions with thresholds.                                                               |
| Content Marketing & Community Resources | Authority through editorial content. | Blog/guide hub launched, console reference pages live, publishing cadence established.      | 1. Choose CMS or markdown pipeline for articles.<br>2. Create template for guides & interviews.<br>3. Publish initial set of pillar articles (e.g., console collecting guides).<br>4. Build console reference landing pages with RetroRGB-style info.<br>5. Draft outreach plan to communities and influencers.<br>6. Provide embeddable game info widgets for backlinks.                    |
| User Growth & Retention                 | Sustainable user base.               | Referral program, onboarding flow, notification system, analytics instrumentation complete. | 1. Design onboarding that highlights core value props.<br>2. Implement referral mechanics with incentive tracking.<br>3. Set up email/newsletter tooling (e.g., Resend) with templates.<br>4. Instrument product analytics (PostHog/Segment) respecting privacy.<br>5. Configure usage dashboards for MAU, retention, feature adoption.<br>6. Automate churn alerts and follow-up playbooks. |

### Phase 4 – Monetization & Sustainability (Weeks 27–36)

Objective: ensure long-term viability without compromising trust.

| Track                    | Goal                                   | Exit Criteria                                                                  | Bite-Sized Tasks                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monetization Experiments | Evaluate revenue channels responsibly. | Donation tier live, premium analytics prototype, affiliate integration tested. | 1. Launch transparent donation/Patreon integration with supporter badges.<br>2. Prototype “Pro” analytics dashboard gated by feature flag.<br>3. Integrate affiliate links on wishlist/marketplace entries with disclosures.<br>4. Define advertising policy and pilot unobtrusive placements.<br>5. Collect user feedback on monetization changes and iterate. |
| Marketplace & Trading    | Facilitate collector commerce.         | Trade/sale listings with safety guidelines, alerts for wishlist drops.         | 1. Enable users to list items for trade/sale with status controls.<br>2. Add messaging or contact workflow with spam protections.<br>3. Implement alerts for wishlist price drops or new listings.<br>4. Document moderation & dispute resolution playbooks.<br>5. Audit legal/compliance considerations (taxes, ToS updates).                                  |

## Operational Cadence

- **Per Release** – Follow a release checklist: changelog entry, fresh backup, accessibility regression test, and post-deploy monitoring. Capture media (screenshots/video) for announcement posts.
- **Monthly** – Run automated accessibility audits (Lighthouse/axe), review analytics & Core Web Vitals, publish at least one content piece, and audit community metrics for anomalies.
- **Quarterly** – Perform security reviews (rotate keys, validate backups, dependency scan) and data freshness audits (import new titles, reconcile errors). Conduct performance load test on search and navigation flows.
- **Semi-Annually** – Revisit competitive landscape, run user surveys, recalibrate roadmap priorities (e.g., mobile app, barcode scanning) based on community feedback.

## Success Metrics & Monitoring

Track the following to gauge progress and keep the hub world-class:

- **Speed & Performance** – Sub-second median search/filter response; monitor P95 search latency via RUM dashboards.
- **Accessibility & Quality** – Lighthouse ≥95, zero unresolved high-severity accessibility issues, CI accessibility gate enforced.
- **Community Engagement** – Target 5,000 MAU in year one; ≥50% of active users adding to collections or posting reviews; review queue SLA ≤72 hours.
- **Contribution & Data Completeness** – ≥95% games with cover art, ≥90% with screenshots/video, ≥80% with rich descriptions; monitor weekly contribution counts and revert rates.
- **Content & SEO** – 10% MoM organic traffic growth post content launch; first-page rankings for key retro collecting queries; track time-on-page and backlink growth.
- **User Satisfaction & Retention** – NPS >50, ≥30% of new sign-ups active after 3 months, qualitative feedback praising ease of collection management.

## Task Intake Workflow for Agents

1. **Choose a Track** – Pick the earliest unmet exit criteria in the roadmap, respecting dependencies.
2. **Define a Bite-Sized Deliverable** – Scope work to a 1–2 day effort (e.g., “Add Supabase migration for `platforms` table”).
3. **Update Issue Tracker** – Create or claim an issue summarizing the deliverable, reference this document, and outline acceptance tests.
4. **Execute with Guardrails** – Follow coding standards, write or update tests, and document changes (README/docs) as needed.
5. **Report Back** – On completion, link PRs/issues and update the roadmap status. If blockers arise, bundle questions per the ask policy with clear options and defaults.

By following this plan, contributors can make steady, incremental progress while preserving the strategic vision for a world-class retro games hub.
