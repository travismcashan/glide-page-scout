
# Multi-Site Groups Feature

## Status: Phase 1 Complete ✅

### What's Done (Phase 1)
1. **`site_groups` table** — Stores group name, description, timestamps.
2. **`site_group_members` table** — Join table linking groups to crawl_sessions with priority and notes fields. Unique on (group_id, session_id).
3. **`/groups` page** — Lists all groups with member counts, creation dates. "New Group" dialog to create groups.
4. **`/groups/:groupId` page** — Group detail with member sites list, realtime progress tracking via integration_runs, add/remove sites, links to individual results pages.
5. **Navigation** — "Groups" link added to AppHeader.
6. **Routes** — `/groups` and `/groups/:groupId` wired in App.tsx.

### What's Next (Phase 2) — Comparison Dashboard
- Score comparison grid pulling from each member's crawl_sessions data
- Technology matrix (builtwith/wappalyzer data cross-referenced)
- Performance charts (PSI/GTmetrix/CrUX data)
- Side-by-side score cards per site

### Phase 3 — AI Strategy Generation
- New edge function `group-strategy` loading all member sessions' key data
- Generates unified platform recommendation, priority ranking rationale, consolidation roadmap
- Renders as downloadable report or on-screen brief

### Phase 4 — Batch Operations (Deferred)
- Batch URL input on CrawlPage (paste multiple URLs, auto-create group)
- "Run All" to trigger crawl-start for multiple sites
- "Refresh Stale" to re-crawl sites older than N days
- Group-level progress tracking
- Drag-to-reorder priority

### Architecture
```
GroupsPage → list all groups → click to open detail
GroupDetailPage → shows member sites with live progress
  ↓ "Add Site" dialog
  Creates crawl_session → creates site_group_members row
  Fires crawl-start (fire-and-forget)
  ↓
  Realtime subscription on integration_runs
  Shows per-site completion percentage
  Links to individual /sites/:domain results
```
