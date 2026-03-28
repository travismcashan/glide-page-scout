

# Multi-Site Groups — Phase 1 Implementation

Builds on the approved plan, incorporating the batch URL input flow.

## Database

Two new tables:

**`site_groups`** — id, name, description, created_at, updated_at

**`site_group_members`** — id, group_id (FK → site_groups), session_id (uuid), priority (int, default 0), notes (text), created_at. Unique on (group_id, session_id).

Both with permissive RLS (matching existing tables).

## CrawlPage — Batch Mode

- Add a "Multi-Site" toggle/button near the URL input
- When active, swap the single URL input for:
  - A group name field (auto-defaults to shared domain or "Untitled Group")
  - A textarea for pasting multiple URLs (one per line)
- On submit:
  1. Create `site_groups` row
  2. For each URL: create `crawl_sessions` row, create `site_group_members` row
  3. Fire `crawl-start` for each session (fire-and-forget, all parallel)
  4. Navigate to `/groups/:groupId`

## New Pages

**`/groups`** — list page showing all groups with member count, newest first
**`/groups/:groupId`** — detail page:
- Group name/description header
- Member sites list with status indicators (subscribes to `integration_runs` for live progress)
- Each row links to its individual `/sites/:domain` results page
- Progress summary ("3/5 sites complete")
- "Add Site" button (enter URL or pick from history)

## New Route in App.tsx

```
/groups → GroupsPage
/groups/:groupId → GroupDetailPage
```

Add navigation link in AppHeader.

## Files Created/Modified

| File | Change |
|------|--------|
| Migration SQL | Create `site_groups` + `site_group_members` tables |
| `src/pages/GroupsPage.tsx` | New — list all groups |
| `src/pages/GroupDetailPage.tsx` | New — group detail with realtime member status |
| `src/pages/CrawlPage.tsx` | Add multi-site toggle + textarea batch input |
| `src/App.tsx` | Add two new routes |
| `src/components/AppHeader.tsx` | Add "Groups" nav link |

## What's Deferred (Phases 2-4)

- Comparison dashboard (tech matrix, performance charts, score grids)
- AI strategy brief generation
- Drag-to-reorder priority
- "Run All" / "Refresh Stale" batch operations

