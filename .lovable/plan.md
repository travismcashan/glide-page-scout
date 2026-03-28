

## Remove Broken Link Checker

The broken link checker is redundant since the URL Discovery tab already shows link status. Here are the ramifications and the removal plan.

### What gets removed
- **`src/components/BrokenLinksCard.tsx`** — delete file
- **`supabase/functions/link-checker/index.ts`** — delete edge function
- **`src/lib/api/firecrawl.ts`** — remove `linkCheckerApi` export

### What gets cleaned up (references in ~8 files)

1. **`src/pages/ResultsPage.tsx`** — the biggest change:
   - Remove import of `BrokenLinksCard`
   - Remove all `linkcheck` state variables (`linkcheckLoading`, `linkcheckFailed`, `linkcheckProgress`, `linkcheckStreamingResults`, `linkcheckRunningRef`, `linkcheckAbortRef`)
   - Remove the `useEffect` that auto-triggers the link checker
   - Remove the `SectionCard` block for "Broken Link Checker"
   - Remove `link-checker` from integration maps, rerun config, pause handlers, loading maps

2. **`src/pages/IntegrationsPage.tsx`** — remove the "Broken Link Checker" entry from the integrations list

3. **`src/lib/siteScore.ts`** — remove `extractBrokenLinks` and `extractUrlHealth` functions; remove the `link-checker` and `url-health` entries from the scoring integrations array

4. **`src/lib/ragIngest.ts`** — remove `linkcheck_data` from the knowledge base ingest map

5. **`src/lib/buildCrawlContext.ts`** — remove `linkcheck_data` field and `extractLinkCheck` function

6. **`src/lib/exportResults.ts`** — remove `linkcheck_data` from the export type and export list

7. **`src/components/KnowledgeChatCard.tsx`** — remove `linkcheck` from source name map, tab routing, and keyword detection

### What stays untouched
- **`linkcheck_data` column in `crawl_sessions`** — leave it in the database; old sessions keep their data, it just won't be displayed. No migration needed.
- **`count_integrations` DB function** — still references `linkcheck_data` for legacy counts, which is fine (it'll count existing data for old sessions)
- **URL Discovery card** — already has its own link checking built into `UrlDiscoveryCard.tsx` with status codes, so no gap in functionality

### Risk
Low. The link checker was a standalone integration with no downstream dependencies beyond display. The URL Discovery card already provides the same broken-link detection inline.

### Files changed: ~8 files edited, 2 files deleted

