# Connections Data Flow Audit

> Full end-to-end trace of every sync function in `supabase/functions/`.
> Generated 2026-04-05.

---

## Summary Table

| Function | Source API | Auth | Destination Table(s) | UI Component(s) | KB Vectorized | pg_cron | Status |
|----------|-----------|------|----------------------|-----------------|---------------|---------|--------|
| **hubspot-deals-sync** | HubSpot CRM v3 (deals, companies, contacts, owners) | `HUBSPOT_ACCESS_TOKEN` (env) | `deals`, `contacts`, `companies`, `contact_photos` | `PipelinePage`, `CompanyDetailPage`, `useCachedQueries` | No (but triggers `enrich-companies` + `crawl-start`) | `0,30 * * * *` (every 30min) | **Working** |
| **hubspot-contacts-sync** | HubSpot CRM v3 (contacts by lead status) | `HUBSPOT_ACCESS_TOKEN` (env) | `contacts`, `companies`, `contact_photos` | `useContacts`, `ContactDetailDrawer`, `useCachedQueries` | No (triggers `enrich-contacts` + `enrich-companies`) | `15,45 * * * *` (every 30min offset) | **Working** |
| **hubspot-engagements-sync** | HubSpot CRM v3 (emails, calls, meetings, notes, tasks) | `HUBSPOT_ACCESS_TOKEN` (env) | `engagements` | Cleanup phases only (no dedicated UI) | Yes (via `rag-vectorize-comms`) | None | **Working** (manual only) |
| **hubspot-form-submissions-sync** | HubSpot Marketing v3 (forms + submissions) | `HUBSPOT_ACCESS_TOKEN` (env) | `form_submissions` | **None** (table exists, no UI reads it) | No | None | **Working** (no UI) |
| **hubspot-sync** | HubSpot CRM v3 (contacts, deals, engagements) | `HUBSPOT_ACCESS_TOKEN` (env) | `contacts`, `deals`, `engagements` | (Indirect via table consumers) | No | None | **Legacy** (superseded by individual syncs) |
| **hubspot-pipeline** | HubSpot CRM v3 (deals, contacts, owners) + Apollo | `HUBSPOT_ACCESS_TOKEN` + `APOLLO_API_KEY` (env) | `contact_photos` (cache only) | `PipelinePage` (live API proxy) | No | None | **Working** (live proxy, not a sync) |
| **global-sync** | HubSpot + Harvest + Asana + Freshdesk | All 4 tokens (env) | `companies`, `company_source_data` | `CompaniesPage`, `useCompanies` | No | `0 */6 * * *` (every 6hr) | **Working** |
| **asana-projects-sync** | Asana API v1 (portfolios + projects) | `ASANA_ACCESS_TOKEN` (env) | `asana_projects` | `useProjects` | No | None in migration (comment says 2hr) | **Working** (manual only) |
| **harvest-sync** | Harvest v2 (projects, time entries, invoices, payments, contacts) | `HARVEST_ACCESS_TOKEN` + `HARVEST_ACCOUNT_ID` (env) | `harvest_projects`, `harvest_time_entries`, `harvest_invoices`, `harvest_invoice_payments`, `contacts` | `CompanyDetailPage` | No | None | **Working** (manual only) |
| **freshdesk-sync** | Freshdesk v2 (tickets, conversations, contacts) | `FRESHDESK_API_KEY` + `FRESHDESK_DOMAIN` (env) | `freshdesk_tickets`, `freshdesk_ticket_conversations`, `contacts` | `CompanyDetailPage` | No | None | **Working** (manual only) |
| **gmail-sync** | Gmail API v1 (messages) | OAuth (`oauth_connections` table) | `company_emails` | `useCompanyEmails` | Yes (auto-RAG via `rag-auto-ingest`) | None | **Requires OAuth** |
| **slack-sync** | Slack Web API (search.messages) | OAuth (`oauth_connections` table) | `company_messages` | `useCompanyMessages`, `SlackMessagesCard` | Yes (auto-RAG via `rag-auto-ingest`) | None | **Requires OAuth** |
| **avoma-sync** | Avoma API v1 (meetings + transcripts) | `AVOMA_API_KEY` (env) | `company_meetings` | `useCompanyMeetings`, `useCompanyAvoma` | Yes (auto-RAG via `rag-auto-ingest`) | None | **Working** (manual only) |
| **rag-vectorize-comms** | Internal (reads from `engagements`, `company_emails`, `company_meetings`, `company_messages`) | Service role | `knowledge_documents`, `knowledge_chunks` (via `rag-ingest`) | `DocumentLibrary`, `KnowledgePicker` | **This IS the vectorizer** | None | **Working** (manual only) |
| **crawl-recover** | Internal (reads `crawl_sessions`, `integration_runs`) | Service role | `crawl_sessions`, `integration_runs` | `HistoryPage`, `CrawlPage` | No | `*/5 * * * *` (every 5min) | **Working** |
| **enrich-companies** | Ocean.io API | `OCEAN_IO_API_KEY` (env) | `companies.enrichment_data` | `CompanyDetailPage` | No | None (triggered by syncs) | **Working** |
| **enrich-contacts** | Apollo API | `APOLLO_API_KEY` (env) | `contacts` (apollo fields) | `ContactDetailDrawer` | No | None (triggered by syncs) | **Working** |
| **integration-health** | Multiple APIs (BuiltWith, GTmetrix, PageSpeed, HubSpot, Harvest, etc.) | Various env keys | None (returns JSON) | Settings panel | No | None | **Working** (live check) |

---

## pg_cron Jobs (from migration `20260406000005`)

| Job Name | Schedule | Edge Function | Purpose |
|----------|----------|---------------|---------|
| `hubspot-deals-sync` | `0,30 * * * *` (every 30min at :00/:30) | `hubspot-deals-sync` | Sync all HubSpot deals + create companies/contacts |
| `hubspot-contacts-sync` | `15,45 * * * *` (every 30min at :15/:45) | `hubspot-contacts-sync` | Sync HubSpot lead contacts |
| `global-sync` | `0 */6 * * *` (every 6hr) | `global-sync` | Cross-reference HubSpot + Harvest + Asana + Freshdesk |
| `crawl-recover` | `*/5 * * * *` (every 5min) | `crawl-recover` | Mark zombie crawl sessions as failed |
| `clean-cron-history` | `0 0 * * *` (daily midnight) | N/A (SQL) | Purge pg_cron run history > 7 days |
| `clean-sync-runs` | `0 1 * * *` (daily 1 AM) | N/A (SQL) | Purge sync_runs > 30 days |

**Missing from pg_cron (but should be):**
- `hubspot-engagements-sync` -- currently manual only
- `hubspot-form-submissions-sync` -- currently manual only
- `asana-projects-sync` -- comment says 2hr but not in migration
- `harvest-sync` -- currently manual only
- `freshdesk-sync` -- currently manual only
- `rag-vectorize-comms` -- should run after communication syncs complete
- `avoma-sync` -- currently manual only

---

## Shared Infrastructure

### `_shared/resolve-user.ts`
Priority chain for user_id resolution:
1. JWT from Authorization header (real user, not service_role)
2. Explicit `userId` from request body
3. `sync_config` table (for pg_cron / automation) -- seeded with Travis's ID `0cfce3d7-ae14-40d9-82e0-76c30464cfef`
4. Fallback: first company row (with warning)

### `_shared/sync-logger.ts`
All sync functions log to `sync_runs` table:
- `startSyncRun()` -- creates row with status=running
- `completeSyncRun()` -- updates with records_upserted/deleted/skipped + duration_ms
- `failSyncRun()` -- updates with error_message

### `sync_health` view
SQL view that joins `sync_runs` with expected intervals to compute `is_overdue` flag. Only covers 4 functions: hubspot-deals-sync, hubspot-contacts-sync, global-sync, crawl-recover.

### `_shared/rag-auto-ingest.ts`
Used by gmail-sync, slack-sync, avoma-sync to auto-vectorize communication data into the RAG pipeline immediately after sync.

---

## Detailed Function Analysis

### 1. hubspot-deals-sync

**Source:** HubSpot CRM v3 Search API
- `/crm/v3/objects/deals/search` -- fetches deals by pipeline (all pipelines from `_shared/pipeline-config.ts`)
- `/crm/v4/associations/deals/companies/batch/read` -- company associations
- `/crm/v4/associations/deals/contacts/batch/read` -- contact associations
- `/crm/v3/objects/contacts/batch/read` -- contact details
- `/crm/v3/objects/companies/batch/read` -- company details
- `/crm/v3/owners` -- owner names

**Transform:**
- Extracts deal properties (name, amount, stage, pipeline, dates, owner)
- Resolves HubSpot company IDs to local companies via `resolveCompany()` (creates if missing)
- Upserts deal contacts into `contacts` table
- Maps deal stages to status (open/won/lost/archived) via `stageOutcomeMap`
- Stores full properties in JSONB `properties` column

**Destination:** `deals` (upsert on `hubspot_deal_id`), `contacts` (upsert on `hubspot_contact_id`), `companies` (creates via resolveCompany)

**Side Effects:**
- Triggers `enrich-companies` for newly created pipeline companies
- Auto-creates `crawl_sessions` + triggers `crawl-start` for uncrawled domains
- Removes stale deals (deleted in HubSpot)

**UI:** `PipelinePage` reads deals via `useCachedQueries`, `CompanyDetailPage` shows company deals

**Status:** **Fully operational.** Runs every 30min via pg_cron. Raw response stored in `properties` JSONB.

---

### 2. hubspot-contacts-sync

**Source:** HubSpot CRM v3 Search API
- `/crm/v3/objects/contacts/search` -- fetches contacts by lead status (Inbound, Contacting, Scheduled, Future Follow-Up)
- `/crm/v4/associations/contacts/companies/batch/read` -- company associations
- `/crm/v3/objects/companies/batch/read` -- company details for unmatched
- `/crm/v3/owners` -- owner names

**Transform:**
- Extracts contact properties (name, email, phone, title, lead_status, lifecycle_stage)
- Resolves companies via `resolveCompany()` (creates if missing)
- Stores enrichment data in `enrichment_data` JSONB (company name, dates, owner)

**Destination:** `contacts` (upsert on `hubspot_contact_id`), `companies` (creates via resolveCompany)

**Side Effects:**
- Triggers `enrich-contacts` (Apollo) for up to 25 leads
- Triggers `enrich-companies` (Ocean.io) for lead companies
- Auto-creates crawl sessions for uncrawled lead company domains
- Removes stale lead contacts

**UI:** `useContacts`, `ContactDetailDrawer`, `useCachedQueries` (pipeline leads)

**Status:** **Fully operational.** Runs every 30min via pg_cron (offset by 15min from deals).

---

### 3. hubspot-engagements-sync

**Source:** HubSpot CRM v3 Search API
- `/crm/v3/objects/{emails,calls,meetings,notes,tasks}/search`
- `/crm/v4/associations/{type}/companies/batch/read`
- `/crm/v4/associations/{type}/contacts/batch/read`

**Transform:**
- Extracts subject, body_preview (500 chars), direction (inbound/outbound)
- Maps engagement types: email, call, meeting, note, task
- Stores full properties in `metadata` JSONB

**Destination:** `engagements` (upsert on `hubspot_engagement_id`)

**KB:** Yes -- `rag-vectorize-comms` reads from `engagements` and vectorizes body content

**UI:** Only used in cleanup phases (Phase2Deduplicate, Phase3MatchLink) for company merges. **No dedicated engagement timeline UI exists.**

**Status:** **Working but manual only.** Not on pg_cron. Should be scheduled (e.g., every 2hr).

---

### 4. hubspot-form-submissions-sync

**Source:** HubSpot Marketing v3
- `/marketing/v3/forms` -- lists all forms
- `/marketing/v3/forms/{id}/submissions` -- fetches submissions per form

**Transform:**
- Extracts form values, email, contact name, page URL
- Resolves contacts by email to get company_id linkage
- Generates composite `hubspot_submission_id` from formId + submittedAt

**Destination:** `form_submissions` (upsert on `hubspot_submission_id`)

**UI:** **None.** The table exists and gets populated, but no React component reads from `form_submissions`.

**Status:** **Working but orphaned.** No pg_cron, no UI. Data flows in but nowhere to see it.

---

### 5. hubspot-sync (legacy)

**Source:** HubSpot CRM v3 (contacts, deals, engagements with company associations)

**Transform:** Builds company map from local `companies` table, fetches HubSpot objects, filters to matched companies only.

**Destination:** `contacts`, `deals`, `engagements` (batch upsert)

**Status:** **Legacy / superseded.** The individual syncs (hubspot-deals-sync, hubspot-contacts-sync, hubspot-engagements-sync) are more capable and are the active versions. This function still works but creates companies passively (only matches existing). Requires explicit `userId` in body.

---

### 6. hubspot-pipeline

**Source:** HubSpot CRM v3 (live API proxy)
- Fetches deals by pipeline/stage with company + contact associations
- Fetches lead contacts by status
- Computes stats (win rate, avg cycle, revenue)
- Enriches contacts via Apollo (caches in `contact_photos`)

**Destination:** `contact_photos` (cache table only). **Not a sync** -- returns data directly to the UI.

**UI:** `PipelinePage` calls this as a live API proxy for real-time pipeline views.

**Status:** **Working.** This is a live proxy, not a periodic sync. Apollo enrichment capped at 5 new lookups per page load.

---

### 7. global-sync

**Source:** HubSpot + Harvest + Asana + Freshdesk (all four in parallel)
- HubSpot: `/crm/v3/objects/companies` (list API, up to 5000)
- Harvest: `/v2/clients` + `/v2/projects` (active + archived)
- Asana: workspaces -> projects (active + archived, domain extraction)
- Freshdesk: `/api/v2/companies` (paginated)

**Transform:**
- Cross-references all 4 sources by domain match -> name match -> new
- Detects active clients via Harvest project status
- Upgrades prospect -> active if they have active Harvest projects
- Stores full raw API responses in `company_source_data`

**Destination:** `companies` (upsert with cross-linked IDs), `company_source_data` (raw per-source)

**UI:** `CompaniesPage`, `useCompanies` -- the company list derives from global-sync created/updated companies

**Status:** **Fully operational.** Runs every 6hr via pg_cron. Has preview mode (dry run) and sync mode.

---

### 8. asana-projects-sync

**Source:** Asana API v1
- `/portfolios/{gid}/items` -- projects from configured portfolios
- `/projects/{gid}` -- task counts per project
- Reads `asana_config` table for portfolio GIDs

**Transform:**
- Extracts project details (status, dates, owner, team, custom fields, task counts)
- Resolves company via `project_mappings` -> `harvest_projects` chain
- Stores full raw data in `raw_data` JSONB

**Destination:** `asana_projects` (upsert on `asana_project_gid`)

**UI:** `useProjects` hook

**Status:** **Working but manual only.** Not in pg_cron migration (comment says "every 2h" but job not created). Requires `asana_config` and `project_mappings` tables to be populated.

---

### 9. harvest-sync

**Source:** Harvest v2 API
- `/v2/projects` -- all projects
- `/v2/time_entries` -- last 2 years
- `/v2/invoices` -- all invoices
- `/v2/invoices/{id}/payments` -- payments for paid invoices
- `/v2/contacts` -- client contacts

**Transform:**
- Projects: maps Harvest client IDs to local company IDs
- Time entries: preserves full billing metadata (rates, hours, billed status)
- Invoices: preserves full financial data (amounts, taxes, discounts, dates, state)
- Contacts: deduplicates by email + company

**Destination:**
- `harvest_projects` (upsert on `harvest_project_id`)
- `harvest_time_entries` (upsert on `harvest_time_entry_id`)
- `harvest_invoices` (upsert on `harvest_invoice_id`)
- `harvest_invoice_payments` (upsert on `harvest_payment_id`)
- `contacts` (insert/update by email dedup)

All store full raw data in `raw_data` JSONB.

**UI:** `CompanyDetailPage` reads time entries, invoices, and payments for the Delivery tab

**Status:** **Working but manual only.** No pg_cron. Requires explicit `userId` in body. No sync_runs logging.

---

### 10. freshdesk-sync

**Source:** Freshdesk v2 API
- `/tickets` -- with requester, stats, description (last 2 years)
- `/tickets/{id}/conversations` -- per-ticket conversations
- `/contacts` -- all contacts

**Transform:**
- Tickets: maps status/priority/source to human labels, extracts requester info
- Conversations: extracts body text, direction (incoming/outgoing), privacy
- Contacts: deduplicates by email + company

**Destination:**
- `freshdesk_tickets` (upsert on `freshdesk_ticket_id`)
- `freshdesk_ticket_conversations` (upsert on `freshdesk_conversation_id`)
- `contacts` (insert/update by email dedup)

All store full raw data.

**UI:** `CompanyDetailPage` reads tickets for the Support tab

**Status:** **Working but manual only.** No pg_cron. Requires explicit `userId` in body. No sync_runs logging.

---

### 11. gmail-sync

**Source:** Gmail API v1
- `/users/me/messages` -- search by domain or contact emails
- `/users/me/messages/{id}` -- full message with headers, body, attachments

**Auth:** OAuth via `oauth_connections` table (provider=gmail). Auto-refreshes expired tokens using `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`.

**Transform:**
- Extracts headers (Subject, From, To, Date), body (text/plain priority), attachments
- Stores full body text (up to 10K chars)

**Destination:** `company_emails` (upsert on `gmail_id,user_id`)

**KB:** Yes -- auto-vectorizes via `rag-auto-ingest` (finds primary crawl session, formats emails, calls `rag-ingest`)

**UI:** `useCompanyEmails` hook

**Status:** **Requires Gmail OAuth connection.** Per-company invocation (not global). No pg_cron.

---

### 12. slack-sync

**Source:** Slack Web API
- `search.messages` -- searches by company name and/or domain

**Auth:** OAuth via `oauth_connections` table (provider=slack).

**Transform:**
- Deduplicates by message timestamp
- Extracts channel, author, text, permalink

**Destination:** `company_messages` (upsert on `message_ts,channel_id,user_id`)

**KB:** Yes -- auto-vectorizes via `rag-auto-ingest`

**UI:** `useCompanyMessages`, `SlackMessagesCard`

**Status:** **Requires Slack OAuth connection.** Per-company invocation. No pg_cron.

---

### 13. avoma-sync

**Source:** Avoma API v1
- `/v1/meetings/` -- filtered by attendee emails or broad scan
- `/v1/transcriptions/{uuid}/` -- full transcript

**Auth:** `AVOMA_API_KEY` (env)

**Transform:**
- Matches meetings to companies by attendee email domain, organizer, or name/subject match
- Enriches top 10 matches with full transcripts (speaker-labeled)
- Stores attendees, summary, transcript, recording URL

**Destination:** `company_meetings` (upsert on `external_id,source,user_id`)

**KB:** Yes -- auto-vectorizes via `rag-auto-ingest`

**UI:** `useCompanyMeetings`, `useCompanyAvoma`

**Status:** **Working but manual only.** Per-company invocation. No pg_cron.

---

### 14. rag-vectorize-comms

**Source:** Internal tables -- reads from `engagements`, `company_emails`, `company_meetings`, `company_messages`

**Transform:**
- Finds unvectorized records (checks `knowledge_documents.source_key` for dedup)
- Formats each record as a text document with metadata headers
- Groups by company, creates synthetic `crawl_sessions` (domain = `_comms_{companyId}`)
- Calls `rag-ingest` to chunk + embed + store

**Destination:** `knowledge_documents` + `knowledge_chunks` (via rag-ingest)

**Status:** **Working but manual only.** Should be scheduled after communication syncs. Caps at 200 docs per run.

---

### 15. crawl-recover

**Source:** Internal -- reads `crawl_sessions` and `integration_runs`

**Transform:**
- Finds sessions stuck in 'analyzing' > 10min or 'pending' > 2min
- Marks zombie integration_runs as failed
- Computes final session status (completed/completed_with_errors/failed)

**Destination:** `crawl_sessions`, `integration_runs` (status updates)

**Status:** **Fully operational.** Runs every 5min via pg_cron.

---

### 16. enrich-companies

**Source:** Ocean.io API
**Auth:** `OCEAN_IO_API_KEY` (env)
**Destination:** `companies.enrichment_data` (JSONB)
**Status:** Working. Triggered by hubspot-deals-sync and hubspot-contacts-sync for new companies.

### 17. enrich-contacts

**Source:** Apollo API (`/v1/people/match`)
**Auth:** `APOLLO_API_KEY` (env)
**Destination:** `contacts` (Apollo-specific fields)
**Status:** Working. Triggered by hubspot-contacts-sync for new leads.

### 18. integration-health

**Source:** Multiple APIs (BuiltWith, GTmetrix, PageSpeed, HubSpot, Harvest, Freshdesk, Apollo, Ocean.io, etc.)
**Auth:** Various env keys
**Destination:** None (returns JSON response)
**UI:** Settings panel
**Status:** Working. Live health check on demand.

---

## Auth Patterns

| Pattern | Functions | Notes |
|---------|-----------|-------|
| **Env var (PAT/API key)** | hubspot-*, global-sync, harvest-sync, freshdesk-sync, avoma-sync, enrich-*, apollo-*, ocean-* | Static tokens. Work for pg_cron. |
| **OAuth (oauth_connections table)** | gmail-sync, slack-sync | Requires user-initiated OAuth flow. Token refresh built into gmail-sync. Slack uses bot token (no refresh). |
| **Service role** | crawl-recover, rag-vectorize-comms | Internal functions that only access Supabase. |

---

## What's Working vs Broken vs Missing

### Working (automated)
- `hubspot-deals-sync` -- pg_cron every 30min
- `hubspot-contacts-sync` -- pg_cron every 30min
- `global-sync` -- pg_cron every 6hr
- `crawl-recover` -- pg_cron every 5min

### Working (manual only -- needs pg_cron)
- `hubspot-engagements-sync` -- should be scheduled (e.g., every 2hr)
- `hubspot-form-submissions-sync` -- should be scheduled (and needs UI)
- `asana-projects-sync` -- should be scheduled (every 2-4hr)
- `harvest-sync` -- should be scheduled (every 4-6hr)
- `freshdesk-sync` -- should be scheduled (every 4-6hr)
- `avoma-sync` -- per-company, harder to automate globally
- `rag-vectorize-comms` -- should run after comm syncs (e.g., every 3hr)

### Working but requires OAuth setup
- `gmail-sync` -- needs Gmail OAuth connection in `oauth_connections`
- `slack-sync` -- needs Slack OAuth connection in `oauth_connections`

### Data dead-ends (synced but no UI)
- `form_submissions` -- populated by hubspot-form-submissions-sync, no React component reads it
- `engagements` -- populated but only used in cleanup phases, no timeline/activity UI
- `freshdesk_ticket_conversations` -- populated but CompanyDetailPage only shows tickets, not conversations
- `harvest_projects` -- populated by harvest-sync but not queried by any React component (asana_projects has UI but harvest_projects doesn't)

### Legacy / superseded
- `hubspot-sync` -- replaced by individual hubspot-*-sync functions (keeps contacts, deals, engagements all in one but less capable)

### Missing sync_runs logging
- `harvest-sync` -- no startSyncRun/completeSyncRun calls
- `freshdesk-sync` -- no startSyncRun/completeSyncRun calls
- `hubspot-sync` (legacy) -- no sync_runs logging

### sync_health view gaps
The `sync_health` view only tracks 4 functions (hubspot-deals-sync, hubspot-contacts-sync, global-sync, crawl-recover). Should be expanded to include all scheduled syncs once they're added to pg_cron.
