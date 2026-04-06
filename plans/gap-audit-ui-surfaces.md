# UI Surfaces Gap Audit — Data Displayed vs Available vs Missing

> Generated 2026-04-05 by ui-auditor agent

---

## 1. CompaniesPage (`src/pages/CompaniesPage.tsx`)

Data source: `useCompanies()` hook → `companies` table + `contacts` count + `crawl_sessions` count + deals/leads for Growth pipeline.

### Growth Workspace Table

| Field Displayed | Data Source | Available But Not Shown | Could Have If Connected |
|---|---|---|---|
| Company name | `companies.name` | `description` | — |
| Logo | `companies.logo_url` | — | — |
| Domain (DomainLink) | `companies.domain` | — | — |
| Primary contact name | JOIN `contacts` (is_primary=true) | contact title, email, phone, seniority | — |
| Deal stage label | JOIN `deals.properties.stage_label` | deal amount, close date, pipeline name | — |
| Lead status | JOIN `contacts.lead_status` | lifecycle_stage, lead owner | — |
| **Stats bar**: "X with domain", "X with contacts" | computed | — | — |

**NOT shown but available in DB**: industry, employee_count, annual_revenue, location, enrichment_data (Apollo/Ocean), status, tags, QB invoice data, Harvest/Asana/Freshdesk IDs, site_count.

### Delivery Workspace Table

| Field Displayed | Data Source |
|---|---|
| Company name + domain subtitle | `companies.name`, `companies.domain` |
| Logo | `companies.logo_url` |
| Services (source badges: H/A/HS) | `harvest_client_id`, `asana_project_gids`, `hubspot_company_id` |
| Last Activity | `deal_close_date` OR `lead_updated_at` OR `last_synced_at` OR `updated_at` |
| Contact count | COUNT(`contacts`) |

**NOT shown**: industry, employee_count, revenue, location, QB invoice history, project status, active deal value.

### Admin Workspace Table

| Field Displayed | Data Source |
|---|---|
| Company name | `companies.name` |
| Logo | `companies.logo_url` |
| Last Invoice date | `companies.quickbooks_invoice_summary.lastDate` |
| Total Revenue | `companies.quickbooks_invoice_summary.total` |
| Status badge | `companies.status` |

**NOT shown**: domain, industry, contact count, deal count, services breakdown from QB, Harvest hours.

---

## 2. CompanyDetailPage — Overview Tab (`src/pages/CompanyDetailPage.tsx` lines 500-732)

### Company Header (all workspaces)

| Field Displayed | Data Source |
|---|---|
| Name | `companies.name` |
| Logo | `companies.logo_url` |
| Status (editable dropdown) | `companies.status` |
| Description | `companies.description` |
| Domain (DomainLink) | `companies.domain` |
| Industry | `companies.industry` |
| Employee count | `companies.employee_count` |
| Annual revenue | `companies.annual_revenue` |
| Location | `companies.location` |

**NOT shown in header**: tags, notes, created_at, hubspot_company_id, harvest_client_id, freshdesk_company_id, website_url, last_synced_at.

### Metrics Row (Overview)

| Field Displayed | Data Source |
|---|---|
| Deal Value (total) | SUM(`deals.amount`) — fetched on-demand |
| Open Deals count | COUNT(`deals` where status=open/active/pending) |
| Last Activity | MAX(engagements.occurred_at, deals.close_date) |
| Enrichment score (X/6) | COUNT of keys in `enrichment_data` (apollo_org, ocean, avoma, apollo_team, hubspot, semrush) |

**NOT shown**: total contact count, site count, total hours logged, total revenue (QB), project status summary.

### Quick Actions

| Action | What It Does |
|---|---|
| Enrich Company (Ocean.io) | Calls `oceanApi.enrich()` → saves to `enrichment_data.ocean` |
| Run Crawl | Navigates to `/crawls` |
| Start Chat | Switches to Chat tab |

**Missing actions**: Enrich with Apollo Org, Sync from HubSpot, Sync from Harvest, Add Contact manually, Create Deal.

### Deals Section (Overview)

| Field Displayed | Data Source |
|---|---|
| Deal name | `deals.name` |
| Status badge | `deals.status` |
| Amount | `deals.amount` |
| Close date | `deals.close_date` |

**NOT shown but available**: `deals.stage`, `deals.pipeline`, `deals.created_at`, deal owner, deal source, forecast probability (these are in HubSpot `properties` JSONB but not synced to deals table columns).

### Contacts Section (Overview)

| Field Displayed | Data Source |
|---|---|
| Photo | `contacts.photo_url` |
| Full name | `contacts.first_name` + `last_name` |
| Primary badge | `contacts.is_primary` |
| Lead status badge | `contacts.lead_status` |
| Seniority badge | `contacts.seniority` |
| Title | `contacts.title` |
| Department | `contacts.department` |
| Email | `contacts.email` |
| Phone icon | `contacts.phone` (icon only, not value) |
| LinkedIn icon | `contacts.linkedin_url` (icon link) |
| Enrich button (per contact) | Calls `apolloApi.enrich()` |
| Find Team button | Calls `apolloApi.teamSearch()` |

**NOT shown**: lifecycle_stage, role_type, enrichment_data details (employment history, org intel), created_at.

### Sites Section (Overview)

| Field Displayed | Data Source |
|---|---|
| Domain | `crawl_sessions.domain` |
| Created date | `crawl_sessions.created_at` |

**NOT shown**: audit scores (PSI, WAVE, etc. — available on crawl_sessions), status, base_url. Site detail is in a drawer.

### Ocean.io Card (Overview)

Displays full `OceanCard` from `enrichment_data.ocean`. Shows demographics, technologies, traffic, departments.

### Apollo Org Card (Overview)

| Field Displayed | Data Source |
|---|---|
| Org name, description, logo | `enrichment_data.apollo_org.organization*` fields |
| Industry, employees, revenue, founded, location, phone | apollo_org fields |
| Headcount growth (6/12/24mo) | apollo_org fields |
| Social links (LinkedIn, Twitter, Facebook, Crunchbase) | apollo_org fields |
| Industries tab (primary/secondary, SIC/NAICS) | apollo_org fields |
| Tech Stack tab | `enrichment_data.apollo_org.organizationTechnologies` |
| Keywords tab | `enrichment_data.apollo_org.organizationKeywords` |
| Alexa rank, ticker | apollo_org fields |

### Engagements Section (Overview)

| Field Displayed | Data Source |
|---|---|
| Type icon (email/call/meeting/note/task) | `company-artifacts` edge fn → HubSpot |
| Type label | engagement_type |
| Direction badge | direction |
| Date | occurred_at |
| Subject | subject |
| Body preview | body_preview |

**Note**: Engagements still come from `company-artifacts` edge function (HubSpot API live), NOT from local DB.

### Notes Section (Overview)

| Field Displayed | Data Source |
|---|---|
| Notes text | `companies.notes` |

---

## 3. CompanyDetailPage — Deals Tab (lines 734-768)

| Field Displayed | Data Source |
|---|---|
| Deal name | `deals.name` |
| Status badge | `deals.status` |
| Amount | `deals.amount` |
| Close date | `deals.close_date` |
| Pipeline name | `deals.pipeline` |

**NOT shown**: deal stage, deal owner, deal type, deal source, forecast probability, created_at, contact associated with deal.

---

## 4. CompanyDetailPage — Projects Tab (lines 770-811)

Data source: `company-artifacts` edge function → Harvest API (still live, NOT from local DB).

| Field Displayed | Data Source |
|---|---|
| Project name | Harvest API `name` |
| Project code | Harvest API `code` |
| Active/Archived badge | `is_active` |
| Billable badge | `is_billable` |
| Budget | `budget` + `budget_by` |
| Hourly rate | `hourly_rate` |
| Fee | `fee` |
| Start/End dates | `starts_on`, `ends_on` |
| Notes | `notes` |

**NOT shown**: Asana project status (from `asana_projects` table), task completion %, team members, portfolio.

---

## 5. CompanyDetailPage — Time Tab (lines 813-874)

Data source: `harvest_time_entries` table (local DB).

| Field Displayed | Data Source |
|---|---|
| Total Hours (sum) | computed from `hours` |
| Billable Hours (sum) | computed from `hours` where `billable=true` |
| Entry count | row count |
| Per-entry: Date, Project, Task, Person, Hours, Notes | `spent_date`, `project_name`, `task_name`, `harvest_user_name`, `hours`, `notes` |

**NOT shown but available**: billable_rate, cost_rate, is_locked, is_running, rounded_hours, billable flag per row, harvest_task_id, harvest_project_id.

---

## 6. CompanyDetailPage — Tickets Tab (lines 961-1023)

Data source: `freshdesk_tickets` table (local DB).

| Field Displayed | Data Source |
|---|---|
| Total tickets, Open/Pending, Resolved/Closed (counts) | computed |
| Subject | `subject` |
| Status badge | `status_label` |
| Priority | `priority_label` |
| Requester name | `requester_name` |
| Ticket type | `ticket_type` |
| Source | `source_label` |
| Created date | `created_date` |
| Description preview | `description_text` (line-clamp-2) |

**NOT shown but available**: due_by, updated_at, tags, agent assigned, resolution time.

---

## 7. CompanyDetailPage — Invoices Tab (lines 877-958)

Data source: `companies.quickbooks_invoice_summary` JSONB.

| Field Displayed | Data Source |
|---|---|
| Total Revenue | `qb.total` |
| Transaction count | `qb.count` |
| First/Last Transaction dates | `qb.firstDate`, `qb.lastDate` |
| Transaction Types breakdown | `qb.transactionTypes` |
| Services breakdown (name + count + total) | `qb.services` |
| Sample memos | `qb.sampleMemos` |

**NOT shown**: individual invoice line items (we only have summary JSONB, not line-level data).

---

## 8. CompanyDetailPage — Voice Tab (`src/components/company/CompanyVoiceTab.tsx`)

### Meetings sub-tab (Avoma)

| Field Displayed | Data Source |
|---|---|
| Meeting search results via AvomaCard | `useCompanyAvoma()` → Avoma API → cached in `enrichment_data.avoma` |

### Emails sub-tab (Gmail)

| Field Displayed | Data Source |
|---|---|
| Email threads via GmailCard | Gmail API via `GmailCard` component |

### Messages sub-tab (Slack)

| Field Displayed | Data Source |
|---|---|
| Slack messages via SlackMessagesCard | Slack API search |

---

## 9. CompanyDetailPage — Knowledge Tab

Uses `CompanyKnowledgeTab` → manages documents, Google Drive folder sync, document library per company.

---

## 10. CompanyDetailPage — Chat Tab (lines 1117-1156)

Multi-model AI chat via `KnowledgeChatCard`. Company context injected includes: name, domain, industry, employees, revenue, location, description, contacts list, deals list.

---

## 11. CompanyDetailPage — Patterns Tab (`src/components/company/CompanyPatternsTab.tsx`)

| Field Displayed | Data Source |
|---|---|
| AI Suggestions section | `usePatternSuggestions(companyId)` → `pattern_suggestions` table |
| Pattern cards (title, type, block_type, status, confidence, lift %) | `patterns` table |
| Applied patterns (date, outcome) | `pattern_applications` table |
| Per-suggestion: reasoning, customizations | AI-generated fields |

---

## 12. CompanyDetailPage — Source Data Tab (lines 1168-1200+)

| Field Displayed | Data Source |
|---|---|
| Enrichment data (Apollo Team, Apollo Org, Ocean.io, Avoma) — collapsible raw JSON | `companies.enrichment_data` JSONB |
| Contact enrichment data (Apollo per-contact) | `contacts.enrichment_data.apollo` |
| company_source_data rows | `company_source_data` table |

---

## 13. CompanyDetailPage — Roadmap / Estimates / Proposal Tabs

These are generative tools, not data display surfaces. They use company context + chat session.

---

## 14. PipelinePage — Leads Tab (`src/pages/PipelinePage.tsx`)

Data source: `usePipelineLeads()` → `hubspot-pipeline` edge function (HubSpot API, cached via TanStack Query).

### Lead Metrics Bar

| Field Displayed | Data Source |
|---|---|
| Total Leads | count of filtered contacts |
| New This Week | contacts created in last 7 days |
| Avg Lead Age | avg days since `createdate` |
| Avg First Touch | avg hours from `createdate` to `notes_last_updated` |
| Owners count | unique `hubspot_owner_id` |
| Unassigned count | contacts without `hubspot_owner_id` |

### Lead Cards (Kanban by lead_status)

| Field Displayed | Data Source |
|---|---|
| Company name (linked) | `contact.company` + `contact.companyId` |
| Company domain (DomainLink) | `contact.companyDomain` |
| Contact photo | `contact.contactPhotoUrl` |
| Contact name | `contact.firstname` + `lastname` |
| Contact title | `contact.contactTitle` OR `jobtitle` |
| Email | `contact.email` |
| Created date (relative) | `contact.createdate` |
| Owner (first name) | `leadOwners[hubspot_owner_id]` |

**NOT shown**: phone, lifecycle stage, last modified date, last email send date, LinkedIn URL, seniority, department.

### Lead Detail Drawer

| Field Displayed | Data Source |
|---|---|
| Photo, name, title | HubSpot contact fields |
| Status label | `leadStatuses` lookup |
| HubSpot link | constructed URL |
| Email, phone, LinkedIn | contact fields + `brainContact` (local contacts table match) |
| Contact owner | `leadOwners` lookup |
| Lead status, lifecycle stage | HubSpot fields |
| Created / Last modified dates | HubSpot timestamps |
| Last email send date | `hs_email_last_send_date` |
| Company / company link | contact.company + companyId |
| Brain enrichment (seniority, department, photo) | Local `contacts` table matched by email |

**NOT shown**: Apollo enrichment details, employment history, org intel from local contacts table.

---

## 15. PipelinePage — Deals Tab

Data source: `usePipelineDeals()` → `hubspot-pipeline` edge function → HubSpot API (cached via TanStack Query).

### Deal Metrics Bar

| Field Displayed | Data Source |
|---|---|
| Open Pipeline value | SUM(amount) of open deals |
| Weighted Pipeline | SUM(amount × stage_probability) |
| Avg Deal Size | open pipeline / deal count |
| Avg Sales Cycle | from `historicalStats` |
| Win Rate | from `historicalStats` |
| Closing This Month value + count | deals with close_date in current month |

### Deal Velocity Panel (`DealVelocityPanel.tsx`)

| Field Displayed | Data Source |
|---|---|
| Win Rate (%, W/L counts) | computed from won/lost stage IDs |
| Avg Won Cycle (days) | computed from create→close delta |
| Avg Won Value | computed |
| Open Deal Age (avg days) | computed from open deals |
| Deals by Stage chart | bar chart from stage distribution |
| Pipeline Volume 12-month chart | bar chart from createdate buckets |

### Deal Cards (Kanban by stage)

| Field Displayed | Data Source |
|---|---|
| Company name (linked) | `deal.companyName` + `deal.companyId` |
| Company domain (DomainLink) | `deal.companyDomain` |
| Contact photo | `deal.contactPhotoUrl` |
| Contact name | `deal.contactName` |
| Contact title | `deal.contactTitle` |
| Amount | `deal.amount` |
| Close date (with days remaining) | `deal.closedate` |
| Deal source | `deal.deal_source_details` |

**NOT shown on card**: deal type, priority, forecast probability, owner, created date, last contacted, last modified.

### Deal Detail Drawer

| Field Displayed | Data Source |
|---|---|
| Deal name | `dealname` |
| HubSpot link | constructed URL |
| Amount | `amount` |
| Close date | `closedate` |
| Pipeline label | `pipelineInfo.label` |
| Deal stage label | stage lookup |
| Deal owner | `owners[hubspot_owner_id]` |
| Last Contacted | `notes_last_contacted` |
| Deal Type | `dealtype` |
| Priority | `hs_priority` |
| Deal Source | `deal_source_details` |
| Forecast Probability | `hs_forecast_probability` |
| Company name | `companyName` |
| Created date | `createdate` |

**NOT shown**: associated contacts list, deal activities/engagements, notes, next steps.

---

## 16. ContactsPage (`src/pages/ContactsPage.tsx`)

Data source: `useContacts()` → `contacts` table + company name JOIN.

### Table View

| Field Displayed | Data Source |
|---|---|
| Photo | `contacts.photo_url` OR `enrichment_data.apollo.photo_url` |
| Name | `first_name` + `last_name` |
| Primary badge | `is_primary` |
| Title | `contacts.title` OR `enrichment_data.apollo.title` |
| Email (clickable mailto) | `contacts.email` |
| Phone icon | `contacts.phone` (icon only) |
| LinkedIn icon | `contacts.linkedin_url` (icon only) |
| Company name (linked) | JOIN `companies.name` via `company_id` |
| Lead status badge | `contacts.lead_status` |
| Enriched/Not enriched badge | check for `enrichment_data.apollo` presence |
| Enrichment stats ("X/Y enriched") | computed |
| Bulk Enrich button | calls `enrich-contacts` edge function |

**NOT shown**: seniority, department, lifecycle_stage, role_type, created_at, updated_at, company domain, company industry.

### Card View

Same fields as table, slightly different layout.

---

## 17. ContactDetailPage (`src/pages/ContactDetailPage.tsx`)

Data source: Direct `contacts` table query + company + deals.

### ContactDetailContent (`src/components/contacts/ContactDetailContent.tsx`)

| Field Displayed | Data Source |
|---|---|
| **If Apollo enriched**: Full Apollo person header (photo, name, title, org) | `enrichment_data.apollo` via `ApolloPersonHeader` |
| **If not enriched**: Photo, name, seniority, title, department | `contacts` table fields |
| Badges: Primary, Lead Status, Lifecycle Stage, Role Type, Company Name | contact fields |
| Contact info: Email, Phone, LinkedIn | contact fields OR apollo data |
| Apollo Employment section (employment history) | `enrichment_data.apollo` via `ApolloEmploymentSection` |
| Apollo Org section (company intel) | `enrichment_data.apollo` via `ApolloOrgSection` |
| Company Deals (name, status, amount, close date) | `deals` table JOIN on company_id |

**NOT shown**: Slack messages about this contact, emails with this contact, meetings with this contact, activity timeline.

---

## 18. ProjectsPage (`src/pages/ProjectsPage.tsx`)

Data source: `useProjects()` → `asana_projects` + `project_mappings` + `harvest_project_budgets` (all local DB).

| Field Displayed | Data Source |
|---|---|
| Client name (grouped) | extracted from Asana project name or `project_mappings.client_display_name` |
| Service type badge (CI/SEO/PPC/etc.) | extracted from project name |
| Status dot (green/yellow/red/blue) | `asana_projects.status_color` |
| Status label | mapped from color |
| Task progress (completed/total, %) | `num_completed_tasks`, `num_tasks` |
| Owner (first name) | `asana_projects.owner` |
| Budget bar (spent/total) | `harvest_project_budgets.budget_spent` / `budget` |
| Company link | `asana_projects.company_id` OR name match to companies |
| Stats: clients, projects, at risk, off track, over budget | computed |

**NOT shown but available**: `status_text`, `team_members[]`, `portfolio_name`, `milestone_name`, `custom_fields`, `start_date`, `due_date`, `is_archived`, `num_incomplete_tasks`.

---

## 19. ConnectionsPage (`src/pages/ConnectionsPage.tsx`)

Not audited in detail — this is an admin/settings page for managing integration connections, not a data display surface.

---

## Summary: Key Gaps Identified

### Data Available in DB But Not Surfaced

1. **Deals table has limited columns shown** — `stage`, `pipeline`, `created_at` are available but rarely displayed; `properties` JSONB has deal owner, type, source, probability but these are only shown in the Pipeline drawer (not in company detail).
2. **Contact enrichment detail hidden** — Apollo employment history, org intel, seniority are in `enrichment_data.apollo` but only visible in ContactDetailContent drawer/page, never on list views or company overview.
3. **Project metadata missing from ProjectsPage** — `team_members`, `portfolio_name`, `start_date`, `due_date`, `custom_fields` are in `asana_projects` but not rendered.
4. **Harvest time entry details** — `billable_rate`, `cost_rate`, `billable` flag per row available but not shown.
5. **Freshdesk ticket details** — `due_by`, `tags`, `agent`, resolution time available but not shown.
6. **Company tags and notes** — `companies.tags` and `companies.notes` only shown in Overview (notes); tags never shown anywhere.
7. **Companies list pages lack enrichment indicators** — No way to see which companies have Apollo/Ocean data without opening each one.

### Data Still Coming from Live APIs (Not Local DB)

1. **Leads page** — `usePipelineLeads()` calls `hubspot-pipeline` edge function (HubSpot API live).
2. **Deals page** — `usePipelineDeals()` calls `hubspot-pipeline` edge function (HubSpot API live).
3. **Company detail Engagements** — `company-artifacts` edge fn → HubSpot engagements API.
4. **Company detail Projects** — `company-artifacts` edge fn → Harvest projects API.
5. **Company detail Invoices** — `company-artifacts` edge fn → Harvest invoices API (but actually reads QB summary from company record).

### Data We Could Have If Better Connected

1. **HubSpot deal properties** — deal owner name, deal type, source, probability, next activity date — synced to `deals` table but stored in `properties` JSONB, not unpacked to columns.
2. **HubSpot engagement details** — full email bodies, call recordings, meeting notes — currently only preview shown.
3. **Asana task-level data** — individual tasks, assignees, due dates, comments — we only sync project-level summaries.
4. **Harvest invoice line items** — individual invoice lines, payment status — we only have QB summary.
5. **Apollo company data enrichment** — job postings, funding rounds, news — available via Apollo API but not fetched.
6. **Google Analytics** — traffic, conversions, revenue data per company domain — GA4 OAuth connected but data not surfaced on company pages.
7. **Google Search Console** — search performance per company domain — connected but not surfaced.
8. **Freshdesk conversation threads** — full ticket conversation history — we only show ticket metadata.
