# Data-First Architecture Plan

> Every page reads from local Supabase tables. External APIs feed sync functions. No exceptions.

---

## Principle

```
External API  →  Sync Function  →  Local Table  →  Frontend Query  →  UI
                   (edge fn)         (Supabase)     (scoped to what's displayed)
```

- Pages NEVER call external APIs
- Sync functions fetch from external APIs and write to local tables
- Frontend queries are scoped to the workspace/page — never load all rows and filter in browser
- Enrichment (Apollo, Ocean.io) runs automatically when new entities arrive

---

## Part 1: Tables — What Exists vs What's Needed

### Already populated and working
| Table | Rows | Source | Status |
|-------|------|--------|--------|
| companies | ~2,700 | global-sync + deals/contacts sync | OK |
| contacts | ~1,650 | Apollo + hubspot-contacts-sync | OK — needs enrichment |
| deals | 1,128 | hubspot-deals-sync | OK — just deployed |
| crawl_sessions | varies | site crawler | OK |
| crawl_pages | varies | site crawler | OK |
| knowledge_documents | varies | ingestion pipeline | OK |
| project_mappings | 51 | project-mapping edge fn | OK |
| wishlist_items | ~40 | user input | OK |
| services | ~20 | manual + service catalog | OK |

### Populated but not used as primary source
| Table | Rows | Source | Problem |
|-------|------|--------|---------|
| engagements | ~50 | company-artifacts on-demand | Should be batch synced |
| harvest_time_entries | ~10,000 | harvest-sync | OK but ProjectsPage doesn't read from it |
| freshdesk_tickets | ~3,985 | freshdesk-sync | OK but Tickets tab still calls API live |

### Missing or empty — needs sync functions
| Table | Needed For | Source |
|-------|-----------|--------|
| (none critical) | — | All core entity tables exist |

---

## Part 2: Pages — Current vs Target Data Source

### Growth Workspace

| Page | Current Source | Target Source | Change Needed |
|------|--------------|---------------|---------------|
| **Companies** (Growth) | `deals` + `contacts` tables → company IDs → `companies` table | Same | DONE |
| **Leads** (`/leads`) | `hubspot-pipeline` edge fn → HubSpot API live | `contacts` table WHERE `lead_status IS NOT NULL` | Rewrite `usePipelineLeads()` |
| **Deals** (`/deals`) | `hubspot-pipeline` edge fn → HubSpot API live | `deals` table WHERE `status = 'open'` | Rewrite `usePipelineDeals()` |
| **Crawl** (`/`) | Local DB | Same | OK |

### Delivery Workspace

| Page | Current Source | Target Source | Change Needed |
|------|--------------|---------------|---------------|
| **Clients** | `companies` table WHERE `status = 'active'` | Same, scoped query | Pass `workspace` to `useCompanies()` |
| **Projects** (`/projects`) | `asana-clients` + `harvest-project-hours` edge fns → live APIs | Local tables (project_mappings + harvest data) | Needs Asana project data synced locally |

### Admin Workspace

| Page | Current Source | Target Source | Change Needed |
|------|--------------|---------------|---------------|
| **Clients** | `companies` table (all) | Same, scoped query | Pass `workspace` to `useCompanies()` |
| **Invoicing** | `companies.quickbooks_invoice_summary` | Same | OK |

### Company Detail Tabs

| Tab | Current Source | Target Source | Change Needed |
|-----|--------------|---------------|---------------|
| **Overview** | Local DB + `company-artifacts` for engagements | Local DB only | Sync engagements |
| **Contacts** | Local `contacts` table | Same | OK |
| **Deals** | `company-artifacts` → HubSpot live | `deals` table WHERE `company_id = X` | Query local deals |
| **Projects** | `company-artifacts` → Harvest live | Local project tables | After Asana/Harvest sync |
| **Time** | `company-artifacts` → Harvest live | `harvest_time_entries` WHERE `company_id = X` | Already synced, just query it |
| **Tickets** | `company-artifacts` → Freshdesk live | `freshdesk_tickets` WHERE `company_id = X` | Already synced, just query it |
| **Invoices** | `companies.quickbooks_invoice_summary` | Same | OK |
| **Voice** | Local DB | Same | OK |
| **Knowledge** | Local DB | Same | OK |
| **Chat** | Local DB + edge fns for AI | Same | OK |

---

## Part 3: Sync Functions — What Runs and When

### Existing sync functions (keep)
| Function | What it syncs | Trigger |
|----------|--------------|---------|
| `global-sync` | Companies from HubSpot/Harvest/Freshdesk/Asana | Manual (Connections page) |
| `hubspot-deals-sync` | All deals from 3 pipelines → `deals` table | Manual / scheduled |
| `hubspot-contacts-sync` | Lead contacts → `contacts` table | Manual / scheduled |
| `harvest-sync` | Time entries, projects → local tables | Manual (Connections page) |
| `freshdesk-sync` | Tickets → `freshdesk_tickets` table | Manual (Connections page) |

### New sync needed
| Function | What it syncs | Trigger |
|----------|--------------|---------|
| `hubspot-engagements-sync` | Emails, calls, meetings, notes → `engagements` table | After deals/contacts sync |

### Enrichment (NEW)
| Function | What it does | Trigger |
|----------|-------------|---------|
| `enrich-contacts` | Apollo person match for contacts without enrichment | After contacts sync, or on-demand |
| `enrich-companies` | Ocean.io company intelligence for companies without enrichment | After company creation, or on-demand |

### Sync schedule (future)
- Every 30 min: `hubspot-deals-sync` + `hubspot-contacts-sync`
- Every 6 hours: `global-sync` (companies), `harvest-sync`, `freshdesk-sync`
- On-demand: enrichment functions (Apollo/Ocean.io)

---

## Part 4: Frontend Hook Rewrites

### 1. `usePipelineDeals()` → read from `deals` table

**Before:**
```ts
const { data } = await supabase.functions.invoke('hubspot-pipeline', { body: { action: 'deals', pipeline } });
```

**After:**
```ts
const { data } = await supabase
  .from('deals')
  .select('*, companies(name, domain, logo_url)')
  .eq('pipeline', pipelineId)
  .eq('status', 'open')
  .order('close_date', { ascending: false });
```

Pipeline definitions, stage labels, owner names — all stored in `deals.properties` JSONB during sync. No HubSpot call needed.

### 2. `usePipelineLeads()` → read from `contacts` table

**Before:**
```ts
const { data } = await supabase.functions.invoke('hubspot-pipeline', { body: { action: 'leads' } });
```

**After:**
```ts
const { data } = await supabase
  .from('contacts')
  .select('*, companies(name, domain, logo_url)')
  .not('lead_status', 'is', null)
  .order('updated_at', { ascending: false });
```

### 3. `useCompanies(workspace)` — already done for Growth

Extend for Delivery (`WHERE status = 'active'`) and Admin (all non-archived). Each workspace gets a scoped query — never load all 2,700.

### 4. Company detail tabs — query local tables

Replace `company-artifacts` calls with direct Supabase queries:
- Deals tab: `supabase.from('deals').select('*').eq('company_id', id)`
- Time tab: `supabase.from('harvest_time_entries').select('*').eq('company_id', id)`
- Tickets tab: `supabase.from('freshdesk_tickets').select('*').eq('company_id', id)`

---

## Part 5: Enrichment Pipeline

### Auto-enrichment flow
```
New deal synced → company created if missing → enrich company (Ocean.io)
                → contact associated → enrich contact (Apollo)

New lead synced → company created if missing → enrich company (Ocean.io)
               → enrich contact (Apollo)
```

### `enrich-contacts` edge function
- Input: list of contact IDs (or "all unenriched")
- For each contact with email but no Apollo data:
  - Call Apollo `/v1/people/match` with email
  - Update contact record: photo_url, title, seniority, linkedin_url, enrichment_data
- Rate limit: 5 per second, respect Apollo credits
- Store in `contacts` table directly (not a separate enrichment table)

### `enrich-companies` edge function
- Input: list of company IDs (or "all unenriched")
- For each company with domain but no Ocean.io data:
  - Call Ocean.io company lookup
  - Update company record: industry, employee_count, annual_revenue, enrichment_data
- Store in `companies.enrichment_data.ocean` JSONB
- Fallback: if no domain, skip

### Backfill (one-time)
- Run `enrich-contacts` for all 23 pipeline contacts
- Run `enrich-companies` for all 23 pipeline companies
- Then for all active clients (~173)

---

## Part 6: Execution Order

### Phase 1: Leads & Deals pages read from DB (highest impact)
1. Rewrite `usePipelineDeals()` to query `deals` table
2. Rewrite `usePipelineLeads()` to query `contacts` table
3. Update PipelinePage to work with local data shape
4. Scope `useCompanies()` for Delivery and Admin workspaces

### Phase 2: Company detail tabs read from DB
5. Deals tab → query local `deals` table
6. Time tab → query local `harvest_time_entries` table
7. Tickets tab → query local `freshdesk_tickets` table

### Phase 3: Enrichment pipeline
8. Build `enrich-contacts` edge function (Apollo)
9. Build `enrich-companies` edge function (Ocean.io)
10. Wire into deals/contacts sync — auto-enrich on new arrivals
11. Backfill existing pipeline companies + contacts

### Phase 4: Projects page reads from DB
12. Sync Asana project data to local table
13. Rewrite ProjectsPage to query local data
14. Link project_mappings to companies via company_id

### Phase 5: Cleanup
15. Remove `hubspot_lifecycle_stage` and `hubspot_has_active_deal` from companies
16. Remove `hubspot-lifecycle-sync` edge function (superseded)
17. Remove live-fetch paths from `hubspot-pipeline` edge function
18. Remove `company-artifacts` live-fetch for deals/time/tickets

---

## Performance Contract

- Growth Companies: ~23 rows, 2 queries (deals+contacts IDs, then companies), <500ms
- Delivery Companies: ~173 rows, 1 query, <300ms
- Admin Companies: ~2,700 rows, paginated, <500ms first page
- Leads page: ~12 rows from contacts table, <200ms
- Deals page: ~13 open deals from deals table, <200ms
- Company detail tab: single-table query filtered by company_id, <200ms

No page should ever take >1 second to load data.
