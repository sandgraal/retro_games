# API Documentation

_Last updated: December 2025_

## Overview

The Universal Games Atlas provides a comprehensive API for:

1. **Catalog Access** – Query the games database via Supabase or the catalog-ingest read API
2. **Community Submissions** – Submit game additions/edits for moderation
3. **Moderation** – Review and process community submissions (moderators only)
4. **Search** – Full-text and fuzzy search across the catalog

## Authentication

### Access Levels

| Role          | Access                           | How to Obtain              |
| ------------- | -------------------------------- | -------------------------- |
| `anonymous`   | Read catalog, submit suggestions | Default (no auth required) |
| `contributor` | Submit + view own submissions    | Sign up with Supabase Auth |
| `moderator`   | All above + moderation queue     | Assigned by admin          |
| `admin`       | Full access                      | Database admin only        |

### Supabase Authentication

```javascript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient("https://your-project.supabase.co", "your-anon-key");

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "secure-password",
});

// Sign in with GitHub OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: "github",
});

// Get current session
const {
  data: { session },
} = await supabase.auth.getSession();
```

---

## Catalog API

### Supabase Direct Access

#### List Games

```sql
-- Via Supabase client
const { data, error } = await supabase
  .from('games_consolidated')
  .select('*')
  .limit(50);
```

#### Search Games (Full-Text)

```sql
-- Use the search_games function
const { data, error } = await supabase.rpc('search_games', {
  p_query: 'zelda',
  p_limit: 50,
  p_offset: 0,
  p_platform: null,  -- Optional: filter by platform
  p_genre: null      -- Optional: filter by genre
});
```

#### Get Game by ID

```sql
const { data, error } = await supabase
  .from('games')
  .select('*, game_external_ids(*)')
  .eq('id', 123)
  .single();
```

### Catalog Ingest Read API

The catalog-ingest service also exposes a read API for cached snapshots:

```
GET /api/v1/catalog
```

**Response:**

```json
[
  {
    "key": "zelda ocarina of time___nintendo 64",
    "version": 3,
    "hash": "abc123...",
    "record": {
      "title": "The Legend of Zelda: Ocarina of Time",
      "platform": "Nintendo 64",
      "platform_slug": "n64",
      "release_date": "1998-11-21",
      "genres": ["Action", "Adventure"],
      "esrb": "E",
      "assets": {
        "cover": "https://...",
        "screenshots": []
      },
      "external_ids": {
        "igdb": 1234,
        "giantbomb": "3030-12345"
      },
      "source": ["igdb", "community"]
    }
  }
]
```

**Headers:**

- `Cache-Control: public, max-age=300` (5 minutes)

---

## Submissions API

### Submit New Game

**Endpoint:** `POST /api/v1/games/new`

**Authentication:** Optional (anonymous submissions allowed)

**Request:**

```json
{
  "delta": {
    "title": "My Awesome Game",
    "platform": "Steam",
    "genre": "Indie",
    "release_year": 2024,
    "developer": "Indie Studio",
    "description": "A great indie game"
  },
  "notes": "Found this missing from the catalog"
}
```

**Response:**

```json
{
  "suggestion": {
    "id": "uuid-here",
    "type": "new",
    "targetId": null,
    "delta": { ... },
    "status": "pending",
    "author": {
      "role": "anonymous",
      "email": null,
      "sessionId": "sess_abc123"
    },
    "submittedAt": "2025-12-10T12:00:00Z"
  }
}
```

### Submit Edit to Existing Game

**Endpoint:** `POST /api/v1/games/:gameKey/suggestions`

**Request:**

```json
{
  "delta": {
    "description": "Updated description with more accurate info",
    "developer": "Corrected Developer Name"
  },
  "notes": "Fixed typo in developer name"
}
```

**Response:** Same as new game submission

---

## Moderation API

### Get Pending Submissions

**Endpoint:** `GET /api/v1/moderation/suggestions`

**Authentication:** Required (moderator or admin role)

**Query Parameters:**

- `status` – Filter by status: `pending`, `approved`, `rejected` (default: `pending`)

**Response:**

```json
{
  "suggestions": [
    {
      "id": "uuid-here",
      "type": "update",
      "targetId": "zelda___n64",
      "delta": {
        "description": "New description"
      },
      "status": "pending",
      "author": {
        "role": "contributor",
        "email": "user@example.com",
        "sessionId": "user-uuid"
      },
      "submittedAt": "2025-12-10T12:00:00Z",
      "canonical": {
        "title": "The Legend of Zelda",
        "description": "Old description",
        ...
      }
    }
  ]
}
```

### Approve/Reject Submission

**Endpoint:** `POST /api/v1/moderation/suggestions/:id/decision`

**Authentication:** Required (moderator or admin role)

**Request:**

```json
{
  "status": "approved", // or "rejected"
  "notes": "Looks good, verified against IGDB"
}
```

**Response:**

```json
{
  "suggestion": {
    "id": "uuid-here",
    "status": "approved",
    "decidedAt": "2025-12-10T12:30:00Z",
    "moderationNotes": "Looks good, verified against IGDB"
  },
  "audit": {
    "suggestionId": "uuid-here",
    "decision": "approved",
    "moderator": { "role": "moderator", ... },
    "timestamp": "2025-12-10T12:30:00Z"
  }
}
```

### Supabase RPC Functions

For direct database access, use these RPC functions:

```javascript
// Approve submission
const { data, error } = await supabase.rpc("approve_submission", {
  p_submission_id: "uuid-here",
  p_moderation_notes: "Verified against source",
});

// Reject submission
const { data, error } = await supabase.rpc("reject_submission", {
  p_submission_id: "uuid-here",
  p_moderation_notes: "Duplicate entry",
});
```

---

## Database Schema

### Tables

| Table                 | Purpose                                |
| --------------------- | -------------------------------------- |
| `games`               | Core game metadata                     |
| `platforms`           | Platform lookup table                  |
| `genres`              | Genre lookup table                     |
| `game_external_ids`   | Links to external sources (IGDB, etc.) |
| `catalog_submissions` | Community submission queue             |
| `audit_log`           | Immutable moderation history           |
| `ingestion_runs`      | Automated sync tracking                |
| `profiles`            | User profiles with roles               |

### Key Columns: `catalog_submissions`

| Column              | Type        | Description                       |
| ------------------- | ----------- | --------------------------------- |
| `id`                | UUID        | Primary key                       |
| `type`              | enum        | `new`, `update`, `delete`         |
| `target_game_id`    | bigint      | FK to games (for updates)         |
| `target_game_key`   | text        | Compound key for matching         |
| `delta`             | JSONB       | Proposed changes                  |
| `status`            | enum        | `pending`, `approved`, `rejected` |
| `author_id`         | UUID        | FK to auth.users (nullable)       |
| `author_role`       | enum        | `anonymous`, `contributor`, etc.  |
| `author_session_id` | text        | For anonymous tracking            |
| `moderator_id`      | UUID        | Who processed it                  |
| `moderation_notes`  | text        | Moderator's comments              |
| `decided_at`        | timestamptz | When processed                    |

### Key Columns: `audit_log`

| Column           | Type        | Description                  |
| ---------------- | ----------- | ---------------------------- |
| `id`             | UUID        | Primary key                  |
| `submission_id`  | UUID        | FK to catalog_submissions    |
| `entity_type`    | text        | `submission`, `game`, `user` |
| `entity_id`      | text        | Flexible ID                  |
| `action`         | text        | `approved`, `rejected`, etc. |
| `previous_state` | JSONB       | State before action          |
| `new_state`      | JSONB       | State after action           |
| `actor_id`       | UUID        | Who performed action         |
| `reason`         | text        | Explanation                  |
| `created_at`     | timestamptz | Immutable timestamp          |

---

## Rate Limits

| Endpoint           | Anonymous | Authenticated | Moderator |
| ------------------ | --------- | ------------- | --------- |
| Catalog read       | 100/min   | 300/min       | 1000/min  |
| Search             | 30/min    | 100/min       | 500/min   |
| Submit suggestion  | 5/hour    | 50/hour       | N/A       |
| Moderation actions | N/A       | N/A           | 100/min   |

---

## Error Codes

| Code | Meaning                             |
| ---- | ----------------------------------- |
| 400  | Bad request (invalid input)         |
| 401  | Unauthorized (missing/invalid auth) |
| 403  | Forbidden (insufficient role)       |
| 404  | Not found                           |
| 429  | Rate limited                        |
| 500  | Server error                        |

**Error Response Format:**

```json
{
  "error": "Human-readable message",
  "code": "SPECIFIC_ERROR_CODE",
  "details": { ... }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Search games
async function searchGames(query: string) {
  const { data, error } = await supabase.rpc("search_games", {
    p_query: query,
    p_limit: 20,
  });
  return data;
}

// Submit suggestion
async function suggestEdit(gameKey: string, changes: object, notes: string) {
  const { data, error } = await supabase.from("catalog_submissions").insert({
    type: "update",
    target_game_key: gameKey,
    delta: changes,
    notes,
    author_role: "anonymous",
    author_session_id: getSessionId(),
  });
  return data;
}
```

### cURL

```bash
# Search games
curl "https://your-project.supabase.co/rest/v1/rpc/search_games" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"p_query": "zelda", "p_limit": 20}'

# Submit suggestion
curl -X POST "https://your-project.supabase.co/rest/v1/catalog_submissions" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "new",
    "delta": {"title": "New Game", "platform": "Steam"},
    "author_role": "anonymous"
  }'
```

---

## Changelog

| Date       | Change                                     |
| ---------- | ------------------------------------------ |
| 2025-12-10 | Initial API documentation                  |
| 2025-12-10 | Added submissions and moderation endpoints |
| 2025-12-10 | Added full-text search function            |
