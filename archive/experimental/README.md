# Experimental Modules

These modules were developed as speculative future features but are not currently used in the application:

- **runtime.ts** - High-performance reactive primitives v3 with microtask scheduling, weak references, and diamond dependency handling
- **events.ts** - Event sourcing core with time-travel debugging, undo/redo, and persistent state
- **router.ts** - URL-driven state machine for declarative routing
- **storage.ts** - IndexedDB storage layer for proper local-first database operations
- **worker.ts** - Web Worker helper for offloading computation
- **virtual-list.ts** - High-performance virtualized list with DOM recycling (depends on runtime.ts)

These were moved from `src/` to keep the main source tree focused on production code. The production app uses `src/core/signals.ts` for reactivity and `localStorage` for persistence.

To reactivate any of these modules:

1. Move the file back to `src/core/` (or `src/ui/` for virtual-list)
2. Export from the appropriate index.ts
3. Import and wire into the application
4. Add tests

_Archived: December 2025_
