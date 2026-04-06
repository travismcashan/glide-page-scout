# Connections Complete Map — Current State to Desired State

> Generated 2026-04-05 by connections-planner agent
> Covers all 25+ integrations mapped to Agency Brain Pillar 1 (Connections) + Pillar 2 (Knowledge Base)

---

## Executive Summary

**17 connection pipeline plan cards** created in claude_code_plans. Every integration mapped from current state through desired state with specific gaps and steps to close.

| Priority | Count | Integrations |
|----------|-------|-------------|
| **p0** | 4 | HubSpot, Avoma, Gmail, Slack |
| **p1** | 9 | Apollo, Ocean, Harvest, Asana, Freshdesk, GA4, GSC, Google Drive, Firecrawl |
| **p2** | 4 | BuiltWith, SEMrush, Google Ads (new), Crawl Audit Tools (grouped) |

### Critical Finding: 3 Communication Tables at 0 Rows

The biggest blocker for Agency Brain completeness: `company_emails`, `company_meetings`, and `company_messages` all have 0 rows despite tables AND sync functions existing. Running gmail-sync, avoma-sync, and slack-sync will immediately unlock communication persistence + RAG vectorization.

---

## Data Inventory (Current Row Counts)

| Table | Rows | Source | Status |
|-------|------|--------|--------|
| companies | 2,694 | HubSpot + Harvest + Freshdesk + manual | Active |
| contacts | 2,366 | HubSpot + Apollo + Harvest + Freshdesk | Active |
| deals | 1,128 | HubSpot deals-sync | Active |
| engagements | 2,000 | HubSpot engagements-sync | Active |
| company_emails | **0** | Gmail (sync exists, not run) | **BLOCKED** |
| company_meetings | **0** | Avoma (sync exists, not run) | **BLOCKED** |
| company_messages | **0** | Slack (sync exists, not run) | **BLOCKED** |
| form_submissions | **0** | HubSpot (sync exists, not run) | **BLOCKED** |
| knowledge_documents | 2,290 | Google Drive + uploads + rag-ingest | Active |
| knowledge_chunks | 5,214 | rag-ingest vectorization | Active |
| patterns | 15 | Manual + generate-patterns | Active |
| crawl_sessions | 229 | 30+ crawl integrations | Active |
| harvest_projects | 478 | harvest-sync | Active |
| harvest_time_entries | 10,000+ | harvest-sync | Active |
| harvest_invoices | **0** | harvest-sync (broken?) | **BLOCKED** |
| harvest_invoice_payments | **0** | harvest-sync (broken?) | **BLOCKED** |
| freshdesk_tickets | 3,985 | freshdesk-sync | Active |
| freshdesk_ticket_conversations | 873 | freshdesk-sync | Active |
| asana_projects | 51 | asana-projects-sync | Active |
| oauth_connections | 4 | User OAuth flows | Active |
| integration_runs | 745 | All sync functions | Active |

---

## Connection Map by Integration

### 1. HubSpot (Priority: p0)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Synced (read-only) | Synced (two-way eventually) | Write-back is p2 plan card |
| **Companies** | 1,900 from HubSpot, core fields | All properties including description, phone | Missing: description, phone, notes_last_updated |
| **Contacts** | 2,366 synced, core fields | All fields including mobile, location | Missing: mobilephone, city/state/country |
| **Deals** | 1,128 synced, full properties | Many-to-many contact associations | Only 1:1 deal-contact stored |
| **Engagements** | 2,000 rows, 500 char body | Full body text, all companies | Body truncated to 500 chars |
| **Form Submissions** | Table exists, 0 rows | All submissions synced + surfaced | Sync function exists, not run |
| **Pipeline Stages** | Inline on deals | Dedicated lookup table | No pipeline_stages table |
| **Owners** | Name only in deals.properties | Full owner with email/team | Owner email/team not resolved |
| **KB Vectorized** | No | All engagement + form data | Not wired to rag-vectorize-comms |
| **Edge Functions** | hubspot-lookup, hubspot-deals-sync, hubspot-contacts-sync, hubspot-pipeline, hubspot-sync, hubspot-engagements-sync, hubspot-form-submissions-sync, company-artifacts | Same + scheduled form sync | form-submissions-sync needs pg_cron |

### 2. Apollo.io (Priority: p1)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Static + Synced | Static + Synced + org enrichment | Missing dedicated org endpoint |
| **Person/Match** | Full person profile stored | Same | Complete |
| **Team Search** | Marketing + C-suite | All departments | Limited to 2 department groups |
| **Org Enrichment** | Nested in person data only | Dedicated `/v1/organizations/enrich` | Richer data: funding, dept headcounts, org chart |
| **Job Postings** | Not fetched | `/v1/organizations/job_postings` | Hiring signals for prospect intelligence |
| **Intent Signals** | Stored in enrichment_data | Surfaced + used for scoring | Not surfaced or scored |
| **KB Vectorized** | No | Org + team intelligence | Not connected to RAG |
| **Edge Functions** | apollo-enrich, apollo-team-search, enrich-contacts | + apollo-org-enrich, apollo-job-postings | 2 new functions needed |

### 3. Ocean.io (Priority: p1)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Static + Synced | Static + Synced | Same |
| **Company Enrich** | Full response stored | Same + historicized | No change tracking |
| **Similar Companies** | Not fetched | `/v2/similar/companies` | Lookalike prospecting blocked |
| **Web Traffic** | Stored point-in-time | Historicized trending | No time-series |
| **Department Sizes** | Point-in-time | Tracked over time | No delta tracking |
| **KB Vectorized** | No | Company intelligence searchable | Not connected to RAG |
| **Edge Functions** | ocean-enrich, enrich-companies | + ocean-similar-companies | 1 new function needed |

### 4. Harvest (Priority: p1)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Synced + Live | Synced | Same |
| **Projects** | 478 synced | Same + user/task assignments | Assignments not fetched |
| **Time Entries** | 10,000+ synced | Same | Complete |
| **Invoices** | **0 rows (table exists!)** | All invoices synced | **Critical: sync broken or disabled** |
| **Invoice Payments** | **0 rows** | All payments synced | Depends on invoices |
| **Expenses** | Not fetched | `/v2/expenses` synced | New endpoint needed |
| **Estimates** | Not fetched | `/v2/estimates` synced | New endpoint needed |
| **Budget Utilization** | Calculated on-the-fly | Stored as metric | Not persisted |
| **KB Vectorized** | No | Financial summaries searchable | Not connected to RAG |
| **Edge Functions** | harvest-sync, harvest-lookup, harvest-oauth-exchange, company-artifacts | Same (fix invoice sync) | Invoice logic needs debugging |

### 5. Asana (Priority: p1)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Synced | Synced | Same |
| **Projects** | 51 synced | Same + status history | Only current_status stored |
| **Tasks** | **Not synced at all** | Full task sync with assignees, subtasks | **Biggest gap — no task-level data** |
| **Sections** | Not synced | Project phases/columns | Missing |
| **Milestones** | Not fetched | Tracked for timeline | Missing |
| **Goals** | Not fetched | Mapped to KPIs | Missing |
| **Custom Fields** | Stored as array | Parsed into structured data | Not parsed |
| **KB Vectorized** | No | Project + task data searchable | Not connected to RAG |
| **Edge Functions** | asana-projects-sync, asana-lookup | + asana-tasks-sync, asana-goals-sync | 2 new functions needed |

### 6. Freshdesk (Priority: p1)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Synced | Synced | Same |
| **Tickets** | 3,985 synced | Same + custom fields + time entries | Custom fields not extracted |
| **Conversations** | 873 synced | Same + full details | Mostly complete |
| **Agent/Group Names** | Stored as IDs | Resolved to names | "group-{id}" not human-readable |
| **Company Details** | Not synced from FD | Health score, domain, industry | Missing |
| **KB Vectorized** | No | Ticket conversations searchable | Support patterns not in RAG |
| **Edge Functions** | freshdesk-sync, freshdesk-lookup, company-artifacts | Same (enhance sync) | Existing function needs expansion |

### 7. Avoma (Priority: p0)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Static + Live | Synced | Need scheduled sync |
| **Meetings** | **0 rows in company_meetings** | All meetings per company | **Sync exists, not run** |
| **Transcripts** | Truncated to 50 segments | Full transcripts stored | 50-segment limit |
| **Action Items** | Not extracted | Structured from insights | Missing |
| **Attendees** | Email + name only | Cross-referenced with contacts | Not linked |
| **KB Vectorized** | No | Full transcripts searchable | **Critical for Agency Brain** |
| **Edge Functions** | avoma-lookup, avoma-sync | Same (run + schedule) | avoma-sync needs pg_cron |

### 8. Gmail (Priority: p0)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Live (on-demand) | Synced + Live fallback | Need scheduled sync |
| **Emails** | **0 rows in company_emails** | All client emails persisted | **Sync exists, not run** |
| **Body Text** | Truncated to 5,000 chars | Full body stored | Char limit |
| **Threads** | threadId fetched, not used | Thread aggregation | Not grouped |
| **CC/BCC** | Not fetched | Stored | Missing |
| **Labels** | Not fetched | Stored for filtering | Missing |
| **KB Vectorized** | No | All emails searchable | **Critical for Agency Brain** |
| **Edge Functions** | gmail-lookup, gmail-sync | Same (run + schedule) | gmail-sync needs OAuth refresh |

### 9. Slack (Priority: p0)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Live (on-demand) | Synced + Live fallback | Need scheduled sync |
| **Messages** | **0 rows in company_messages** | All client channel messages | **Sync exists, not run** |
| **Channel Mapping** | No mapping | Channel → company mapping | Missing |
| **Threads** | Not stored | Thread context preserved | Missing |
| **Reactions** | Not fetched | Stored as engagement signals | Missing |
| **Files** | Not fetched | Metadata stored | Missing |
| **KB Vectorized** | No | All messages searchable | **Critical for Agency Brain** |
| **Edge Functions** | slack-search, slack-sync, slack-oauth-exchange | Same (run + schedule) | slack-sync needs OAuth refresh |

### 10. Google Analytics GA4 (Priority: p1)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Premium (OAuth) | Synced (scheduled refresh) | Manual trigger only |
| **Traffic Data** | On crawl_sessions + enrichment_data | Same + historical snapshots | No time-series table |
| **Forward-Sync** | ✅ SHIPPED | Complete | Done |
| **Summary Cards** | ✅ SHIPPED on company overview | Complete | Done |
| **Historical Trends** | None | Week/month-over-week | No snapshots table |
| **Demographics** | Not fetched | Age, gender, interests | Missing |
| **E-commerce** | Not fetched | For applicable clients | Missing |
| **KB Vectorized** | No | Traffic summaries searchable | Not connected to RAG |

### 11. Google Search Console (Priority: p1)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Premium (OAuth) | Synced (scheduled refresh) | Manual trigger only |
| **Search Data** | On crawl_sessions + enrichment_data | Same + historical snapshots | No time-series table |
| **Forward-Sync** | ✅ SHIPPED | Complete | Done |
| **Summary Cards** | ✅ SHIPPED on company overview | Complete | Done |
| **Index Coverage** | Not fetched | Indexed pages, errors, warnings | Missing |
| **Sitemaps** | Not fetched from GSC | Sitemap status | Missing |
| **URL Inspection** | Not used | Key page inspection | Missing |
| **KB Vectorized** | No | SEO data searchable | Not connected to RAG |

### 12. Google Drive (Priority: p1)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Live (OAuth) | Live + auto-sync | No change detection |
| **File Content** | ✅ Ingested into KB via rag-ingest | Same + auto-detect changes | Manual re-ingest |
| **File Metadata** | Not stored | Modified dates, owners, size | No drive_files table |
| **Folder Structure** | connected_drive_folders table | Hierarchical view | Flat list only |
| **Change Detection** | None | Auto re-ingest on modification | Missing |
| **Sync Status** | Not tracked | Per-file ingestion status | Missing |

### 13. Google Ads (Priority: p2) — NEW

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | **NONE** | Synced + Live (MCP) | **Complete gap — no integration** |
| **Campaigns** | Nothing | Full campaign data | Not built |
| **Keywords** | Nothing | Search terms + performance | Not built |
| **Conversions** | Nothing | Attribution + values | Not built |
| **Tables** | None | google_ads_campaigns, keywords, snapshots | Not created |
| **Edge Functions** | None | google-ads-sync, google-ads-oauth-exchange | Not built |

### 14. BuiltWith (Priority: p2)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Static | Static | Same |
| **Tech Detection** | Full response on crawl_sessions | Same + normalized to dedicated table | No company_tech_stacks table |
| **Change Tracking** | None | Tech additions/removals between crawls | Missing |
| **Forward-Sync** | Not on companies table | companies.enrichment_data.tech_stack | Missing |
| **Cross-Client** | None | "80% of healthcare clients use WordPress" | No pattern matching |
| **KB Vectorized** | No | Tech stack searchable | Not connected to RAG |

### 15. SEMrush (Priority: p2) — PAUSED

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Static (PAUSED) | Static | Out of credits |
| **Domain Overview** | Empty (no credits) | Rankings, traffic, keywords | Need credits or alternative |
| **Keywords** | Nothing | Position tracking | Not fetched even when active |
| **Backlinks** | Nothing | Referring domains, authority | Not fetched |
| **Competitors** | Nothing | Organic/paid competitor discovery | Not fetched |

### 16. Firecrawl (Priority: p1)

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Connection Type** | Static | Static + Backfill | Same |
| **URL Discovery** | ✅ Full site map | Complete | Done |
| **Content Scrape** | Manual trigger only | Auto-scrape top 10-20 pages | Not automated |
| **Content Storage** | Per-session only | Persistent across sessions | No persistent content |
| **Change Tracking** | None | Content diffing across crawls | Missing |
| **KB Vectorized** | On-demand | Auto-vectorize scraped content | Not automated |

### 17. Crawl Audit Tools (Priority: p2) — GROUPED

15+ tools: PageSpeed, GTmetrix, WAVE, W3C, Observatory, SSL Labs, Website Carbon, CrUX, Yellow Lab, Schema.org, Sitemaps, HTTP Status, Link Checker, Readability, Nav Structure, Content Types, Forms Detection, Page Tags, Content Audit, Screenshots, Tech Analysis, DetectZeStack

| Dimension | Current | Desired | Gap |
|-----------|---------|---------|-----|
| **Storage** | All on crawl_sessions JSONB | Same + forward-sync to companies | No forward-sync for audit data |
| **Trending** | Point-in-time only | Crawl-over-crawl comparison | **No historical snapshots** |
| **Page Coverage** | Homepage only (all tools) | Top 5-10 pages | Single-page limitation |
| **Benchmarks** | None | Cross-client percentile rankings | No comparison engine |
| **Health Score** | Individual tool scores | Composite weighted score | Not calculated |
| **KB Vectorized** | None | Audit summaries searchable | Not connected to RAG |

---

## Connection Type Summary

| Type | Count | Integrations |
|------|-------|-------------|
| **Static** | 15+ | PageSpeed, GTmetrix, WAVE, W3C, Observatory, SSL Labs, Carbon, CrUX, Yellow Lab, Schema, Sitemaps, HTTP Status, Link Checker, Readability, Nav, Content Types, Forms, Page Tags, Content Audit, Screenshots, Tech Analysis, DetectZeStack, BuiltWith, SEMrush |
| **Synced** | 8 | HubSpot, Harvest, Asana, Freshdesk, Avoma (needs run), Gmail (needs run), Slack (needs run), Apollo (batch) |
| **Live** | 4 | Google Drive, Gmail (fallback), Slack (fallback), company-artifacts (on-demand) |
| **Premium** | 3 | GA4, GSC, SSL Labs (slow, manual trigger) |
| **Backfill** | 1 | Firecrawl content scrape |
| **Not Connected** | 2 | Google Ads, LinkedIn |

---

## KB Vectorization Status

| Integration | Data Vectorized | Status |
|-------------|----------------|--------|
| Google Drive documents | ✅ Yes | Via rag-ingest |
| Manual uploads | ✅ Yes | Via parse-upload + rag-ingest |
| HubSpot engagements | ❌ No | rag-vectorize-comms exists, engagements table has data |
| Gmail emails | ❌ No | company_emails empty (0 rows) |
| Avoma meetings | ❌ No | company_meetings empty (0 rows) |
| Slack messages | ❌ No | company_messages empty (0 rows) |
| HubSpot form submissions | ❌ No | form_submissions empty (0 rows) |
| Freshdesk conversations | ❌ No | Data exists (873 rows), not wired |
| Apollo enrichment | ❌ No | Data exists, not vectorized |
| Ocean enrichment | ❌ No | Data exists, not vectorized |
| GA4 analytics | ❌ No | Data exists on enrichment_data |
| GSC search data | ❌ No | Data exists on enrichment_data |
| Crawl audit data | ❌ No | Data exists on crawl_sessions |
| Harvest financials | ❌ No | Data exists in harvest_* tables |
| Asana projects | ❌ No | Data exists (51 rows) |
| BuiltWith tech stacks | ❌ No | Data on crawl_sessions |
| SEMrush SEO | ❌ No | Paused, no data |

**Result: Only Google Drive documents and manual uploads are vectorized. 15+ data sources have data but are NOT searchable by AI.**

---

## Immediate Actions (Quick Wins)

These require no new code — just running existing sync functions:

1. **Run gmail-sync** → populate company_emails → enables email RAG search
2. **Run avoma-sync** → populate company_meetings → enables meeting transcript RAG search
3. **Run slack-sync** → populate company_messages → enables message RAG search
4. **Run hubspot-form-submissions-sync** → populate form_submissions
5. **Debug harvest-sync invoice logic** → figure out why harvest_invoices has 0 rows
6. **Wire rag-vectorize-comms** to existing engagements data (2,000 rows ready)
7. **Wire freshdesk conversations** to rag-vectorize-comms (873 rows ready)

---

## Existing Plan Cards (Already in System)

These plan cards existed BEFORE this mapping and cover broader themes:

| Title | Priority | Status |
|-------|----------|--------|
| Communication Persistence — Email Storage | p0 | shipped |
| Communication Persistence — Meeting Storage | p0 | shipped |
| Communication Persistence — Message Storage | p0 | shipped |
| Pipeline Pages Read from Local DB | p0 | shipped |
| HubSpot Engagements Batch Sync | p0 | shipped |
| HubSpot Form Submissions Table | p1 | shipped |
| Company Projects Tab Reads from Local DB | p1 | shipped |
| Forward-Sync GA4 + Search Console to Companies | p1 | shipped |
| Auto-RAG Vectorization Pipeline | p1 | shipped |
| MCP Server Framework for Live AI Queries | p1 | draft |
| Cross-Source Engagement Scoring Engine | p1 | draft |
| Apollo Org Enrichment + Job Postings | p1 | draft |
| Two-Way HubSpot Sync (Write-Back) | p2 | draft |
| Cross-Client Pattern Recognition Engine | p2 | draft |
| Historical Trending Infrastructure | p2 | draft |
| Playbook System | p2 | draft |
| Insight Generation Engine | p2 | draft |
| Ocean.io Similar Companies for Prospecting | p2 | draft |

**The 17 new "Complete Connection Pipeline" cards provide per-integration granularity that these broader cards don't cover.**

---

## Priority Execution Order

### Phase 1: Activate What Exists (no new code)
1. Run gmail-sync, avoma-sync, slack-sync (populate 0-row tables)
2. Run hubspot-form-submissions-sync
3. Debug harvest invoice sync
4. Wire rag-vectorize-comms to engagements + freshdesk conversations

### Phase 2: Complete HubSpot (p0)
5. Remove engagement body truncation (500 → full text)
6. Add missing company/contact fields
7. Replace company-artifacts live call with local engagements table
8. Add form_submissions to pg_cron

### Phase 3: Enrich Intelligence (p1)
9. Apollo org enrichment endpoint + job postings
10. Ocean similar companies
11. Asana task sync
12. Firecrawl auto-scrape key pages
13. GA4/GSC historical snapshot tables

### Phase 4: Platform Gaps (p2)
14. Google Ads integration (new)
15. BuiltWith tech stack normalization
16. Crawl audit forward-sync + trending
17. SEMrush reactivation or alternative

---

*This map represents a complete inventory of every connection's current state, desired state, and the specific gap between them. Each integration has a corresponding plan card in claude_code_plans tagged with "pipeline-complete".*
