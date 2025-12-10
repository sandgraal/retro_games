# Catalog Ingest Service

A lightweight Node.js worker that pulls game metadata from external APIs on a schedule, normalizes it into a unified schema, and emits versioned snapshots for the frontend cache.

## Features

- Scheduled ingestion (`scheduleMinutes`) or ad-hoc runs with `--once`.
- Deterministic keys (`title + platform + release_year`) plus fuzzy matching for cross-source de-duplication.
- Merge decisions are persisted to `data/merge-decisions.json` so future runs reuse the same mapping.
- Change detection via SHA-256 hash/version per record; only updates changed entries.
- Ingestion run metrics and snapshot file emitted for every execution.
- Read API (`/api/v1/catalog`) serving the latest snapshot, suitable for CDN caching.

## Usage

```bash
# One-off run using the example configuration
node services/catalog-ingest/catalog-ingest.js --config services/catalog-ingest/config.example.json --once

# Start the read API after seeding snapshots
node services/catalog-ingest/catalog-ingest.js --serve --port 8787
```

### Configuration

Copy `config.example.json` to `config.json` and fill in your API URLs/headers. Each source should return an array of records or an object with a `results` array.

### Data directory

- `data/catalog-store.json` – canonical catalog keyed by deterministic ID with hash/version tracking.
- `data/merge-decisions.json` – fuzzy merge mapping reused between runs.
- `data/ingestion-log.json` – per-run metrics.
- `data/snapshots/` – immutable release snapshots served by the read API.

The files are auto-created on first run; keep them under version control if you want deterministic snapshots.
