# External Data Sources Guide

_Last updated: December 2025_

## Overview

The Universal Games Atlas aggregates game metadata from multiple authoritative sources. This guide documents how to set up and configure each data source within your **$10/month budget**.

## Data Source Comparison

| Source        | Cost       | Rate Limit | Coverage    | Best For                       |
| ------------- | ---------- | ---------- | ----------- | ------------------------------ |
| **RAWG.io**   | Free       | 10k/month  | 800k+ games | Modern games, Steam, consoles  |
| **IGDB**      | Free       | 4 req/sec  | 300k+ games | Authoritative metadata, covers |
| **GiantBomb** | Free       | 1k/hour    | 80k+ games  | Descriptions, reviews          |
| **MobyGames** | $20+/month | Varies     | 100k+ games | ❌ Over budget                 |
| **Wikipedia** | Free       | Respectful | Varies      | Supplementary info             |

### Recommended Setup (Budget: $10/month)

1. **Primary**: RAWG.io (free, excellent coverage)
2. **Secondary**: IGDB (free with Twitch, authoritative)
3. **Tertiary**: GiantBomb (free, good descriptions)

**Total cost: $0/month** ✅

---

## RAWG.io Setup

RAWG is the **recommended primary source** due to its generous free tier and excellent modern game coverage.

### 1. Get API Key

1. Go to [rawg.io/apidocs](https://rawg.io/apidocs)
2. Click "Get API Key"
3. Create account (free)
4. Copy your API key

### 2. Configure

Add to your `.env` file:

```bash
RAWG_API_KEY=your-api-key-here
```

### 3. API Usage

**Endpoint:** `https://api.rawg.io/api/games`

**Example Request:**

```bash
curl "https://api.rawg.io/api/games?key=YOUR_KEY&search=zelda&page_size=20"
```

**Response Fields:**

```json
{
  "id": 3328,
  "slug": "the-witcher-3-wild-hunt",
  "name": "The Witcher 3: Wild Hunt",
  "released": "2015-05-18",
  "background_image": "https://...",
  "rating": 4.66,
  "metacritic": 92,
  "platforms": [{ "platform": { "id": 4, "name": "PC" } }],
  "genres": [{ "id": 4, "name": "Action" }],
  "esrb_rating": { "id": 4, "name": "Mature" }
}
```

### 4. Field Mapping

| RAWG Field                   | Our Schema         | Notes                      |
| ---------------------------- | ------------------ | -------------------------- |
| `name`                       | `game_name`        | Direct map                 |
| `platforms[0].platform.name` | `platform`         | First platform             |
| `released`                   | `release_year`     | Extract year               |
| `genres[0].name`             | `genre`            | First genre                |
| `rating`                     | `rating`           | Scale 1-5, convert to 1-10 |
| `metacritic`                 | `metacritic_score` | Direct map                 |
| `background_image`           | `cover`            | High-res cover             |
| `esrb_rating.name`           | `esrb_rating`      | Direct map                 |
| `description_raw`            | `description`      | From detail endpoint       |

### Rate Limits

- **Free tier**: 10,000 requests/month
- **Recommendation**: 300 requests/day is safe
- **Batch size**: 40 games per request (max)

---

## IGDB Setup

IGDB is owned by Twitch and provides authoritative, well-structured game data.

### 1. Create Twitch Application

1. Go to [dev.twitch.tv/console](https://dev.twitch.tv/console)
2. Log in with Twitch account
3. Click "Register Your Application"
4. Fill in:
   - **Name**: "Universal Games Atlas"
   - **OAuth Redirect URLs**: `http://localhost` (not used)
   - **Category**: "Application Integration"
5. Click "Create"
6. Copy your **Client ID**
7. Click "New Secret" and copy your **Client Secret**

### 2. Get Access Token

```bash
curl -X POST "https://id.twitch.tv/oauth2/token" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "grant_type=client_credentials"
```

**Response:**

```json
{
  "access_token": "abc123...",
  "expires_in": 5184000,
  "token_type": "bearer"
}
```

### 3. Configure

Add to your `.env` file:

```bash
TWITCH_CLIENT_ID=your-client-id
TWITCH_CLIENT_SECRET=your-client-secret
IGDB_ACCESS_TOKEN=your-access-token  # Auto-refreshed by service
```

### 4. API Usage

**Endpoint:** `https://api.igdb.com/v4/games`

**Example Request:**

```bash
curl -X POST "https://api.igdb.com/v4/games" \
  -H "Client-ID: YOUR_CLIENT_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d "fields name,summary,cover.url,platforms.name,genres.name,first_release_date,rating; search \"zelda\"; limit 20;"
```

**Response:**

```json
[
  {
    "id": 1025,
    "name": "The Legend of Zelda: Ocarina of Time",
    "summary": "The Legend of Zelda: Ocarina of Time...",
    "cover": {
      "url": "//images.igdb.com/igdb/image/upload/t_cover_big/co1234.jpg"
    },
    "platforms": [{ "name": "Nintendo 64" }],
    "genres": [{ "name": "Adventure" }],
    "first_release_date": 911433600,
    "rating": 96.5
  }
]
```

### 5. Field Mapping

| IGDB Field           | Our Schema     | Notes                        |
| -------------------- | -------------- | ---------------------------- |
| `name`               | `game_name`    | Direct map                   |
| `platforms[0].name`  | `platform`     | First platform               |
| `first_release_date` | `release_year` | Unix timestamp → year        |
| `genres[0].name`     | `genre`        | First genre                  |
| `rating`             | `rating`       | Scale 0-100, convert to 0-10 |
| `cover.url`          | `cover`        | Prepend `https:`             |
| `summary`            | `description`  | Direct map                   |
| `id`                 | `igdb_id`      | Store for linking            |

### Rate Limits

- **Free tier**: 4 requests/second
- **Recommendation**: Use 2 req/sec to be safe
- **Token expires**: ~60 days (auto-refresh)

---

## GiantBomb Setup

GiantBomb provides excellent descriptions and editorial content.

### 1. Get API Key

1. Go to [giantbomb.com/api](https://www.giantbomb.com/api/)
2. Create account (free)
3. Your API key is shown on the API page

### 2. Configure

```bash
GIANTBOMB_API_KEY=your-api-key-here
```

### 3. API Usage

**Endpoint:** `https://www.giantbomb.com/api/games/`

**Example Request:**

```bash
curl "https://www.giantbomb.com/api/games/?api_key=YOUR_KEY&format=json&filter=name:zelda&limit=20"
```

### Rate Limits

- **Free tier**: 1,000 requests/hour
- **Recommendation**: 200 requests/hour is safe

---

## Catalog Ingest Configuration

### Config File: `services/catalog-ingest/config.json`

```json
{
  "scheduleMinutes": 1440,
  "fuzzyThreshold": 0.82,
  "sources": [
    {
      "name": "rawg",
      "url": "https://api.rawg.io/api/games",
      "type": "rawg",
      "priority": 1,
      "enabled": true,
      "headers": {},
      "params": {
        "key": "${RAWG_API_KEY}",
        "page_size": 40,
        "ordering": "-rating"
      }
    },
    {
      "name": "igdb",
      "url": "https://api.igdb.com/v4/games",
      "type": "igdb",
      "priority": 2,
      "enabled": true,
      "headers": {
        "Client-ID": "${TWITCH_CLIENT_ID}",
        "Authorization": "Bearer ${IGDB_ACCESS_TOKEN}"
      },
      "body": "fields name,summary,cover.url,platforms.name,genres.name,first_release_date,rating; limit 100;"
    },
    {
      "name": "giantbomb",
      "url": "https://www.giantbomb.com/api/games/",
      "type": "giantbomb",
      "priority": 3,
      "enabled": false,
      "params": {
        "api_key": "${GIANTBOMB_API_KEY}",
        "format": "json"
      }
    }
  ]
}
```

### Environment Variables

Create `.env` file in project root:

```bash
# RAWG.io (Primary - recommended)
RAWG_API_KEY=your-rawg-key

# IGDB (via Twitch)
TWITCH_CLIENT_ID=your-twitch-client-id
TWITCH_CLIENT_SECRET=your-twitch-secret
IGDB_ACCESS_TOKEN=your-igdb-token

# GiantBomb (Optional)
GIANTBOMB_API_KEY=your-giantbomb-key

# Supabase (for persistence)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Running Ingestion

### One-time Sync

```bash
# Sync from RAWG only
node services/catalog-ingest/catalog-ingest.js \
  --config services/catalog-ingest/config.json \
  --once

# Sync specific source
node services/catalog-ingest/catalog-ingest.js \
  --config services/catalog-ingest/config.json \
  --source rawg \
  --once
```

### Scheduled Sync (GitHub Actions)

Create `.github/workflows/catalog-sync.yml`:

```yaml
name: Catalog Sync

on:
  schedule:
    # Run daily at 3 AM UTC
    - cron: "0 3 * * *"
  workflow_dispatch:
    inputs:
      source:
        description: "Source to sync (rawg, igdb, all)"
        default: "all"

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm ci

      - name: Run ingestion
        env:
          RAWG_API_KEY: ${{ secrets.RAWG_API_KEY }}
          TWITCH_CLIENT_ID: ${{ secrets.TWITCH_CLIENT_ID }}
          TWITCH_CLIENT_SECRET: ${{ secrets.TWITCH_CLIENT_SECRET }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          node services/catalog-ingest/catalog-ingest.js \
            --config services/catalog-ingest/config.json \
            --once
```

---

## Data Quality Rules

### Required Fields

Every game record must have:

- `game_name` (non-empty string)
- `platform` (from allowed list)

### Validation Rules

```javascript
const VALIDATION_RULES = {
  game_name: {
    required: true,
    minLength: 1,
    maxLength: 255,
  },
  platform: {
    required: true,
    allowedValues: [
      // Retro
      "NES",
      "SNES",
      "Nintendo 64",
      "GameCube",
      "Wii",
      "Game Boy",
      "Game Boy Color",
      "Game Boy Advance",
      "Nintendo DS",
      "3DS",
      "Sega Genesis",
      "Sega Saturn",
      "Dreamcast",
      "Master System",
      "PlayStation",
      "PlayStation 2",
      "PlayStation 3",
      "PSP",
      "PS Vita",
      "Xbox",
      "Xbox 360",
      "Atari 2600",
      "Atari 7800",
      "Neo Geo",
      "TurboGrafx-16",
      // Modern
      "Nintendo Switch",
      "PlayStation 4",
      "PlayStation 5",
      "Xbox One",
      "Xbox Series X/S",
      "PC",
      "macOS",
      "Linux",
      "iOS",
      "Android",
      // Other
      "Arcade",
      "VR",
      "Other",
    ],
  },
  release_year: {
    min: 1970,
    max: new Date().getFullYear() + 2,
  },
  rating: {
    min: 0,
    max: 10,
  },
  cover: {
    pattern: /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i,
  },
};
```

---

## Troubleshooting

### IGDB Token Expired

```bash
# Refresh token
curl -X POST "https://id.twitch.tv/oauth2/token" \
  -d "client_id=$TWITCH_CLIENT_ID" \
  -d "client_secret=$TWITCH_CLIENT_SECRET" \
  -d "grant_type=client_credentials"
```

### Rate Limited

Check `data/ingestion-log.json` for error details. Reduce batch size or increase delay between requests.

### Duplicate Detection Failing

Adjust `fuzzyThreshold` in config (default: 0.82). Lower = more aggressive matching.

---

## Monitoring

### Metrics to Track

- Games fetched per source
- Deduplication rate
- API error rate
- Sync duration

### Alerting

Set up GitHub Actions notifications on workflow failure.

---

## Next Steps

1. [ ] Sign up for RAWG.io and get API key
2. [ ] Create Twitch application for IGDB
3. [ ] Add secrets to GitHub repository
4. [ ] Enable catalog-sync workflow
5. [ ] Monitor first sync run
