# Catalog Ingest Service

A lightweight Node.js worker that pulls game metadata from external APIs on a schedule, normalizes it into a unified schema, and emits versioned snapshots for the frontend cache.

## Features

- Scheduled ingestion (`scheduleMinutes`) or ad-hoc runs with `--once`.
- **IGDB integration** - Twitch OAuth, 200k+ games, 35+ platforms supported
- **RAWG integration** - 500k+ games, broad platform coverage
- **Steam integration** - PC games with pricing, achievements, and player counts
- **GOG integration** - DRM-free PC games with pricing
- Deterministic keys (`title + platform + release_year`) plus fuzzy matching for cross-source de-duplication.
- Merge decisions are persisted to `data/merge-decisions.json` so future runs reuse the same mapping.
- Change detection via SHA-256 hash/version per record; only updates changed entries.
- Ingestion run metrics and snapshot file emitted for every execution.
- Read API (`/api/v1/catalog`) serving the latest snapshot, suitable for CDN caching.

## Usage

```bash
# One-off run with IGDB source (recommended for console games)
IGDB_CLIENT_ID=xxx IGDB_CLIENT_SECRET=xxx node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.igdb.json --once

# One-off run with RAWG source
RAWG_API_KEY=xxx node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.rawg.json --once

# One-off run with Steam source (PC games)
node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.steam.json --once

# One-off run with GOG source (DRM-free PC games)
node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.gog.json --once

# Start the read API after seeding snapshots
node services/catalog-ingest/catalog-ingest.js --serve --port 8787
```

### Data Sources

| Source | Type    | Configuration         | Rate Limit    | Best For                |
| ------ | ------- | --------------------- | ------------- | ----------------------- |
| IGDB   | `igdb`  | `config.igdb.json`    | 4 req/sec     | Console games, all eras |
| RAWG   | `rawg`  | `config.rawg.json`    | 20k req/month | Broad coverage          |
| Steam  | `steam` | `config.steam.json`   | ~200 req/5min | PC games + pricing      |
| GOG    | `gog`   | `config.gog.json`     | ~60 req/min   | DRM-free PC games       |
| Custom | `url`   | `config.example.json` | Varies        | Custom APIs             |

### Configuration

Copy the config file for your preferred source and fill in API credentials via environment variables:

- **IGDB**: Requires `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` from [Twitch Developer Console](https://dev.twitch.tv/console)
- **RAWG**: Requires `RAWG_API_KEY` from [rawg.io/apidocs](https://rawg.io/apidocs)
- **Steam**: No API key required for Store API; uses SteamSpy for discovery
- **GOG**: No API key required; uses public catalog endpoints

### Data directory

- `data/catalog-store.json` – canonical catalog keyed by deterministic ID with hash/version tracking.
- `data/merge-decisions.json` – fuzzy merge mapping reused between runs.
- `data/ingestion-log.json` – per-run metrics.
- `data/suggestions.json` – queued community submissions with author metadata and status.
- `data/audit-log.json` – immutable decision log for moderation actions.
- `data/snapshots/` – immutable release snapshots served by the read API.

The files are auto-created on first run; keep them under version control if you want deterministic snapshots.
