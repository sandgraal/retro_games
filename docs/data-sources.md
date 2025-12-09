# Data Sources for Game Enrichment

This document catalogs reliable data sources for enriching the Dragon's Hoard Atlas game database.

## Current Data Status

After the December 2025 cleanup:

| Field            | Coverage | Notes                          |
| ---------------- | -------- | ------------------------------ |
| game_name        | 100%     | All games have names           |
| platform         | 100%     | Standardized (PS1, SNES, etc.) |
| genre            | 100%     | Cleaned N/A values             |
| cover            | 98.7%    | Wikipedia fallback available   |
| release_year     | 87.2%    | Priority for enrichment        |
| rating           | 83.9%    | User ratings                   |
| description      | 37.0%    | Needs external sources         |
| developer        | 37.0%    | Needs external sources         |
| publisher        | 37.0%    | Needs external sources         |
| igdb_id          | 0%       | External ID linking needed     |
| metacritic_score | 0%       | Requires API integration       |

## Recommended Data Sources

### 1. IGDB (Internet Games Database)

**URL**: https://api.igdb.com/v4/  
**Coverage**: Excellent for retro games  
**API**: REST API with OAuth authentication  
**Rate Limits**: 4 requests/second  
**Best For**: descriptions, developers, publishers, release dates, cover art

**Available Fields**:

- `summary` - Short game description
- `storyline` - Full storyline
- `involved_companies` - Developer/Publisher info
- `first_release_date` - Unix timestamp
- `cover` - Cover art URL
- `aggregated_rating` - Combined critic score
- `platforms` - Platform IDs

**API Example**:

```bash
curl -X POST "https://api.igdb.com/v4/games" \
  -H "Client-ID: $TWITCH_CLIENT_ID" \
  -H "Authorization: Bearer $TWITCH_ACCESS_TOKEN" \
  -d "fields name,summary,involved_companies.company.name,first_release_date; search \"Chrono Trigger\";"
```

### 2. MobyGames

**URL**: https://www.mobygames.com/  
**Coverage**: Extensive retro game database  
**API**: https://api.mobygames.com/v1/  
**Rate Limits**: 360 requests/hour (free tier)  
**Best For**: descriptions, credits, screenshots, alternate titles

**Key Endpoints**:

- `/games` - Search games
- `/games/{id}` - Full game details
- `/games/{id}/platforms` - Platform-specific info

### 3. Wikipedia / Wikimedia Commons

**URL**: https://en.wikipedia.org/api/rest_v1/  
**Coverage**: Good for popular titles  
**API**: No authentication required  
**Rate Limits**: Respectful usage (200 req/sec max)  
**Best For**: descriptions, covers, historical context

**Already Implemented**: See `scripts/fetch-covers.js`

**API Example**:

```javascript
const response = await fetch(
  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent("Chrono Trigger (video game)")}`
);
const data = await response.json();
// data.extract contains the description
```

### 4. TheGamesDB

**URL**: https://thegamesdb.net/  
**Coverage**: Strong retro game focus  
**API**: REST API with free tier  
**Best For**: cover art, platform-specific data, alternate titles

### 5. Giant Bomb

**URL**: https://www.giantbomb.com/api/  
**Coverage**: Comprehensive wiki-style database  
**API**: REST API (requires API key)  
**Best For**: in-depth descriptions, franchises, characters

### 6. Metacritic (Web Scraping)

**URL**: https://www.metacritic.com/game/  
**Coverage**: Critic aggregation  
**Note**: No official API - requires careful scraping  
**Best For**: metacritic_score field

### 7. PriceCharting

**URL**: https://www.pricecharting.com/api  
**Coverage**: Market prices for physical games  
**API**: REST API with token  
**Already Implemented**: See `scripts/update-price-snapshots.js`

## Enrichment Priority

### Phase 1: High-Value Canonical Games (Completed ✅)

- Top-rated games (9.0+)
- Popular titles (Chrono Trigger, Zelda, Mario, etc.)
- Manually added descriptions, developers, publishers

### Phase 2: IGDB Integration (Recommended Next Step)

1. Register for Twitch/IGDB API access
2. Create script to:
   - Search IGDB by game name + platform
   - Store `igdb_id` for future syncs
   - Populate `description`, `developer`, `publisher`
   - Get `metacritic`-equivalent scores

### Phase 3: Fill Remaining Gaps

- Games without ratings
- Missing release years
- Cover art gaps

## Implementation Notes

### IGDB Setup

1. Create Twitch Developer account: https://dev.twitch.tv/console
2. Register application to get Client ID
3. Get OAuth token:

```bash
curl -X POST "https://id.twitch.tv/oauth2/token" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "grant_type=client_credentials"
```

### Environment Variables

Add to `.env`:

```
IGDB_CLIENT_ID=your_twitch_client_id
IGDB_CLIENT_SECRET=your_twitch_client_secret
MOBYGAMES_API_KEY=your_mobygames_key
```

### Caching Strategy

All enrichment scripts should:

1. Check local cache before API calls
2. Store successful lookups in `data/enrichment-cache.json`
3. Track misses with 7-day expiry
4. Respect rate limits with delays

## Data Quality Guidelines

1. **Descriptions**: Keep to 2-3 sentences (truncate longer extracts)
2. **Developers**: Use canonical studio names (e.g., "Nintendo EAD" not "Nintendo")
3. **Publishers**: Match against existing publisher list when possible
4. **Dates**: Prefer original release date, note re-releases in `notes` field
5. **Covers**: Prefer box art over promotional images

## Scripts

| Script                          | Purpose                    | Status           |
| ------------------------------- | -------------------------- | ---------------- |
| `scripts/enrich-game-data.js`   | Wikipedia-based enrichment | ✅ Created       |
| `scripts/fetch-covers.js`       | Cover art from Wikipedia   | ✅ Existing      |
| `scripts/igdb-enrichment.js`    | IGDB API integration       | 📋 To be created |
| `scripts/audit-missing-data.js` | Report data gaps           | 📋 To be created |

## Running Enrichment

```bash
# Wikipedia enrichment (existing)
npm run enrich:data -- --limit 50

# Dry run first
npm run enrich:data -- --limit 50 --dry-run

# Future IGDB enrichment
npm run enrich:igdb -- --limit 100
```

## Monitoring Data Health

Run periodic audits:

```sql
-- Data completeness by field
SELECT
    ROUND(100.0 * COUNT(description) / COUNT(*), 1) as desc_pct,
    ROUND(100.0 * COUNT(developer) / COUNT(*), 1) as dev_pct,
    ROUND(100.0 * COUNT(igdb_id) / COUNT(*), 1) as igdb_pct
FROM games WHERE is_canonical = true;
```
