
# Move Crawl Orchestration to Edge Functions

## Status: Phase 1 Complete ✅

### What's Done (Phase 1)
1. **`integration_runs` table** — Created with realtime enabled. Tracks per-integration status (pending/running/done/failed/skipped) per session.
2. **`crawl-start` edge function** — Dispatcher that reads session + paused settings, creates integration_runs rows, and fires all integration edge functions via fire-and-forget fetch.
3. **Shared orchestration helper** (`_shared/orchestration.ts`) — `extractOrchestration()` provides `markRunning/markDone/markFailed` methods that write results to both `crawl_sessions` and `integration_runs`.
4. **3 proof-of-concept edge functions updated** — `builtwith-lookup`, `semrush-domain`, `pagespeed-insights` now accept orchestration params and self-manage their status.
5. **CrawlPage updated** — Calls `crawl-start` after creating a session (fire-and-forget).
6. **ResultsPage realtime subscription** — Subscribes to `integration_runs` changes; when an integration completes server-side, it re-fetches that column and updates local state, preventing duplicate client-side triggers.

### What's Next (Phase 2)
- Update remaining ~17 edge functions with orchestration wrapper (same pattern as builtwith/semrush/psi)
- Remove corresponding client-side `useEffect` triggers from ResultsPage for orchestrated integrations
- Add dependency-chain logic: batch 2 functions check prerequisites before executing
- Add retry logic for failed integrations

### Architecture
```
CrawlPage → creates session → invokes crawl-start (fire-and-forget)
                                    ↓
                        crawl-start reads session + settings
                        creates integration_runs rows (all pending)
                        fires each edge function with _orchestrated params
                                    ↓
                        Each edge function:
                          1. markRunning() → updates integration_runs
                          2. Does its work (external API call)
                          3. markDone(result) → writes to crawl_sessions + integration_runs
                             OR markFailed(msg) → writes error sentinel + integration_runs
                                    ↓
                        ResultsPage subscribes to integration_runs via Realtime
                        On 'done' → re-fetches that column, updates local state
                        On 'failed' → sets error state
```

### Dual-path (transitional)
Currently both paths are active:
- **Server-side**: crawl-start fires integrations that have orchestration support
- **Client-side**: useEffect triggers still run as fallback for all integrations
- The triggered refs prevent double-execution: if server completes first, the ref is set and client skips; if client fires first, data exists and server skips

This will be collapsed to server-only in Phase 3-4.
