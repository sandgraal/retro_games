# Contributing Guide

**✅ Phase 0 Refactoring Complete** (December 2025)

The modular architecture refactoring is complete! The monolithic `app.js` (5,940 lines) has been successfully extracted into **34 TypeScript modules** with **472 tests passing** (456 unit + 16 e2e).

**Ready to accept:**

- ✅ New features (following existing patterns)
- ✅ Bug fixes
- ✅ Test additions
- ✅ Documentation improvements
- ✅ Performance optimizations

**See [`docs/implementation-plan.md`](docs/implementation-plan.md) and [`docs/architecture.md`](docs/architecture.md) for details.**

Thanks for keeping the Dragon's Hoard Atlas sharp. This document captures the essential steps to get set up, code safely, and ship reviews quickly.

## 1. Prerequisites

- Node.js 20.19+ and npm.
- Python (or any static server) for local preview.
- Supabase anon key + URL (optional while prototyping; fallback sample data is bundled).

## 2. Local setup

1. `git clone https://github.com/sandgraal/retro-games`
2. `cd retro-games && npm install`
3. Optional: copy `.env.example` to `.env` and fill in Supabase credentials when available.
4. Optional: generate `config.js` with `npm run build:config`.
5. Start dev server: `npm run dev` (http://localhost:3000). For a built preview, use `npm run preview`.

## 3. Coding standards

| Area                     | Expectations                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Formatting & Linting** | Run `npm run format` and `npm run lint` before every push. Never commit `eslint-disable` comments without explaining why.                                                                |
| **TypeScript**           | Prefer pure helpers, keep side effects isolated. Use strict typing with interfaces from `src/core/types.ts`. Avoid `any` types.                                                          |
| **CSS**                  | Reuse CSS custom properties (`--color-*`, `--surface-*`) and component classes; avoid inline styles. Add concise comments only for complex layout tricks.                                |
| **Accessibility**        | All interactive elements need keyboard focus styles and `aria-*` labels when semantics aren’t obvious (e.g., carousels, typeahead). Verify using Playwright tests or manual Tab-through. |
| **State & Persistence**  | Keep `localStorage` keys backwards compatible. When you change stored shapes, write a migration helper and add a unit test covering both old + new payloads.                             |
| **Security & Secrets**   | Never hardcode Supabase keys or share codes in tests. Secrets live in `.env` and flow through `npm run build:config`. CI already runs `gitleaks`; keep it green.                         |
| **Performance**          | Favor lazy rendering paths (virtualized lists, debounced handlers). When adding network calls, debounce/throttle and log via `console.debug` rather than spamming `console.log`.         |

## 4. Test workflow

- `npm test` (Vitest, jsdom) covers filtering, rendering, and helper logic.
- `npm run test:e2e` (Playwright) smoke-tests the modal, gallery, and controls. Run after major UI changes.
- `npm run lint` and `npm run format:check` must pass; CI blocks otherwise.
- `npm run lighthouse` runs the same performance/accessibility assertions enforced in CI.

## 5. Pull request checklist

- [ ] Feature toggles/flags default to safe values.
- [ ] Updated docs (`README.md`, `docs/current-state.md`, plan checkboxes) to reflect new behavior.
- [ ] Added/updated tests for new logic (unit + e2e where applicable).
- [ ] Ran `npm run lint`, `npm run format:check`, `npm test`, `npm run lighthouse`, `npm run test:e2e` (if UI change).
- [ ] Linked related issue/plan row in the PR description.

## 6. Review expectations

- Small PRs (<500 LOC) move fastest; split large changes into phases when possible.
- Highlight any data migrations or Supabase schema changes in the PR body.
- Include reproduction or verification steps so reviewers can validate fixes quickly.
- Call out any assumptions about Supabase availability (sample vs. live data) so reviewers can replicate.

## 7. Reviewer checklist

- [ ] Confirm lint/tests/Playwright status is reported in the PR.
- [ ] Verify accessibility affordances (focus ring, aria labels) for any new UI elements.
- [ ] Validate performance-sensitive paths (search, filters, modals) still feel instant with sample data.
- [ ] Ensure documentation and roadmap checkboxes were updated where applicable.
- [ ] Double-check Supabase schema or config changes against `docs/data-pipeline.md`.

Happy hacking!
