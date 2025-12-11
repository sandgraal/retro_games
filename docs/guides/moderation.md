# Moderation Guide

_Last updated: December 2025_

## Overview

The Universal Games Atlas uses a community-driven moderation system where users can submit new games or corrections, and moderators review them before they're applied to the catalog.

## Roles & Permissions

| Role            | Permissions                                          |
| --------------- | ---------------------------------------------------- |
| **Anonymous**   | Submit suggestions (rate limited)                    |
| **Contributor** | Submit suggestions, view own submission history      |
| **Moderator**   | View queue, approve/reject, view audit log           |
| **Admin**       | All above + manage users, run ingestion, delete data |

### Role Assignment

Roles are stored in the `profiles.role` column:

```sql
-- Promote user to moderator
UPDATE profiles SET role = 'moderator' WHERE email = 'trusted@example.com';

-- Check current moderators
SELECT id, email, role FROM profiles WHERE role IN ('moderator', 'admin');
```

---

## Submission Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│   Pending   │────▶│  Moderator  │
│  Submits    │     │   Queue     │     │   Reviews   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
             ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
             │  Approved   │           │  Rejected   │           │   Needs     │
             │  → Applied  │           │  → Archived │           │   Revision  │
             └─────────────┘           └─────────────┘           └─────────────┘
```

### Submission Types

1. **New Game** (`type: 'new'`)
   - Adds a game not in the catalog
   - Requires: title, platform (minimum)
2. **Update** (`type: 'update'`)
   - Modifies existing game data
   - Only changed fields in `delta`
3. **Delete** (`type: 'delete'`)
   - Marks game for removal
   - Requires strong justification

---

## Moderation Queue UI

### Accessing the Queue

Navigate to `/moderation` (requires moderator role).

### Queue Features

1. **Filter by status**: pending, approved, rejected
2. **Sort by**: date, author, type
3. **Diff view**: Side-by-side comparison
4. **Bulk actions**: Approve/reject multiple

### Review Checklist

Before approving a submission, verify:

- [ ] **Accuracy**: Is the information correct?
- [ ] **Sources**: Can it be verified (IGDB, Wikipedia, official site)?
- [ ] **Duplicates**: Does this game already exist under a different name?
- [ ] **Completeness**: Are required fields filled?
- [ ] **Formatting**: Consistent with existing data (capitalization, dates)?
- [ ] **Images**: Cover URL is valid and appropriate?

### Decision Guidelines

#### Approve When:

- Information is accurate and verifiable
- Improves existing data quality
- Adds missing games with sufficient metadata
- Fixes clear errors or typos

#### Reject When:

- Information cannot be verified
- Duplicate of existing entry
- Spam or low-quality submission
- Violates content guidelines
- Malicious content or links

#### Request Revision When:

- Minor issues that author can fix
- Missing required information
- Needs source citation

---

## Using the Moderation API

### View Pending Submissions

```javascript
const { data, error } = await supabase
  .from("catalog_submissions")
  .select(
    `
    *,
    games!target_game_id (
      id, game_name, platform, genre, cover
    )
  `
  )
  .eq("status", "pending")
  .order("created_at", { ascending: false });
```

### Approve Submission

```javascript
// Using RPC function (recommended)
const { data, error } = await supabase.rpc("approve_submission", {
  p_submission_id: "uuid-here",
  p_moderation_notes: "Verified against IGDB",
});

// Or manually
const { error } = await supabase
  .from("catalog_submissions")
  .update({
    status: "approved",
    moderator_id: currentUserId,
    moderation_notes: "Verified",
    decided_at: new Date().toISOString(),
  })
  .eq("id", submissionId);
```

### Reject Submission

```javascript
const { data, error } = await supabase.rpc("reject_submission", {
  p_submission_id: "uuid-here",
  p_moderation_notes: "Duplicate of existing entry #1234",
});
```

### View Audit Log

```javascript
const { data, error } = await supabase
  .from("audit_log")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(100);
```

---

## Audit Log

Every moderation decision creates an immutable audit entry:

```json
{
  "id": "uuid",
  "submission_id": "submission-uuid",
  "entity_type": "submission",
  "entity_id": "submission-uuid",
  "action": "approved",
  "previous_state": { "status": "pending" },
  "new_state": { "status": "approved", "game_id": 12345 },
  "actor_id": "moderator-uuid",
  "actor_role": "moderator",
  "reason": "Verified against IGDB",
  "created_at": "2025-12-10T12:30:00Z"
}
```

### Audit Queries

```sql
-- All decisions by a moderator
SELECT * FROM audit_log
WHERE actor_id = 'moderator-uuid'
ORDER BY created_at DESC;

-- Approval rate
SELECT
  action,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM audit_log
WHERE entity_type = 'submission'
GROUP BY action;

-- Recent activity
SELECT
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE action = 'approved') as approved,
  COUNT(*) FILTER (WHERE action = 'rejected') as rejected
FROM audit_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Handling Conflicts with Automated Ingestion

When the catalog-ingest service runs, it may conflict with approved user submissions:

### Conflict Prevention

1. **User patches are prioritized**: The ingestion service checks `is_reconciled` flag
2. **Hash tracking**: Each submission stores `source_hash` of the canonical record
3. **Merge strategy**: User edits overlay ingested data, not replace

### Reconciliation Process

```javascript
// In catalog-ingest.js
async function applyApprovedSuggestions(records, submissions) {
  for (const submission of submissions) {
    if (submission.status !== "approved") continue;
    if (submission.is_reconciled) continue;

    // Apply user delta on top of ingested data
    const key = submission.target_game_key;
    if (records[key]) {
      records[key].record = {
        ...records[key].record,
        ...submission.delta,
      };
    }

    // Mark as reconciled
    await markReconciled(submission.id);
  }
}
```

---

## Content Guidelines

### Acceptable Content

- Accurate game metadata (title, platform, release date)
- Official cover art and screenshots
- Factual descriptions
- Valid external links

### Prohibited Content

- Piracy links or ROM download sites
- Adult content without proper ESRB tagging
- Hate speech or discriminatory content
- Personal attacks or harassment
- Spam or promotional content
- Malware or phishing links

### Image Guidelines

- Cover art should be:
  - Official box art or promotional material
  - Minimum 200x200 pixels
  - HTTPS URLs only
  - No watermarks from third-party sites

---

## Moderation SLA

| Metric               | Target     |
| -------------------- | ---------- |
| Time to first review | < 24 hours |
| Time to decision     | < 72 hours |
| Queue backlog        | < 50 items |

### Escalation Path

1. Standard submissions → Any moderator
2. Disputed decisions → Admin review
3. Policy questions → GitHub Discussion

---

## Reporting & Analytics

### Weekly Moderation Report

```sql
SELECT
  DATE_TRUNC('week', decided_at) as week,
  COUNT(*) as total_decisions,
  COUNT(*) FILTER (WHERE status = 'approved') as approved,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
  AVG(EXTRACT(EPOCH FROM (decided_at - created_at)) / 3600) as avg_hours_to_decision
FROM catalog_submissions
WHERE decided_at IS NOT NULL
GROUP BY week
ORDER BY week DESC
LIMIT 12;
```

### Top Contributors

```sql
SELECT
  COALESCE(p.email, 'Anonymous') as contributor,
  COUNT(*) as submissions,
  COUNT(*) FILTER (WHERE s.status = 'approved') as approved,
  ROUND(
    COUNT(*) FILTER (WHERE s.status = 'approved') * 100.0 / COUNT(*),
    1
  ) as approval_rate
FROM catalog_submissions s
LEFT JOIN profiles p ON s.author_id = p.id
GROUP BY p.email
HAVING COUNT(*) >= 5
ORDER BY approved DESC
LIMIT 20;
```

---

## Troubleshooting

### Submission Stuck in Queue

1. Check RLS policies: `SELECT * FROM catalog_submissions WHERE id = 'uuid'`
2. Verify moderator role: `SELECT role FROM profiles WHERE id = auth.uid()`
3. Check for database errors in Supabase logs

### Audit Log Missing Entries

1. Verify function permissions: `GRANT EXECUTE ON FUNCTION approve_submission TO authenticated`
2. Check trigger is active on submissions table

### Conflict with Ingestion

1. Check `is_reconciled` flag on submission
2. Review `source_hash` to see if canonical data changed
3. Re-approve submission if needed

---

## Quick Reference

### SQL Functions

| Function                             | Purpose                   |
| ------------------------------------ | ------------------------- |
| `approve_submission(id, notes)`      | Approve and apply changes |
| `reject_submission(id, notes)`       | Reject with reason        |
| `search_games(query, limit, offset)` | Full-text search          |

### Key Tables

| Table                 | Purpose          |
| --------------------- | ---------------- |
| `catalog_submissions` | Submission queue |
| `audit_log`           | Decision history |
| `profiles`            | User roles       |
| `games`               | Game catalog     |

### Status Values

- `pending` – Awaiting review
- `approved` – Accepted and applied
- `rejected` – Declined

---

## Next Steps for New Moderators

1. [ ] Get moderator role assigned by admin
2. [ ] Read content guidelines above
3. [ ] Review 5 submissions with experienced moderator
4. [ ] Start processing queue independently
5. [ ] Join #moderation channel for questions
