# ⚠️ DEPRECATED

This `app/` directory contains the legacy JavaScript implementation.

## Status

**The application now uses TypeScript in `src/`.**

- Entry point: `src/main.ts`
- Build: `npm run build` (Vite)
- Tests: `npm test`

## Migration Status

| Directory        | Status               | Replacement                 |
| ---------------- | -------------------- | --------------------------- |
| `app/main.js`    | ❌ Deprecated        | `src/main.ts`               |
| `app/ui/*`       | ❌ Deprecated        | `src/ui/*`                  |
| `app/state/*`    | ❌ Deprecated        | `src/state/store.ts`        |
| `app/data/*`     | ⚠️ Partial migration | Some utilities still used   |
| `app/features/*` | ⚠️ Partial migration | Pure functions still tested |
| `app/utils/*`    | ⚠️ Partial migration | `src/core/keys.ts`          |
| `app/design/*`   | ⚠️ Not migrated      | Design tokens               |

## Why Keep This?

The legacy code still has ~900 tests covering utility functions.
These tests will be migrated to TypeScript incrementally.

## Do Not

- Do **NOT** add new features to `app/`
- Do **NOT** import from `app/` in new code
- Do **NOT** modify `app/main.js` or `app/ui/*`

All new development should happen in `src/`.
