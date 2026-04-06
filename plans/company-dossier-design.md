# Company Dossier Design — The Complete Intelligence File

> "Check any company and see every integration source and LOADS of data."
> — Agency Brain Architecture, April 2026

**Generated:** 2026-04-05 by dossier-designer agent

---

## Design Philosophy

The company page is the **single pane of glass** for everything GLIDE knows about a company. When all Connections and Knowledge Base layers are complete, opening a company should feel like opening a thick intelligence dossier — every data point, every communication, every pattern, every outcome — all present, all connected.

The dossier is organized by the Agency Brain pillars: **Connections** feed in, **Knowledge Base** stores, **Patterns** emerge, **Insights** interpret, **Actions** recommend, **Outcomes** prove, **Learning** compounds.

---

## Tab-by-Tab Design

### 1. Overview Tab

**Purpose:** The executive briefing. 30-second scan of everything that matters.

#### Current State
- **Metrics row:** Deal Value, Open Deals, Last Activity, Enrichment Score (X/8)
- **Quick actions:** Enrich Company (Ocean), Run Crawl, Start Chat
- **Sections:** Deals list, Contacts list, Sites list, Ocean card, Apollo Org card, GA4 summary card (if data), GSC summary card (if data), Technologies, Recent Activity (engagements), Notes
- **Data sources:** `companies.*`, `deals.*`, `contacts.*`, `crawl_sessions.*`, `engagements.*`, `enrichment_data.{ocean,apollo_org,apollo_team,ga4,search_console}`

#### Desired State — "The Intelligence Briefing"

**Company Identity Card** (top section, always visible):
- Logo, name, status, description (current)
- Domain, industry, employee count, revenue, location (current)
- **ADD:** Tags displayed as badges (from `companies.tags`)
- **ADD:** Connection status badges showing which systems are linked: HubSpot (HS), Harvest (H), Asana (A), Freshdesk (FD), QuickBooks (QB), GA4, GSC — each with green/gray indicator
- **ADD:** "Last synced" timestamp from `companies.last_synced_at`
- **ADD:** Company age (from `companies.created_at` — "In system since...")

**Metrics Row — Expanded** (2 rows of 4):
| Metric | Source | Status |
|--------|--------|--------|
| Deal Value (total) | `SUM(deals.amount)` | EXISTS |
| Open Deals | `COUNT(deals)` filtered | EXISTS |
| Last Activity | `MAX(engagements.occurred_at)` | EXISTS |
| Enrichment Score | count of enrichment keys | EXISTS |
| **Total Contacts** | `COUNT(contacts)` | MISSING |
| **Total Hours** | `SUM(harvest_time_entries.hours)` | MISSING |
| **Total Revenue (QB)** | `quickbooks_invoice_summary.total` | MISSING |
| **Open Tickets** | `COUNT(freshdesk_tickets)` filtered | MISSING |

**Quick Actions — Expanded:**
| Action | Status |
|--------|--------|
| Enrich Company (Ocean) | EXISTS |
| Run Crawl | EXISTS |
| Start Chat | EXISTS |
| **Enrich with Apollo Org** | MISSING |
| **Sync from HubSpot** | MISSING |
| **Sync from Harvest** | MISSING |
| **Add Contact** | MISSING |
| **Create Deal** | MISSING |
| **Sync Meetings** | MISSING |

**Section: Pipeline Snapshot** (NEW):
- Mini deal funnel visualization — how many deals at each stage
- Source: `deals.stage` grouped
- Includes win rate if enough historical deals

**Section: Contacts** — current display is good, keep as-is

**Section: Sites** — add audit score badges (PSI performance, accessibility, SEO scores from `crawl_sessions`)

**Section: Communication Timeline** (ENHANCED):
- Unified timeline merging: engagements (HubSpot), meetings (company_meetings), emails (company_emails), messages (company_messages), form submissions
- Source: `engagements`, `company_emails`, `company_meetings`, `company_messages`, `form_submissions`
- Currently only shows engagements

**Section: Enrichment Cards** — Ocean, Apollo Org, GA4, GSC — current display is good

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| Tags not displayed | `companies.tags` | Low |
| Connection status indicators | `hubspot_company_id`, `harvest_client_id`, etc. | Medium |
| Contact count metric | `contacts` table | Low |
| Total hours metric | `harvest_time_entries` | Medium |
| Total revenue metric | `quickbooks_invoice_summary` | Medium |
| Open tickets metric | `freshdesk_tickets` | Medium |
| Apollo Org enrichment action | `apolloApi.orgEnrich()` | Medium |
| Sync from HubSpot action | edge function | Medium |
| Add Contact action | insert to `contacts` | Low |
| Create Deal action | insert to `deals` | Low |
| Site audit score badges | `crawl_sessions` audit data | Medium |
| Unified communication timeline | `company_emails`, `company_meetings`, `company_messages`, `form_submissions` + `engagements` | High |
| Pipeline snapshot visualization | `deals.stage` | Medium |

---

### 2. Deals Tab

**Purpose:** Complete pipeline view for this company.

#### Current State
- Lists deals with: name, status badge, amount, close date, pipeline name
- Data from local `deals` table
- Empty state guides user to connect HubSpot

#### Desired State

**Metrics Row:**
| Metric | Source | Status |
|--------|--------|--------|
| Total Pipeline Value | `SUM(deals.amount)` open | EXISTS (on overview, not deals tab) |
| **Won Revenue** | `SUM(deals.amount)` where status=won | MISSING |
| **Win Rate** | won / (won + lost) | MISSING |
| **Avg Deal Size** | computed | MISSING |
| **Avg Sales Cycle** | won deal create→close delta | MISSING |

**Deal Cards — Enhanced:**
| Field | Source | Status |
|-------|--------|--------|
| Deal name | `deals.name` | EXISTS |
| Status badge | `deals.status` | EXISTS |
| Amount | `deals.amount` | EXISTS |
| Close date | `deals.close_date` | EXISTS |
| Pipeline | `deals.pipeline` | EXISTS |
| **Stage** | `deals.stage` | MISSING |
| **Deal type** | `deals.deal_type` | MISSING |
| **Priority** | `deals.priority` | MISSING |
| **Owner** | `deals.hubspot_owner_id` → name lookup | MISSING |
| **Associated contact** | `deals.contact_id` → contact name | MISSING |
| **Created date** | `deals.created_at` | MISSING |
| **Deal source** | `deals.properties.deal_source_details` | MISSING |
| **Forecast probability** | `deals.properties.hs_forecast_probability` | MISSING |

**NEW: Deal Detail Drawer** — click a deal to see full detail + associated engagements

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| Metrics row on deals tab | computed from `deals` | Medium |
| Stage display | `deals.stage` | High |
| Deal type, priority | `deals.deal_type`, `deals.priority` | Medium |
| Owner name resolution | `deals.hubspot_owner_id` | Medium |
| Associated contact | `deals.contact_id` FK | Medium |
| Deal detail drawer | deals + engagements | Medium |
| Deal source / forecast | `deals.properties` JSONB | Low |

---

### 3. Projects Tab

**Purpose:** All project work for this company — Harvest billing + Asana execution.

#### Current State
- Lists Harvest projects: name, code, active/archived badge, billable badge, budget, hourly rate, fee, start/end dates, notes
- Data from local `harvest_projects` table
- Only shows for companies with `harvest_client_id`

#### Desired State

**Two sub-sections: Harvest Projects + Asana Projects**

**Harvest Projects** — current display plus:
| Field | Source | Status |
|-------|--------|--------|
| All current fields | `harvest_projects.*` | EXISTS |
| **Budget spent** | `SUM(harvest_time_entries.hours)` per project via `harvest_project_id` | MISSING |
| **Budget remaining** | budget - spent | MISSING |
| **Budget % bar** | computed | MISSING |
| **Team members** | DISTINCT `harvest_time_entries.harvest_user_name` per project | MISSING |
| **Cost budget** | `harvest_projects.cost_budget` | MISSING |

**Asana Projects** (NEW section):
| Field | Source | Status |
|-------|--------|--------|
| Project name | `asana_projects.name` | NOT SHOWN on company page |
| Status color/label | `asana_projects.status_color`, `status_text` | NOT SHOWN |
| Task progress | `num_completed_tasks` / `num_tasks` with progress bar | NOT SHOWN |
| Owner | `asana_projects.owner` | NOT SHOWN |
| Start/due dates | `asana_projects.start_date`, `due_date` | NOT SHOWN |
| Team members | `asana_projects.team_members` array | NOT SHOWN |
| Portfolio | `asana_projects.portfolio_name` | NOT SHOWN |

**Merged view** — ability to see Harvest budget alongside Asana task completion for the same project (via `project_mappings` table linkage)

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| Budget spent/remaining for Harvest projects | `harvest_time_entries` aggregated | High |
| Asana projects on company page | `asana_projects` WHERE `company_id` | High |
| Project mapping (Harvest ↔ Asana) | `project_mappings` table | Medium |
| Team members per project | `harvest_time_entries` + `asana_projects.team_members` | Medium |

---

### 4. Time Tab

**Purpose:** All time tracked against this company.

#### Current State
- Summary: Total Hours, Billable Hours, Entry count
- Table: Date, Project, Task, Person, Hours, Notes
- Data from `harvest_time_entries` table

#### Desired State

**Metrics Row — Enhanced:**
| Metric | Source | Status |
|--------|--------|--------|
| Total Hours | computed | EXISTS |
| Billable Hours | computed | EXISTS |
| Entry Count | computed | EXISTS |
| **Billable %** | billable / total | MISSING |
| **Total Cost** | `SUM(hours * cost_rate)` | MISSING |
| **Total Revenue** | `SUM(hours * billable_rate)` where billable | MISSING |
| **Margin** | (revenue - cost) / revenue | MISSING |

**Table — Enhanced:**
| Field | Source | Status |
|-------|--------|--------|
| Date | `spent_date` | EXISTS |
| Project | `project_name` | EXISTS |
| Task | `task_name` | EXISTS |
| Person | `harvest_user_name` | EXISTS |
| Hours | `hours` | EXISTS |
| Notes | `notes` | EXISTS |
| **Billable badge** | `billable` | MISSING |
| **Billable rate** | `billable_rate` | MISSING |
| **Cost rate** | `cost_rate` | MISSING |
| **Billed status** | `is_billed` | MISSING |

**NEW: Grouping/Filtering:**
- Group by project, by person, by month
- Filter by date range, by project, by billable/non-billable
- Time trend chart (hours per week/month)

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| Financial metrics (cost, revenue, margin) | `billable_rate`, `cost_rate` on time entries | High |
| Billable indicator per row | `harvest_time_entries.billable` | Low |
| Rates per row | `billable_rate`, `cost_rate` | Low |
| Billed status | `is_billed` | Low |
| Grouping/filtering controls | UI only | Medium |
| Time trend chart | computed from `spent_date` + `hours` | Medium |

---

### 5. Tickets Tab

**Purpose:** Complete support history for this company.

#### Current State
- Summary: Total Tickets, Open/Pending, Resolved/Closed
- Per ticket: Subject, status badge, priority, requester, type, source, created date, description preview
- Data from `freshdesk_tickets` table

#### Desired State

**Metrics Row — Enhanced:**
| Metric | Source | Status |
|--------|--------|--------|
| Total Tickets | computed | EXISTS |
| Open/Pending | computed | EXISTS |
| Resolved/Closed | computed | EXISTS |
| **Avg Resolution Time** | `resolved_at - created_date` | MISSING |
| **Avg First Response** | `first_responded_at - created_date` | MISSING |
| **Satisfaction Score** | `satisfaction_rating` JSONB | MISSING |

**Ticket Cards — Enhanced:**
| Field | Source | Status |
|-------|--------|--------|
| Subject | `subject` | EXISTS |
| Status badge | `status_label` | EXISTS |
| Priority | `priority_label` | EXISTS |
| Requester | `requester_name` | EXISTS |
| Type | `ticket_type` | EXISTS |
| Source | `source_label` | EXISTS |
| Created date | `created_date` | EXISTS |
| Description | `description_text` | EXISTS |
| **Due by** | `due_by` | MISSING |
| **Agent assigned** | `agent_name` | MISSING |
| **Group** | `group_name` | MISSING |
| **Tags** | `tags` array | MISSING |
| **Updated date** | `updated_date` | MISSING |
| **Resolution time** | `resolved_at - created_date` | MISSING |

**NEW: Ticket Detail Drawer** — click to expand, showing full conversation thread from `freshdesk_ticket_conversations`:
| Field | Source | Status |
|-------|--------|--------|
| Conversation body | `freshdesk_ticket_conversations.body_text` | NOT SHOWN |
| Direction (incoming/outgoing) | `incoming` boolean | NOT SHOWN |
| Private note flag | `private_note` | NOT SHOWN |
| From email | `from_email` | NOT SHOWN |
| Created date | `created_date` | NOT SHOWN |

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| Resolution time metrics | `resolved_at`, `first_responded_at` | Medium |
| Satisfaction rating | `satisfaction_rating` JSONB | Low |
| Agent, group, tags, due_by on cards | columns exist in `freshdesk_tickets` | Low |
| Ticket conversation thread drawer | `freshdesk_ticket_conversations` (873 rows) | High |

---

### 6. Invoices Tab

**Purpose:** Complete financial history for this company.

#### Current State
- Summary: Total Revenue, Transactions, First/Last dates
- Transaction types breakdown, Services breakdown, Sample memos
- Data from `companies.quickbooks_invoice_summary` JSONB (pre-aggregated)

#### Desired State

**Current display is adequate for summary view.** Major gap is lack of line-level data.

**Desired additions:**
| Field | Source | Status |
|-------|--------|--------|
| Current summary cards | `quickbooks_invoice_summary` | EXISTS |
| Current breakdowns | `quickbooks_invoice_summary` | EXISTS |
| **Individual invoice rows** | `harvest_invoices` table (0 rows — needs sync) | MISSING (no data) |
| **Payment status per invoice** | `harvest_invoice_payments` table (0 rows) | MISSING (no data) |
| **Revenue trend chart** | computed from invoice dates | MISSING |
| **Outstanding balance** | computed from unpaid invoices | MISSING (no data) |

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| Invoice line-level data | `harvest_invoices` (needs Harvest invoice sync) | High |
| Payment tracking | `harvest_invoice_payments` (needs sync) | High |
| Revenue trend visualization | computed | Medium |

---

### 7. Voice Tab (Meetings, Emails, Messages)

**Purpose:** Every conversation with this company across every channel. The "communication memory."

#### Current State
- Three sub-tabs: Meetings, Emails, Messages
- Meetings: renders via `AvomaCard` from local `company_meetings` table (via `useCompanyMeetings`)
- Emails: renders via `GmailCard` — still live API query to Gmail
- Messages: renders via `SlackMessagesCard` — still live API query to Slack

#### Desired State

**Meetings sub-tab — Enhanced:**
| Field | Source | Status |
|-------|--------|--------|
| Meeting list from local DB | `company_meetings` | EXISTS |
| Title, date, duration, attendees | columns on `company_meetings` | EXISTS |
| Summary | `company_meetings.summary` | EXISTS |
| **Full transcript** | `company_meetings.transcript` | EXISTS but not displayed in UI |
| **Recording link** | `company_meetings.recording_url` | EXISTS but not displayed |
| **Auto-vectorized into KB** | `knowledge_documents` with source_type=comms_engagement | PARTIAL |
| **Meeting count metric** | computed | MISSING |

**Emails sub-tab — Transition to local:**
| Field | Source | Status |
|-------|--------|--------|
| Email threads from Gmail API | Live API via `GmailCard` | EXISTS (live, not local) |
| **Local email storage** | `company_emails` table (0 rows — needs sync) | MISSING |
| **Subject, sender, recipient, date** | `company_emails` columns | TABLE EXISTS, NO DATA |
| **Email body** | `company_emails.body` | TABLE EXISTS, NO DATA |
| **Attachments** | `company_emails.attachments` JSONB | TABLE EXISTS, NO DATA |
| **Auto-vectorized into KB** | `knowledge_documents` | MISSING |

**Messages sub-tab — Transition to local:**
| Field | Source | Status |
|-------|--------|--------|
| Slack search results | Live API via `SlackMessagesCard` | EXISTS (live, not local) |
| **Local message storage** | `company_messages` table (0 rows — needs sync) | MISSING |
| **Channel, author, text, timestamp** | `company_messages` columns | TABLE EXISTS, NO DATA |
| **Thread context** | `company_messages.thread_ts` | TABLE EXISTS, NO DATA |
| **Auto-vectorized into KB** | `knowledge_documents` | MISSING |

**NEW: Form Submissions sub-tab:**
| Field | Source | Status |
|-------|--------|--------|
| Form name, page URL, submitted_at | `form_submissions` columns | TABLE EXISTS (0 rows) |
| Contact name/email | `form_submissions.contact_name`, `contact_email` | TABLE EXISTS |
| Form values | `form_submissions.form_values` JSONB | TABLE EXISTS |

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| Gmail → local `company_emails` sync | `company_emails` table (schema ready, 0 rows) | Critical |
| Slack → local `company_messages` sync | `company_messages` table (schema ready, 0 rows) | Critical |
| Meeting transcript/recording display | `company_meetings.transcript`, `recording_url` | Medium |
| Form submissions sub-tab | `form_submissions` table (schema ready, 0 rows) | Medium |
| All comms auto-vectorized into KB | `knowledge_documents` pipeline | High |

---

### 8. Knowledge Tab

**Purpose:** The company's memory. Every document, every piece of context — parsed, chunked, vectorized, searchable.

#### Current State
- Managed by `CompanyKnowledgeTab` component
- Google Drive folder sync support
- Document library per company
- 2,290 knowledge_documents total (1,598 integration, 400 comms_engagement, 287 scrape, 5 screenshot)

#### Desired State

**Document Library — Enhanced:**
| Feature | Status |
|---------|--------|
| Document list with source_type badges | EXISTS |
| Google Drive folder connection | EXISTS |
| Manual document upload | EXISTS |
| **Document count by source type** | MISSING (no summary metrics) |
| **Total chunks / searchable content** | MISSING |
| **KB completeness indicator** | MISSING — how much of this company's data is vectorized? |
| **Auto-ingest from Voice tab** | PARTIAL — engagements vectorized, emails/Slack not |
| **Auto-ingest from enrichment** | PARTIAL — some integration docs created |
| **KB freshness indicator** | MISSING — when was last document ingested? |

**Three Knowledge Layers (from Agency Brain doc):**
| Layer | Description | Status |
|-------|------------|--------|
| **Documents** | Raw ingested content — vectorized and citable | EXISTS |
| **Memories** | Synthesized observations created through interaction | NOT BUILT |
| **Preferences** | Explicit choices and settings | NOT BUILT |

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| KB completeness metrics | computed from `knowledge_documents` + `knowledge_chunks` | Medium |
| KB freshness indicator | `MAX(knowledge_documents.created_at)` per company | Low |
| Auto-ingest emails into KB | `company_emails` → vectorization pipeline | High |
| Auto-ingest Slack messages into KB | `company_messages` → vectorization pipeline | High |
| Memories layer | new table/system needed | Future |
| Preferences layer | new table/system needed | Future |

---

### 9. Chat Tab

**Purpose:** AI conversation with full company context. The brain's conversational interface.

#### Current State
- Multi-model AI chat via `KnowledgeChatCard`
- Context injected: company name, domain, industry, employees, revenue, location, description, contacts list, deals list
- RAG search across attached site knowledge documents
- Global mode with attached session IDs

#### Desired State

**Context injection — Enhanced:**
| Context | Source | Status |
|---------|--------|--------|
| Company basics | `companies.*` | EXISTS |
| Contacts list | `contacts.*` | EXISTS |
| Deals list | `deals.*` | EXISTS |
| **Harvest projects** | `harvest_projects.*` | MISSING from context |
| **Time summary** | aggregated `harvest_time_entries` | MISSING from context |
| **Ticket summary** | aggregated `freshdesk_tickets` | MISSING from context |
| **Invoice summary** | `quickbooks_invoice_summary` | MISSING from context |
| **Asana project status** | `asana_projects.*` | MISSING from context |
| **Enrichment highlights** | key facts from `enrichment_data` | MISSING from context |
| **Recent engagements** | last N from `engagements` | MISSING from context |
| **Recent meetings** | last N from `company_meetings` | MISSING from context |
| **Form submissions** | `form_submissions` | MISSING from context |
| **GA4 metrics** | `enrichment_data.ga4` | MISSING from context |
| **GSC metrics** | `enrichment_data.search_console` | MISSING from context |

**Live Connections (future MCP):**
| Connection | Status |
|------------|--------|
| HubSpot real-time queries | Future (MCP) |
| Harvest real-time queries | Future (MCP) |
| GA4 real-time queries | Future (MCP) |
| Asana real-time queries | Future (MCP) |

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| Projects/time/tickets/invoices in chat context | local tables | High |
| Enrichment highlights in context | `enrichment_data` | Medium |
| Recent communications in context | `engagements`, `company_meetings` | High |
| GA4/GSC metrics in context | `enrichment_data` | Medium |
| Live MCP connections | future architecture | Future |

---

### 10. Patterns Tab

**Purpose:** What patterns from the pattern library apply to this company? What has been applied? What were the outcomes?

#### Current State
- AI suggestions section via `usePatternSuggestions(companyId)` from `pattern_suggestions` table
- Pattern cards showing: title, type, block_type, status, confidence score, lift %
- Applied patterns with date and outcome from `pattern_applications` table
- Generate suggestions button
- 15 patterns in library, 0 applications recorded

#### Desired State

**Current implementation is solid for Phase 1.** Key gaps:

| Feature | Status |
|---------|--------|
| Pattern matching by industry | EXISTS |
| Pattern suggestions with reasoning | EXISTS |
| Apply pattern + record outcome | EXISTS |
| **Cross-client pattern discovery** | MISSING — "companies like yours did X" |
| **Pattern confidence from outcomes** | MISSING — confidence should increase with each successful application |
| **Playbooks section** | NOT BUILT — GLIDE's institutional processes |
| **Skills section** | NOT BUILT — teachable capabilities |

**Three Pattern Layers (from Agency Brain doc):**
| Layer | Description | Status |
|-------|------------|--------|
| **Client Patterns** | Cross-client recognition | PARTIAL (15 patterns, no cross-client linking) |
| **Playbooks** | GLIDE institutional processes | NOT BUILT |
| **Skills** | Teachable capabilities | NOT BUILT |

#### Gap Summary
| Gap | Data Source | Priority |
|-----|------------|----------|
| Cross-client pattern linking | `pattern_applications` across companies | Medium |
| Confidence score updates from outcomes | `pattern_applications.after_metrics` | Medium |
| Playbooks layer | new table/system needed | Future |
| Skills layer | new table/system needed | Future |

---

### 11. Estimates Tab (Growth workspace only)

**Purpose:** Auto-generated redesign cost and effort estimates.

#### Current State
- `EstimateBuilderCard` component — requires a crawl session
- Uses company context + site crawl data

#### Desired State
- Current implementation is adequate for Phase 1
- Future: tie estimates to pattern library recommendations
- Future: compare estimates to actual project outcomes (Outcomes layer)

---

### 12. Roadmap Tab

**Purpose:** Strategic roadmap for this company.

#### Current State
- `RoadmapTab` component with chat-powered roadmap generation
- Tied to company context

#### Desired State
- Current implementation is adequate for Phase 1
- Future: auto-generate roadmap items from Insights layer
- Future: tie roadmap items to Asana projects for execution tracking

---

### 13. Proposal Tab (Growth workspace only)

**Purpose:** Generate proposals for prospects.

#### Current State
- `ProposalTab` component with AI generation
- Uses site crawl + company context

#### Desired State
- Current implementation is adequate for Phase 1
- Future: proposals informed by pattern library + similar client outcomes

---

### 14. Source Data Tab

**Purpose:** Raw data explorer for debugging and power users.

#### Current State
- Collapsible sections for each enrichment_data key (Apollo Team, Apollo Org, Ocean, Avoma)
- Per-contact Apollo enrichment data
- `company_source_data` table rows (HubSpot, Harvest, Freshdesk raw)
- Raw JSON viewer

#### Desired State
- Current implementation is adequate as a debugging tool
- **ADD:** Data freshness timestamps per source
- **ADD:** "Last synced" indicator per integration
- **ADD:** Quick "Re-sync" button per source

---

## Cross-Tab Gaps: Data Not on Any Tab

These are fields/data available in the DB but not surfaced anywhere on the company page:

| Data | Table/Column | Where It Should Go |
|------|-------------|-------------------|
| Company tags | `companies.tags` | Overview header + filter |
| Company created_at | `companies.created_at` | Overview header |
| Last synced timestamp | `companies.last_synced_at` | Overview header |
| HubSpot/Harvest/Freshdesk IDs | `companies.*_id` columns | Connection status badges |
| Asana project GIDs | `companies.asana_project_gids` | Projects tab |
| Contact lifecycle_stage | `contacts.lifecycle_stage` | Overview contacts section |
| Contact role_type | `contacts.role_type` | Overview contacts section |
| Deal created_at | `deals.created_at` | Deals tab |
| Engagement contact_id | `engagements.contact_id` | Link engagement to contact |
| Engagement deal_id | `engagements.deal_id` | Link engagement to deal |
| Engagement metadata | `engagements.metadata` JSONB | Expanded engagement view |
| Freshdesk resolved_at, closed_at | `freshdesk_tickets.*` | Tickets metrics |
| Freshdesk first_responded_at | `freshdesk_tickets.*` | Tickets metrics |
| Ticket conversations | `freshdesk_ticket_conversations` (873 rows) | Ticket detail drawer |
| Harvest time billable_rate/cost_rate | `harvest_time_entries.*` | Time tab financials |
| Harvest time is_billed | `harvest_time_entries.*` | Time tab |
| GA4 data | `enrichment_data.ga4` | Overview (EXISTS but 0 companies have it) |
| GSC data | `enrichment_data.search_console` | Overview (EXISTS but 0 companies have it) |

---

## Workspace-Specific Tab Availability

| Tab | Growth | Delivery | Admin | Notes |
|-----|--------|----------|-------|-------|
| Overview | Yes | Yes | Yes | Metrics adapt per workspace |
| Voice | Yes | Yes | No | |
| Deals | No | Yes | No | Growth sees deals on Pipeline page |
| Projects | No | Yes (conditional) | No | Requires `harvest_client_id` |
| Time | No | Yes (conditional) | Yes ("Hours") | Requires `harvest_client_id` |
| Tickets | No | Yes (conditional) | No | Requires `freshdesk_company_id` |
| Knowledge | Yes | Yes | No | |
| Chat | Yes | Yes | No | |
| Estimates | Yes | No | No | Growth-only tool |
| Roadmap | Yes | Yes | No | |
| Proposal | Yes | No | No | Growth-only tool |
| Patterns | Yes | No | No | **Should also be in Delivery** |
| Invoices | No | No | Yes | |
| Source Data | Yes | Yes | Yes | Debug/power user |

**Gap:** Patterns tab should be available in Delivery workspace too — it's where outcomes are tracked.

---

## Data Population Status

| Data Source | Table | Rows | Sync Method | Status |
|------------|-------|------|-------------|--------|
| Companies | `companies` | 2,694 | HubSpot sync | Active |
| Contacts | `contacts` | 2,366 | HubSpot sync | Active |
| Deals | `deals` | 1,128 | HubSpot sync | Active |
| Engagements | `engagements` | 2,000 | HubSpot sync | Active |
| Harvest Projects | `harvest_projects` | 478 | Harvest sync | Active |
| Harvest Time | `harvest_time_entries` | 10,000 | Harvest sync | Active |
| Freshdesk Tickets | `freshdesk_tickets` | 3,985 | Freshdesk sync | Active |
| Ticket Conversations | `freshdesk_ticket_conversations` | 873 | Freshdesk sync | Active |
| Asana Projects | `asana_projects` | 51 | Asana sync | Active |
| Knowledge Docs | `knowledge_documents` | 2,290 | Auto-vectorization | Active |
| Knowledge Chunks | `knowledge_chunks` | 5,216 | Auto-vectorization | Active |
| Patterns | `patterns` | 15 | Manual + AI | Active |
| Pattern Applications | `pattern_applications` | 0 | Manual | Empty |
| Company Emails | `company_emails` | 0 | **NOT SYNCING** | Schema ready |
| Company Meetings | `company_meetings` | 0 | **NOT SYNCING** | Schema ready |
| Company Messages | `company_messages` | 0 | **NOT SYNCING** | Schema ready |
| Form Submissions | `form_submissions` | 0 | **NOT SYNCING** | Schema ready |
| Harvest Invoices | `harvest_invoices` | 0 | **NOT SYNCING** | Schema ready |
| Harvest Invoice Payments | `harvest_invoice_payments` | 0 | **NOT SYNCING** | Schema ready |
| Enrichment: Apollo Org | `enrichment_data` | 24 companies | On-demand | Active |
| Enrichment: Ocean | `enrichment_data` | 28 companies | On-demand | Active |
| Enrichment: Avoma | `enrichment_data` | 28 companies | On-demand | Active |
| Enrichment: GA4 | `enrichment_data` | 0 companies | OAuth connected, no sync | Blocked |
| Enrichment: GSC | `enrichment_data` | 0 companies | OAuth connected, no sync | Blocked |

---

## Priority Gap Cards

### Critical (blocks Agency Brain Layer 1-2 completion)

1. **Gmail → company_emails sync** — Schema ready, needs edge function to sync Gmail threads to local DB per company
2. **Slack → company_messages sync** — Schema ready, needs edge function to sync Slack messages per company channel
3. **Comms auto-vectorization** — Emails and Slack messages need to flow into `knowledge_documents` for RAG

### High Priority

4. **Unified communication timeline** — Merge engagements + emails + meetings + messages + form submissions on Overview
5. **Asana projects on company page** — Data exists in `asana_projects` with `company_id`, just not rendered
6. **Ticket conversation drawer** — 873 conversations exist, just need a detail drawer UI
7. **Harvest invoice sync** — Tables ready, need sync edge function
8. **Chat context expansion** — Include projects, time, tickets, invoices, enrichment in AI context
9. **Financial metrics on Time tab** — billable_rate and cost_rate exist, just not computed/displayed

### Medium Priority

10. **Overview metrics expansion** — Add contacts count, hours, revenue, open tickets
11. **Connection status badges** — Show which systems are linked on header
12. **Deal stage and owner display** — Columns exist, not shown
13. **Project budget tracking** — Cross-reference Harvest time vs project budget
14. **Pipeline snapshot on Overview** — Mini funnel from deal stages
15. **GA4/GSC data pipeline** — OAuth connected but no companies have data yet
16. **Patterns tab in Delivery workspace** — Currently Growth-only

### Low Priority

17. **Tags display** — Show `companies.tags` on overview
18. **Quick actions expansion** — Add manual contact, deal creation
19. **Ticket extra fields** — Agent, group, tags, due_by
20. **Time entry extra fields** — Billable badge, rates per row
21. **Source data freshness** — Per-source "last synced" timestamps

---

## North Star Vision: The Complete Dossier

When everything is connected, opening a company page looks like this:

### The 30-Second Scan (Overview)
You see the company identity at top — logo, name, industry, size. Below the name, a row of connection badges glow green: **HS** **H** **A** **FD** **QB** **GA4** **GSC** — all seven systems connected and flowing. The enrichment score reads **8/8**.

The metrics row tells the story at a glance: **$245K pipeline** across 4 open deals, **$892K lifetime revenue**, **1,847 hours tracked**, **12 open tickets**, last activity **2 hours ago**.

Below, a **Communication Timeline** shows the last 20 interactions in chronological order — an email thread yesterday, a Slack message this morning, a meeting last week with full transcript, a HubSpot task completed, a form submission from the website. Every communication from every channel, unified.

The **Contacts** section shows 8 people with their photos, titles, seniority badges, and enrichment status. The **Pipeline Snapshot** shows a mini funnel — 1 deal in Discovery, 2 in Proposal, 1 in Negotiation.

Three enrichment cards show **Ocean.io** firmographics, **Apollo** org intelligence with tech stack, and **GA4** traffic trends with a 90-day chart.

### The Deep Dive (Tabs)
Click **Deals** — full pipeline with stages, owners, probabilities, associated contacts. Click any deal to see its engagement history.

Click **Projects** — Harvest billing projects side-by-side with Asana execution. Budget bars show burn rate. Task completion progress bars show delivery status. The team members working on each project are visible.

Click **Time** — not just a log, but a financial dashboard. Total cost, total revenue, margin. Grouped by project, by person, by month. A trend line shows hours ramping up or down.

Click **Tickets** — support history with resolution metrics. Click any ticket to read the full conversation thread. Average response time: 4.2 hours.

Click **Voice** — every meeting transcript, every email thread, every Slack conversation, every form submission. All searchable. All vectorized into the Knowledge Base.

Click **Knowledge** — 450 documents, 2,100 chunks. Completeness indicator: 94%. Freshness: last document ingested 6 hours ago. The complete memory of everything ever known about this company.

Click **Chat** — ask anything. "What was the conversion rate discussed in our last meeting?" The AI searches across transcripts, emails, analytics, and site data to answer with citations. It knows the company's Harvest projects, their ticket history, their GA4 trends, their deal pipeline. It has the full context of a team member who's been on this account for years.

Click **Patterns** — 3 patterns from the library match this company's industry and profile. One was already applied last quarter: "Mid-market SaaS product page restructure — +2.1x conversion lift, confidence: high (n=12)." The system is learning.

### The Compound Effect
Every new company inherits patterns from the ones before it. Every closed deal improves the win rate model. Every resolved ticket sharpens the support playbook. Every completed project refines the estimate engine.

This is Agency Brain: **the system that turns agency experience into compounding advantage.**

Client #50 gets the wisdom of the first 49 — automatically.
