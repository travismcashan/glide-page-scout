# Gap Analysis: Desired State → Current State → Bridge Plan

> Generated 2026-04-05 by api-auditor agent
> Synthesized from: API Inventory audit, UI Surfaces audit, Agency Brain Architecture vision doc

---

## 1. DESIRED STATE (per Agency Brain Architecture)

The vision document describes a **compounding intelligence engine** built on three systems (Brain, Voice, Team) with four connection types (Static, Synced, Live, Backfill). The desired state:

### 1.1 Complete Connections + Knowledge Base
- **ALL information in, synced, and continuous.** Not one-off imports — living connections.
- Every piece of data parsed, chunked, vectorized, tagged, and **tied to the right company**.
- Three KB layers: **Documents** (raw ingested, citable), **Memories** (synthesized observations), **Preferences** (explicit choices).
- Communication data (emails, calls, meetings, messages) flows into KB automatically.
- No ephemeral data. If the system fetched it, it's stored and searchable.

### 1.2 Live Connections (MCP)
- AI queries APIs **in real-time during conversation**. "What projects had 60%+ margin in the last 12 months?" hits Harvest live, processes the response, and presents it conversationally.
- Synced connections eventually become two-way: push updates back to HubSpot, Asana, etc.

### 1.3 Patterns (Pillar 3)
- Three layers: **Client Patterns** (cross-client recognition), **Playbooks** (institutional processes), **Skills** (teachable capabilities — "Matrix-style knowledge loading").
- Patterns require a rich, complete Knowledge Base to recognize what repeats.

### 1.4 Insights → Actions → Outcomes → Learning (Pillars 4–7)
- Interpretation layer that turns patterns into stories with context and consequence.
- Recommendation engine that drafts deliverables from what worked for similar companies.
- Outcome tracking tied back to specific actions.
- Learning loop: outcomes feed back into KB, patterns sharpen, confidence scores rise.

### 1.5 Agency Voice
- Auto-generated meeting recaps, status updates, client communications.
- Every communication flows back into KB.

### 1.6 Agency Team
- Humans and AI agents as peers with Identity, Personal KB, Permissions, Autonomy.
- Each agent has a name, role, personality, and growing Personal KB.

---

## 2. CURRENT STATE (synthesized from both audits)

### 2.1 Data That Flows In AND Surfaces Correctly ✅

| Category | What Works |
|---|---|
| **HubSpot Deals** | 1,128 deals synced to local `deals` table. Pipeline kanban, deal detail drawer, company deals section all work. |
| **HubSpot Contacts** | Lead contacts synced to local `contacts` table. Lead kanban with status columns works. |
| **Companies** | 2,102 companies with cross-system IDs (HubSpot 1,900 / Harvest 408 / Freshdesk 587). Company resolution layer auto-creates and self-heals. |
| **Apollo Contact Enrichment** | Batch enrichment stores full raw response in `contacts.enrichment_data.apollo`. Contact detail page shows employment history, org intel. |
| **Apollo Org + Ocean.io** | Forward-synced to `companies.enrichment_data`. ApolloOrgCard and OceanCard render rich company intelligence on Overview tab. |
| **Harvest Time Entries** | Synced to `harvest_time_entries` table. Company Time tab shows hours by project/task/person. |
| **Harvest Invoices** | Synced to `harvest_invoices` table. QB summary on companies for Admin view. |
| **Freshdesk Tickets** | Synced to `freshdesk_tickets` + `freshdesk_ticket_conversations`. Company Tickets tab shows full ticket list. |
| **Asana Projects** | Synced to `asana_projects` table. Projects page shows merged Asana+Harvest view. |
| **Crawl Pipeline** | 30+ integrations in registry. 3-phase pipeline with scoring, AI insights, executive summary. |
| **RAG System** | Hybrid BM25+vector search with reranker. Knowledge tab with document management. |
| **AI Chat** | Multi-session with company context injection. Works across all workspaces. |

### 2.2 Data Stored But Not Surfaced (Hidden) 🟡

| Data | Where Stored | What's Missing |
|---|---|---|
| `deals.properties` JSONB | `deals` table | Deal type, source, forecast probability, owner name — only shown in Pipeline drawer, not on company detail |
| Contact seniority, department | `contacts` table | Shown on contact detail but never on list views or company overview |
| Asana project metadata | `asana_projects` table | `team_members`, `portfolio_name`, `start_date`, `due_date`, `custom_fields` — not rendered on Projects page |
| Harvest entry details | `harvest_time_entries` | `billable_rate`, `cost_rate`, `billable` flag, `is_running` — not shown |
| Freshdesk ticket details | `freshdesk_tickets` | `due_by`, `tags`, agent assigned, resolution time — not shown |
| Company tags | `companies.tags` | Never shown anywhere in UI |
| GA4 + Search Console | `crawl_sessions.ga4_data`, `search_console_data` | Stored on crawl sessions but NOT forward-synced to `companies.enrichment_data` and NOT shown on company pages |
| `companies.enrichment_data.semrush` | `companies` table | Forward-synced but SEMrush is paused (no credits), so always empty |
| `companies.enrichment_data.hubspot` | `companies` table | Forward-synced but not surfaced on company pages (only apollo_org and ocean shown) |

### 2.3 Data Fetched But NOT Persisted (Ephemeral) 🔴

| Data | How It's Fetched | Impact |
|---|---|---|
| **Gmail emails** | `gmail-lookup` edge fn → Gmail API live | Re-fetched every time. No persistence. Cannot be RAG-searched. Lost when tab closes. |
| **Slack messages** | `slack-search` edge fn → Slack API live | Re-fetched every time. No persistence. Cannot be RAG-searched. |
| **Avoma meetings** | `avoma-lookup` edge fn → Avoma API live | Cached in `enrichment_data.avoma` but no dedicated `meetings` table. Transcripts truncated to 50 segments. No RAG vectorization. |
| **HubSpot form submissions** | `hubspot-lookup` edge fn | Fetched in crawl-time lookup, returned to client, never stored in any table. |
| **HubSpot engagements (on-demand)** | `company-artifacts` edge fn | Fetched live from HubSpot when visiting company overview. `engagements` table exists but is NOT batch-synced. |
| **Harvest projects (on-demand)** | `company-artifacts` edge fn | Fetched live for company Projects tab, despite `harvest_projects` table existing. |

### 2.4 Data We Could Get But Don't Fetch At All 🚫

| Data | API Available | Value |
|---|---|---|
| **Apollo org enrichment** (dedicated endpoint) | `/v1/organizations/enrich` | More org fields than nested person data (funding, departmental headcounts, org chart) |
| **Apollo job postings** | `/v1/organizations/job_postings` | Hiring signals — indicates growth, org priorities, potential needs |
| **Ocean.io similar companies** | `/v2/similar/companies` | Lookalike prospecting — "find companies like this one" |
| **Google Ads** | Google Ads API | Campaign performance, keywords, spend — not integrated at all |
| **HubSpot marketing emails / sequences** | HubSpot Marketing API | Email campaign performance tied to contacts |
| **HubSpot line items / products / quotes** | HubSpot CRM API | Deal-level product detail and pricing |
| **Harvest expenses** | `/v2/expenses` | Project expenses alongside time entries |
| **Harvest user/task assignments** | `/v2/user_assignments`, `/v2/task_assignments` | Who is assigned to which project/task |
| **Asana tasks** | Asana Tasks API | Individual work items, assignees, subtasks, stories |
| **Asana goals** | Asana Goals API | Could map to KPIs in Measurement Spine |
| **Freshdesk company details** | Freshdesk Companies API | Company health_score, domain, industry from Freshdesk perspective |
| **LinkedIn company/contact data** | No API (scraping restricted) | Only URL storage today |

### 2.5 Pages Still Hitting Live APIs (Not Local DB) ⚠️

| Page | API Hit | Should Read From |
|---|---|---|
| Leads page (`usePipelineLeads`) | `hubspot-pipeline` → HubSpot API | `contacts` table (already synced by hubspot-contacts-sync) |
| Deals page (`usePipelineDeals`) | `hubspot-pipeline` → HubSpot API | `deals` table (already synced by hubspot-deals-sync) |
| Company Engagements (Overview) | `company-artifacts` → HubSpot API | `engagements` table (needs batch sync) |
| Company Projects tab | `company-artifacts` → Harvest API | `harvest_projects` table (already synced by harvest-sync) |
| Voice > Meetings | `avoma-lookup` → Avoma API | Needs `meetings` table |
| Voice > Emails | `gmail-lookup` → Gmail API | Needs `emails` table |
| Voice > Messages | `slack-search` → Slack API | Needs `messages` table |

---

## 3. THE GAP (Categorized)

### Category A: Communication Persistence
**The biggest gap.** The Agency Brain vision says "every communication flows into the Knowledge Base." Currently, Gmail, Slack, and Avoma data is completely ephemeral — fetched, displayed, discarded. This blocks:
- RAG vectorization of communications (can't search across emails+meetings+messages)
- Pattern recognition on communication data
- Agency Voice (can't auto-summarize what it doesn't remember)
- The compounding loop (communications are the richest signal source)

**Missing tables**: `company_emails`, `company_meetings`, `company_messages`
**Missing pipeline**: Communication → KB → RAG vectorization

### Category B: Missing Entity Tables
Beyond communications, several entity types lack proper tables:
- `form_submissions` — HubSpot form data fetched but not persisted
- `engagements` batch sync — table exists but is empty (only on-demand via company-artifacts)
- Communication tables (see Category A)

### Category C: Unused API Capabilities
APIs we pay for (or have free access to) that we don't leverage:
- Apollo org enrichment endpoint (dedicated, richer than nested person data)
- Apollo job postings (hiring signals for prospect intelligence)
- Ocean.io similar companies (lookalike prospecting engine)
- Google Ads (no integration at all — major gap for Delivery analytics)
- Asana tasks (only project-level summaries, no task granularity)
- Harvest expenses and assignments

### Category D: Pages Still Hitting Live APIs
Five major page loads still call external APIs despite having local data:
- Leads page → should read from `contacts` table
- Deals page → should read from `deals` table
- Company Engagements → needs `hubspot-engagements-sync`
- Company Projects tab → should read from `harvest_projects`
- Company Voice tab (all 3 sub-tabs) → needs persistence layer

### Category E: No Historical Trending
Everything is point-in-time. No mechanism for:
- Crawl-over-crawl comparison (site health improving or declining?)
- Deal velocity trending (sales cycle getting faster or slower?)
- Engagement frequency scoring (is this client ghosting us?)
- Company enrichment changes (headcount growth, tech stack changes)
- Project budget utilization over time

### Category F: No Cross-Source Engagement Scoring
No unified "engagement score" that combines:
- HubSpot activity (emails, calls, meetings, form submissions)
- Avoma meeting frequency and quality
- Gmail thread activity
- Slack message volume
- Freshdesk ticket patterns
- Harvest hours logged

This score is essential for the Insights pillar — understanding which clients are engaged vs. at risk.

---

## 4. BRIDGE PLAN (Prioritized Plan Cards)

Ordered per the Agency Brain doc's own roadmap: Complete Connections + KB → Make it Conversational → Build Patterns → Build Insights.

### Tier 1: Complete Connections + Knowledge Base

> "Get ALL information in, synced, and continuous."

#### Plan Card 1.1: Communication Persistence — Email Storage
- **Priority**: p0
- **Category**: A (Communication Persistence)
- **Tags**: `gmail`, `knowledge-base`, `data-first`, `connections`
- **Summary**: Create `company_emails` table. Build `gmail-sync` edge function that batch-syncs emails per company (by domain/contact emails) into local DB. Auto-trigger RAG vectorization on new emails via `rag-ingest`. Replace live Gmail API calls in Voice tab with local DB reads.

#### Plan Card 1.2: Communication Persistence — Meeting Storage
- **Priority**: p0
- **Category**: A (Communication Persistence)
- **Tags**: `avoma`, `knowledge-base`, `data-first`, `connections`
- **Summary**: Create `company_meetings` table with full transcript storage (not truncated to 50 segments). Build `avoma-sync` edge function that batch-syncs meetings per company. Store transcripts, insights, attendees, action items. Auto-trigger RAG vectorization. Replace live Avoma API calls with local DB reads.

#### Plan Card 1.3: Communication Persistence — Message Storage
- **Priority**: p0
- **Category**: A (Communication Persistence)
- **Tags**: `slack`, `knowledge-base`, `data-first`, `connections`
- **Summary**: Create `company_messages` table. Build `slack-sync` edge function that syncs messages per company (by channel mapping or keyword search). Store message text, author, channel, thread context. Auto-trigger RAG vectorization. Replace live Slack API calls with local DB reads.

#### Plan Card 1.4: HubSpot Engagements Batch Sync
- **Priority**: p0
- **Category**: B (Missing Entity Tables) + D (Live API)
- **Tags**: `hubspot`, `data-first`, `engagements`
- **Summary**: Build `hubspot-engagements-sync` edge function that batch-syncs all engagement types (emails, calls, meetings, notes, tasks) for all deal/contact companies into the existing `engagements` table. Remove live HubSpot API dependency from company overview. Add to pg_cron schedule.

#### Plan Card 1.5: HubSpot Form Submissions Table
- **Priority**: p1
- **Category**: B (Missing Entity Tables)
- **Tags**: `hubspot`, `data-first`, `form-submissions`
- **Summary**: Create `form_submissions` table. Extract form submission data from `hubspot-lookup` and persist. Wire form submissions into company detail UI. These are high-value conversion signals — a prospect filling out a form is one of the strongest intent signals in the CIRT framework.

#### Plan Card 1.6: Pipeline Pages Read from Local DB
- **Priority**: p0
- **Category**: D (Live API)
- **Tags**: `hubspot`, `data-first`, `pipeline`
- **Summary**: Rewrite `usePipelineLeads()` to read from `contacts` table (already synced). Rewrite `usePipelineDeals()` to read from `deals` table (already synced). Delete `hubspot-pipeline` edge function. This is the last major data-first violation — the most-visited pages still hit HubSpot on every load.

#### Plan Card 1.7: Company Projects Tab Reads from Local DB
- **Priority**: p1
- **Category**: D (Live API)
- **Tags**: `harvest`, `data-first`, `projects`
- **Summary**: Replace `company-artifacts` Projects fetch with `harvest_projects` table query. Data already synced by `harvest-sync`. Just need to wire the UI to read local data instead of calling the edge function. Also render Asana project status alongside Harvest budget data.

#### Plan Card 1.8: Forward-Sync GA4 + Search Console to Companies
- **Priority**: p1
- **Category**: Hidden Data
- **Tags**: `ga4`, `search-console`, `enrichment`
- **Summary**: Add `ga4` and `search_console` keys to `syncEnrichmentToCompany()` in `phase-runner.ts`. Surface GA4 traffic data and Search Console search performance on company overview pages (new cards similar to ApolloOrgCard/OceanCard). This data is already fetched and stored on crawl_sessions but never reaches the company.

### Tier 2: Make It Conversational (MCP Live Connections)

> "The AI constructs and executes API calls in real-time during conversation."

#### Plan Card 2.1: MCP Server Framework
- **Priority**: p1
- **Category**: Live Connections
- **Tags**: `mcp`, `ai-chat`, `live-connections`
- **Summary**: Build MCP server infrastructure that allows AI chat to query external APIs in real-time. Start with Harvest (hours, budgets, margins) and HubSpot (deal details, contact activity). The vision doc specifically calls out: "What projects had 60%+ margin in the last 12 months?" as a Live connection query. This transforms chat from knowledge-search to real-time business intelligence.

#### Plan Card 2.2: Two-Way HubSpot Sync
- **Priority**: p2
- **Category**: Live Connections
- **Tags**: `hubspot`, `synced-connections`, `write-back`
- **Summary**: Enable write-back to HubSpot: update deal stages, add notes, log activities from within Ascend. The vision doc classifies HubSpot as a "Synced" (two-way read/write) connection. Start with deal stage updates and note creation, which are the highest-value write operations.

#### Plan Card 2.3: Auto-RAG Vectorization Pipeline
- **Priority**: p1
- **Category**: Knowledge Base
- **Tags**: `rag`, `knowledge-base`, `automation`
- **Summary**: Build automatic RAG vectorization triggers for all new data entering the system. When a sync function writes new emails, meetings, messages, or documents, automatically invoke `rag-ingest` with company context. This is the pipeline that turns raw data (Pillar 2: Documents layer) into searchable, citable knowledge.

### Tier 3: Build Patterns (Pillar 3)

> "What keeps showing up? Client Patterns, Playbooks, Skills."

#### Plan Card 3.1: Cross-Client Pattern Recognition
- **Priority**: p2
- **Category**: Patterns
- **Tags**: `patterns`, `agency-brain`, `ai`
- **Summary**: Build the pattern recognition engine that analyzes KB data across all companies to find what repeats. "Mid-market SaaS companies consistently underinvest in product pages." Requires rich KB from Tier 1. Start with crawl data patterns (site structure, tech stack, content gaps) since that data is most structured, then expand to communication patterns.

#### Plan Card 3.2: Engagement Scoring Engine
- **Priority**: p1
- **Category**: F (Cross-Source Engagement Scoring)
- **Tags**: `patterns`, `engagement`, `scoring`
- **Summary**: Build unified engagement score per company combining: HubSpot activity frequency, Avoma meeting recency, Gmail thread activity, Slack message volume, Freshdesk ticket patterns, Harvest hours logged. Surface as a company health indicator. This is the first concrete "Pattern" — recognizing engagement vs. disengagement across all sources.

#### Plan Card 3.3: Historical Trending Infrastructure
- **Priority**: p2
- **Category**: E (No Historical Trending)
- **Tags**: `trending`, `outcomes`, `data-architecture`
- **Summary**: Build snapshot infrastructure for tracking changes over time. Crawl-over-crawl comparison (site health trends), deal velocity trending (sales cycle speed), enrichment changes (headcount growth delta). Create `entity_snapshots` table or time-series approach. This is prerequisite for the Outcomes pillar — you can't measure "did it work" without a baseline.

#### Plan Card 3.4: Playbook System
- **Priority**: p2
- **Category**: Patterns
- **Tags**: `playbooks`, `patterns`, `agency-brain`
- **Summary**: Codify institutional processes as Playbooks: "GLIDE website build: 47 steps from deal close to launch." Extract from Asana project templates, Harvest project patterns, and team knowledge. Playbooks improve automatically through the Learning loop — every project that completes feeds back improvements.

### Tier 4: Build Insights (Pillar 4)

> "Patterns become meaningful when you add context, comparison, and consequence."

#### Plan Card 4.1: Insight Generation Engine
- **Priority**: p2
- **Category**: Insights
- **Tags**: `insights`, `agency-brain`, `ai`
- **Summary**: Build the interpretation layer that turns patterns into stories. A pattern says "Your product pages convert at 1.2%." An insight says "Companies with your profile average 3.1%. That gap is costing you approximately $400K per year." Requires Patterns (Tier 3) and rich KB (Tier 1). Start with crawl-based insights (comparing a prospect's site scores to client/industry benchmarks).

#### Plan Card 4.2: Apollo Org Enrichment + Job Postings
- **Priority**: p1
- **Category**: C (Unused API)
- **Tags**: `apollo`, `enrichment`, `hiring-signals`
- **Summary**: Integrate Apollo's dedicated org enrichment endpoint (`/v1/organizations/enrich`) for richer company data (funding, departmental headcounts). Add job postings endpoint for hiring signals. Job postings are a high-value Insight input — a company hiring 5 engineers signals different needs than one hiring 5 marketers.

#### Plan Card 4.3: Ocean.io Similar Companies
- **Priority**: p2
- **Category**: C (Unused API)
- **Tags**: `ocean`, `prospecting`, `patterns`
- **Summary**: Integrate Ocean.io's similar companies endpoint. "Find 50 companies that look like our best clients." This is a direct implementation of the Pattern recognition vision — using known client attributes to identify lookalike prospects. Powers the Growth pillar's prospecting workflow.

---

## Summary: Priority Matrix

| Priority | Count | Focus |
|---|---|---|
| **p0** | 4 cards | Communication persistence + pipeline reads from local DB. These are blocking everything else. |
| **p1** | 6 cards | Form submissions, GA4/GSC surfacing, MCP framework, auto-RAG, engagement scoring, Apollo enrichment. High value, unblocks Tier 3. |
| **p2** | 6 cards | Cross-client patterns, trending, playbooks, insights, HubSpot write-back, Ocean lookalikes. Vision-level capabilities. |

### Execution Order (recommended)

1. **Plan Cards 1.6 + 1.4** — Pipeline pages + engagements from local DB (quick wins, removes live API dependencies)
2. **Plan Cards 1.1 + 1.2 + 1.3** — Communication persistence (the biggest architectural gap)
3. **Plan Card 2.3** — Auto-RAG vectorization (makes persisted communications searchable)
4. **Plan Card 1.7 + 1.8** — Projects tab + GA4/GSC forward-sync (complete data-first migration)
5. **Plan Card 3.2** — Engagement scoring (first cross-source intelligence)
6. **Plan Card 2.1** — MCP server framework (unlocks real-time AI queries)
7. **Remaining Tier 2–4 cards** — Pattern recognition, insights, playbooks

This sequence follows the Agency Brain doc's own principle: **"Each layer depends on the one below it."** You can't build Patterns on ephemeral data. You can't build Insights without Patterns. You can't build a compounding loop without persistence.
