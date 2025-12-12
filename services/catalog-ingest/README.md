# Catalog Ingest Service

A lightweight Node.js worker that pulls game metadata from external APIs on a schedule, normalizes it into a unified schema, and emits versioned snapshots for the frontend cache.

## Features

- Scheduled ingestion (`scheduleMinutes`) or ad-hoc runs with `--once`.
- **IGDB integration** - Twitch OAuth, 200k+ games, 35+ platforms supported
- **RAWG integration** - 500k+ games, broad platform coverage
- Deterministic keys (`title + platform + release_year`) plus fuzzy matching for cross-source de-duplication.
- Merge decisions are persisted to `data/merge-decisions.json` so future runs reuse the same mapping.
- Change detection via SHA-256 hash/version per record; only updates changed entries.
- Ingestion run metrics and snapshot file emitted for every execution.
- Read API (`/api/v1/catalog`) serving the latest snapshot, suitable for CDN caching.

## Usage

```bash
# One-off run with IGDB source (recommended)
IGDB_CLIENT_ID=xxx IGDB_CLIENT_SECRET=xxx node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.igdb.json --once

# One-off run with RAWG source
RAWG_API_KEY=xxx node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.rawg.json --once

# Start the read API after seeding snapshots
node services/catalog-ingest/catalog-ingest.js --serve --port 8787
```

### Data Sources

| Source | Type   | Configuration         | Rate Limit    |
| ------ | ------ | --------------------- | ------------- |
| IGDB   | `igdb` | `config.igdb.json`    | 4 req/sec     |
| RAWG   | `rawg` | `config.rawg.json`    | 20k req/month |
| Custom | `url`  | `config.example.json` | Varies        |

### Configuration

Copy `config.igdb.json` (recommended) or `config.rawg.json` to `config.json` and fill in your API credentials via environment variables:

- **IGDB**: Requires `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` from [Twitch Developer Console](https://dev.twitch.tv/console)
- **RAWG**: Requires `RAWG_API_KEY` from [rawg.io/apidocs](https://rawg.io/apidocs)

### Data directory

- `data/catalog-store.json` – canonical catalog keyed by deterministic ID with hash/version tracking.
- `data/merge-decisions.json` – fuzzy merge mapping reused between runs.
- `data/ingestion-log.json` – per-run metrics.
- `data/suggestions.json` – queued community submissions with author metadata and status.
- `data/audit-log.json` – immutable decision log for moderation actions.
- `data/snapshots/` – immutable release snapshots served by the read API.

The files are auto-created on first run; keep them under version control if you want deterministic snapshots.
