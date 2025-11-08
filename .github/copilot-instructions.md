# Copilot Instructions for AI Coding Agents

## Project Overview

**Retro Games List** is a privacy-first, single-page static web app for tracking classic and retro games. Key traits:

- No user registration; all data stays local by default
- Instant search/filter across thousands of games
- Collections are shareable via base64-encoded codes (not URLs or accounts)
- Vanilla JS/CSS/HTML; no build step or frameworks
- Optional Supabase backend for cloud data; gracefully falls back to local CSV

## Data Architecture

### Column Model (from games.csv and Supabase)

Game records use these columns (track these constants in `app.js`):

- `game_name`, `platform`, `genre`, `cover` (image URL), `rating`, plus flexible metadata (release year, region, player mode, etc.)
- Genre field stores comma-separated values for filtering (e.g., "RPG, Tactical RPG")
- Ratings parsed as floats for statistics

### Data Flow

1. **Load Phase**: `fetchGames()` attempts Supabase; if credentials missing, falls back to CSV
2. **Memory**: All games cached in `rawData` array (never re-fetched during session)
3. **Filters Applied**: `applyFilters()` chains platform/genre/search predicates, then applies owned-collection filter
4. **State Persistence**: User's owned games saved to `localStorage[STORAGE_KEY]` (JSON of `{gameKey: true, ...}`)
   - Game key format: `gameName___platformName` (compound key prevents duplicates across platforms)

### Dual View Modes

- **User's Collection**: Shows checkboxes for edit; localStorage persists choices
- **Imported Collection**: Read-only view of shared code's owned games; editing disabled

## File Responsibilities

| File                | Purpose                                          | Patterns                                                                                                                   |
| ------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `index.html`        | DOM scaffold, script/style loading               | Supabase JS loaded via CDN; `config.js` injected as `window.__SUPABASE_CONFIG__`                                           |
| `app.js`            | All logic: fetch, filter, render, modal, sharing | Long procedural file (~422 lines); global state (`rawData`, `owned`, `importedCollection`); event delegation on table rows |
| `config.example.js` | Supabase credentials template                    | Must be copied to `config.js` locally; `.gitignore` protects `config.js`                                                   |
| `games.csv`         | Fallback offline data                            | RFC 4180 CSV; quoted fields for commas in data                                                                             |
| `style.css`         | Retro arcade aesthetic                           | CSS variables for themes; responsive grid/table layouts                                                                    |

## Critical Patterns

### Filtering Logic (app.js ~line 100)

All three filters compose with AND logic:

- Platform filter (exact match on `COL_PLATFORM`)
- Genre filter (parses comma-separated genre field, checks inclusion)
- Search filter (case-insensitive substring across all object values)
- Owned filter (applied only if `importedCollection` or `owned` state exists)

Updates trigger full re-render + stats recalculation. No incremental updates.

### Table Rendering & Interaction (app.js ~line 130)

- Owned checkbox tied to `localStorage` save via `saveOwned()`
- Row click (except on checkbox/link) opens modal
- Row highlighting via CSS class `owned-row` for rows in current collection
- Modal built server-side (no innerHTML injection risk from data fields)

### Collection Sharing (app.js ~line 280)

- Export: Filtered `owned` games → CSV download with escaped quotes
- Share Code: `btoa(encodeURIComponent(ownedKeyArray.join("|")))`
- Import Code: Reverse: `atob()` → decode → split → populate `importedCollection` object
- **Note**: Codes grow large for big collections; no URL shortening implemented

### Modal & Accessibility (app.js ~line 340)

- External links constructed from game data (Google, YouTube, GameFAQs searches)
- Focus trap inside modal; ESC key closes
- Image alt text auto-generated from cover field
- Close button and background click both dismiss

## Setup & Debugging

**First-Time Setup:**

```bash
cp config.example.js config.js
# Edit config.js with real Supabase URL + anonKey
python -m http.server 8080
# Open http://localhost:8080
```

**Offline Development:**
To test without Supabase:

1. Comment out `fetchGames()` call in app.js tail
2. Manually populate `rawData` with parsed CSV or mock data
3. Supabase fallback warning will appear but app loads from CSV

**Debugging Checklist:**

- Console for "Supabase credentials missing" warning
- `owned` object structure: `{"Chrono Trigger___SNES": true, ...}`
- `importedCollection` is `null` unless viewing shared code
- Stats reflect _filtered_ data, not all data
- Check row key generation: `gameName___platformName` with triple underscore

## Conventions & Anti-Patterns

✅ **DO:**

- Preserve offline-first design; cloud is optional enhancement
- Handle missing/malformed data gracefully (null coalescing, empty string checks)
- Use compound game keys (`game___platform`) for ownership tracking to prevent collisions
- Keep CSS minimal; use CSS variables (defined in `:root`) for theming
- Maintain vanilla JS/HTML/CSS stack

❌ **DON'T:**

- Commit `config.js` with real credentials (`.gitignore` protects it)
- Add npm/build tooling without consensus; no bundlers or transpilers
- Store user data server-side without explicit opt-in
- Use innerHTML for dynamic content from Supabase fields
- Refactor table/modal into components without considering backward compatibility

## Roadmap Anchors

Per `docs/implementation-plan.md`:

---

For questions about unclear patterns, review `docs/current-state.md` or `context/context.md`, then ask the user for clarification before proceeding.
