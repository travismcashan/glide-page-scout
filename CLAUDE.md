# GLIDE® / Ascend — Project Context

## Deployment

Hosted on Vercel with auto-deploy on push to `main`.

## Tech Stack

Vite + React + TypeScript, Tailwind + shadcn/ui, Supabase (auth/DB/edge functions), TanStack Query, deployed on Vercel. 78+ integrations for prospect research, website auditing, and client intelligence.

---

## Brand Architecture

**Ascend** is the AI-powered growth marketing platform. **GLIDE®** is the agency that built it and its first power user.

| Layer | Brand | Audience | Role |
|-------|-------|----------|------|
| **Product** | **Ascend** | Everyone (clients, prospects, eventually the market) | The AI-powered growth platform |
| **Service** | **GLIDE®** | Clients who want hands-on partnership | The agency, Ascend's first power user |
| **Internal pillars** | Growth / Delivery / Admin | Glide team only | How Glide organizes its work inside Ascend |

"Glide helps you Ascend." All client/prospect-facing UI branded as Ascend. Internal workflow organization (Growth, Delivery, Admin) stays behind the scenes.

### Growth Trajectory for Ascend

1. **Phase 1** — Internal tool. Glide's competitive advantage.
2. **Phase 2** — Client-facing portal. Clients associate the experience with Ascend.
3. **Phase 3** — Other agencies adopt it. Pattern library + self-optimizing engine = infrastructure.
4. **Phase 4** — Direct to business. Companies use Ascend independently or get matched with certified partners.

---

## Mission

GLIDE® is a **trusted growth partner** — helping good people and great ideas receive the exposure they deserve so that we can positively impact the lives of others through our work. The platform should feel warm and organic, not techy.

---

## Agency Brain — 7 Pillars

**Category: Client Intelligence** — the system that turns agency experience into compounding advantage. Not a CRM, not project management, not analytics. The brain that learns clients and gets smarter with every engagement.

```
Agency Brain
├── 1. Connections     (sources)
├── 2. Knowledge Base  (raw material)
├── 3. Patterns        (recognition)
├── 4. Insights        (meaning)
├── 5. Actions         (what to do)
├── 6. Outcomes        (what happened)
└── 7. Learning        (compounding intelligence)
         ↑                              │
         └──────────────────────────────┘
```

### 1. Connections
**"Where does our intelligence come from?"**
The nervous system. Every source of truth — tools, documents, conversations, data — wired in and flowing continuously. Not one-off imports. Living connections.

### 2. Knowledge Base
**"What do we know?"**
The memory. Every piece of information — parsed, chunked, vectorized, tagged, and tied to the right company. Raw and unprocessed. No opinions yet.

### 3. Patterns
**"What keeps showing up?"**
The recognition layer. Across one client or all clients — what repeats? Similar site structures, recurring objections, common gaps, audience segments that look alike. Facts without judgment.

### 4. Insights
**"What does it mean?"**
The interpretation. Patterns become meaningful with context, comparison, and consequence. This is where data becomes a story.

### 5. Actions
**"What should we do about it?"**
The recommendation engine. Not just advice — the wireframe, the copy framework, the implementation plan, built from what actually worked for similar companies.

### 6. Outcomes
**"Did it work?"**
The receipt. Track what was recommended, implemented, and what changed. Tied back to specific actions. Prove value with data, not decks.

### 7. Learning
**"What do we know now that we didn't before?"**
The compounding layer. Outcomes feed back into KB. Patterns sharpen. Confidence scores rise. Client #50 gets the wisdom of the first 49 — automatically.

### The Throughline

> **Where** does intelligence come from → **What** do we know → **What** repeats → **What** does it mean → **What** do we do → **Did** it work → **What** did we learn

### The Moat

An agency running this for 3 years is categorically better than one that just started. Not better people — a smarter system that learned from 200 clients while competitors start from scratch every time.

### Naming Decisions (Apr 3 2026)

- ~~Streams~~ → **Connections**
- ~~Data River~~ → **Knowledge Base**
- ~~Cognitive IQ~~ → **Patterns** + **Insights** (two distinct layers)
- ~~Sync Engine~~ → still exists in code, not a brand concept (plumbing inside Connections)

### Build Status

Connections and Knowledge Base are largely built. Patterns is next. Insights, Actions, Outcomes, Learning are the roadmap.

---

## Agency Brain × GLIDE Pillars

Agency Brain is not a fourth pillar. It's the intelligence layer underneath all three.

```
                    GLIDE®
        ┌───────────┼───────────┐
        │           │           │
    Growth      Delivery      Admin
   (pre-sale)   (active)     (ops)
        │           │           │
        └───────────┼───────────┘
                    │
              Agency Brain
    ┌───┬───┬───┬───┬───┬───┬───┐
    Con  KB  Pat Ins Act Out Lrn
```

| Pillar | Primary Brain Layers | How |
|--------|---------------------|-----|
| **Growth** | Connections, KB, Patterns, Insights, Actions | Prospect research, site audits, enrichment, proposals — powered by patterns from past clients. |
| **Delivery** | All 7 | The full loop. Connect client tools, build KB, recognize patterns, generate insights, recommend actions, track outcomes, learn. ARISE runs on top. |
| **Admin** | Connections, KB, Outcomes | Hours from Harvest, invoices from QuickBooks, agreements — operational data that feeds Outcomes. |

**Growth fills the brain. Delivery uses the brain. Admin measures the brain. Learning makes all three better.**

---

## GLIDE Internal Pillars

### GLIDE® Growth (pre-sale — prospect phase)
- Analysis (website auditing, tech stack, performance, SEO, security, accessibility)
- Enrichment (Apollo contacts, HubSpot CRM, Ocean.io firmographics)
- Knowledge (document library, research context)
- Chat (AI-powered contextual conversation)
- Estimates (redesign cost/effort estimation)
- Roadmaps
- Proposals

### GLIDE® Delivery (active engagement — partner phase)
- Analysis (ongoing monitoring)
- Knowledge (strategy docs, shared context)
- AI Chat (with full client context — analytics, calls, emails, Slack, tasks)
- Integrations: Slack, Asana, Harvest, Google Analytics, Google Search Console, Google Ads
- Strategy / Pattern Library: Goals, Objectives, KPIs, ICP/Personas, User Flows, Site Architecture, Verticals

### GLIDE® Admin (business operations)
- Agreements
- Invoicing

---

## Navigation Architecture — Sidebar + Workspaces (SHIPPED Apr 4 2026)

Collapsible sidebar with workspace switcher. All three workspaces active. CrawlPage (/) is full-width with no sidebar.

**Key files:**
- `src/config/workspace-nav.ts` — single source of truth for per-workspace nav items + company tabs
- `src/components/AppSidebar.tsx` — sidebar component (workspace switcher, nav, user footer)
- `src/components/AppLayout.tsx` — layout wrapper (SidebarProvider + AppSidebar + SidebarInset + Outlet)
- `src/components/ui/sidebar.tsx` — shadcn primitives (collapsible="icon", Cmd+B, cookie persistence)

**Features:** Collapsible to icon rail, Cmd+B toggle, explicit toggle button, mobile Sheet drawer, shared views bypass sidebar.

### What Each Workspace Shows

| | **Growth** | **Delivery** | **Admin** |
|---|---|---|---|
| **Who uses it** | Sales, Travis | Strategists, designers, devs | Ops, Travis |
| **Companies filtered to** | Prospects | Active clients | All (financial view) |
| **Nav items** | Companies, Pipeline, Knowledge, Proposals | Clients, Projects, Knowledge, Analytics | Clients, Hours, Invoicing, Agreements |
| **Company detail tabs** | Overview, Contacts, Sites, Knowledge, Chat, Roadmap, Proposal | Overview, Contacts, Deals, Sites, Knowledge, Chat, Roadmap, Analytics | Overview, Hours, Budget, Agreements |
| **Brain layers emphasized** | Connections → Insights → Actions | All 7 | Connections, KB, Outcomes |

### Key Principles

- **Role-based scoping** — A PM never sees Pipeline. A salesperson never sees Hours. Not "access denied" — just irrelevant tools hidden.
- **Same data, different view** — Acme Corp exists in all three workspaces with different context surfaced.
- **Knowledge is shared but filtered** — Growth KB = enrichment, audits, research. Delivery KB = strategy docs, transcripts, patterns. Admin KB = agreements, SOWs, budgets.
- **Company detail tabs adapt** — Prospect gets Proposal tab. Active client gets Analytics. Past client gets Outcomes.
- **Maps to Three Lenses** — Growth = Front Stage heavy. Delivery = all three. Admin = House lens.
- **Scales to teams** — Assign people to workspaces. Travis sees all three. Junior PM = Delivery only. Account exec = Growth only.

---

## Three Lenses Model

### Front Stage (End User Lens)
Audience → Persona → JTBD → Journey → Flow → Steps → Moments → Content & Help → Signals → User Success Criteria

### Back Stage (Client / Business Lens)
Goal → Objective → KPI → Metrics → Influencing Variables (IVs)
Plus: IA → Templates → Patterns → Blocks → Channels & Campaigns → Governance → Evidence & Decisions

### The House (GLIDE / Solution Architecture Lens)
Activities → Workflows → Phases/Cycles → Offerings → Stages (Define/Deliver/Grow) → Roadmap

### Crosswalk Rules
- JTBD ↔ Goal (every user job must ladder to a client goal)
- Moment ↔ Pattern (every key moment delivered by a module)
- Signal ↔ Event (plain signal maps 1:1 to GA4 event + params)
- Success Criteria ↔ KPI proxy/Metric
- Step ↔ Template/Page
- Persona/Audience ↔ Segment rules

**No orphan rule:** No Goal without JTBD. No Moment without Pattern. No Signal without tracked Event. No Event not owned by a Pattern/Template.

---

## Service Hierarchy (The GLIDE Ladder)

**Execution Core:** Activities → Workflows → Phases / Cycles

**Planning Shell:** Offerings → Stages (Define / Deliver / Grow) → Roadmap

- **Activity** = single Meeting or Task (a verb)
- **Workflow** = curated sequence of Activities producing one named Deliverable
- **Phase** = one-time sequence exiting on criteria (projects)
- **Cycle** = repeating sequence on cadence (recurring services)
- **Offering** = productized kit (Phase-based or Cycle-based)
- **Stage** = lifecycle bucket: Define → Deliver → Grow
- **Roadmap** = time-sequenced Stages filled with Offerings, tied to Goals/KPIs

### Stage Definitions
- **Define** (upfront, strategy only): Audits + Strategy → Roadmap v1
- **Deliver** (one-time build): Strategy→Design→Dev→Content→QA→Optimization→Launch
- **Grow** (ongoing, compounding): CI/CRO, SEO, PPC, Maintenance. Cadence: PLAN→EXECUTE→MEASURE→LEARN

### Services Catalog
- 100s: Diagnostics/Audits
- 200s/300s: Projects (fixed-cost, time-bound)
- 400s: Recurring Services (SEO, PPC, CI/CRO, Analytics)
- 500s: Support (T&M)

---

## Measurement Spine

### Data Chain
Goal → Objective → KPI → Metrics → Influencing Variables (IVs)

- **KPI** = few outcome numbers (max 4 company-wide). Quarterly/annually. CxO sets.
- **Metric** = explains WHY KPIs move. 4-6 per KPI. Weekly/monthly. Directors set.
- **IV** = tunable input to move a Metric. 10-30 per metric. Daily/weekly. Agency sets.

### Move / Surface / Signal (execution model)
- **Move** = atomic unit of shipped change. Declares target KPI, IVs, Surfaces, Signals, hypothesis.
- **Surface** = WHERE the change lives (Flow → Template → Pattern → Block)
- **Signal** = HOW we observe it (event/param to compute Metrics)

Rule: No IVs → no deploy. No Signals → no credit.

---

## CIRT Framework

**Alignment Paradigm:** Customer-centric philosophy replacing persuasion. Build durable trust, not transactions.

### CIRT = Context → Intent → Relevance → Trust
Sequential causal chain. Failure at any stage invalidates subsequent stages.

- **Context** = competitive pressures, market dynamics, internal politics. First principle.
- **Intent** = the "Intent Constellation" — varied, conflicting needs across buying committee. 4 types: Informational, Commercial, Transactional, Navigational.
- **Relevance** = bridge between need and solution. 4 dimensions: Role-Based, Procurement-Stage, Organizational, Topical.
- **Trust** = both prerequisite and outcome (recursive). T0 (threshold) → T1 (earned) → Trust Spiral.

### 5 Pillars of Strategic Context
1. **Climate** — PESTEL, Porter's Five Forces
2. **Competition** — Direct, Indirect, Substitute, Status Quo, Asymmetric, Aspirational
3. **Customers** — ICP → Personas → Empathy Map → Buyer Journey → Intent Signals
4. **Company** — Gap Analysis: Desired State → Current State → The Gap
5. **Culture** — Risk Appetite + Decision-Making patterns → source of stakeholders' hidden fears

---

## ARISE Framework

- **A — Alignment** — what CIRT/sales achieves; continues into research
- **R — Research** — deep engagement with client
- **I — Innovation** — *the missing step* — "how can this be done better, smarter, faster?"
- **S — Strategy** — informed by alignment, research, AND innovation
- **E — Execution** — delivery of the work

---

## Storytelling Framework (StoryBrand)

1. **Audience-Focused Opening** — empathetic hook, visitor as hero
2. **The Conflict** — surface the problem (external, internal, philosophical)
3. **Guide Introduction** — client as solution provider (empathy + authority), NOT the hero
4. **The Plan** — simple 3-step process
5. **Proof & Outcomes** — KPI highlights, testimonials, case snippets
6. **Purpose & Values** — reinforce the "why"
7. **Call to Action** — direct CTA + transitional CTA

Homepage wireframe: Hero → Problem → Guide → Plan → Success/Proof → Failure/Stakes → CTA band → Purpose/Mission → Footer

---

## BHAG & Meaningful Actions

**BHAG:** "100,000,000 Meaningful Actions by 2030." Long-horizon: 1B lives positively impacted.

**Codified Purpose:** "Pair beauty with results to help people who help others."

**Meaningful Actions:** Macro conversions only (GA4 Key Events). Quality filter: source/intent attributable, tracking passes QA.

**NMA** = Σ wᵢ × (Postᵢ − Preᵢ) — net improvement per client.

### Tiered Growth Promises
- Moonshot (baseline low): up to 10×/36mo
- Climb (mid): 3-5×/36mo
- Defend (high baseline): +30-50% YoY

### Beauty × Results Index (BRI)
BRI = Normalized CVR uplift × Craft Score (A11y + Performance + UX Hygiene).

---

## Pattern Library (Key Differentiator)

Industry-based patterns that make AI optimization structured:
- Vertical-specific goals, personas, page types
- Block-level conversion patterns with performance data
- Persona-mapped user flows
- Compounds as more clients in same verticals are served
- JTBD cuts across industries — universal patterns AND industry-specific patterns

Vision: Instead of 30-50 hours in strategy, spend 5 elite hours because 25-30 hours of knowledge already exist from 100+ prior clients.

---

## Core Product Vision

**The self-optimizing website.** AI compounds context over time — every email, call, analytics trend, Slack thread, and strategy doc makes it smarter. The longer the relationship, the more valuable the platform becomes.

**Integration strategy:** Read-only by default, limited write where useful. Goal is AI context, not UI replication.

---

## Technical Architecture (Current State — Apr 4 2026)

### Company-Centric Data Model (Phase 1 SHIPPED)
- Company is the north star entity. Site is an artifact of a company.
- **Tables live:** companies (2102), contacts (67), deals, engagements, company_source_data. All with user-scoped RLS.
- **External ID mapping:** companies have `hubspot_company_id` (1900), `harvest_client_id` (408), `freshdesk_company_id` (587) for cross-system linking.
- **Company detail page:** Workspace-driven tabs from `WORKSPACE_COMPANY_TABS` config. Growth: Overview, Contacts, Sites, Knowledge, Chat, Roadmap. Delivery: Overview, Contacts, Deals, Projects, Time, Tickets, Sites, Knowledge, Chat, Roadmap. Admin: Overview, Hours, Invoices, Contacts, Source Data. Conditional tabs (Projects/Time/Tickets) still require matching external IDs.
- **Company Chat:** Multi-session hybrid RAG across all company sites.

### On-Demand Artifact Fetching (deployed Apr 4 2026)
- **`company-artifacts` edge function** — fetches external data live per-company when visiting tabs. No global batch sync needed.
- **Supported artifacts:** tickets (Freshdesk search API), deals + engagements (HubSpot associations API), projects + time_entries + invoices (Harvest client_id filtering).
- **Architecture:** Tab activation → `fetchArtifact()` → edge function → external API → state update. Cached via `artifactsFetched` ref Set (no re-fetch on tab revisit).
- **Freshdesk:** Uses direct `/tickets?company_id=X` endpoint (search API no longer supports company_id filter).

### Global Sync Engine (Connections)
- **`global-sync`** — cross-references Harvest, HubSpot, Freshdesk, Asana to build unified company list. Domain-first matching, then name normalization.
- **Batch sync functions** (freshdesk-sync, hubspot-sync, harvest-sync) — pull all artifacts for all mapped companies. Reference/fallback, not primary path.
- **Per-source sync** — ConnectionsPage has individual sync buttons per integration.
- **Raw source data** stored in `company_source_data` table for enrichment.

### Active Clients Management
- **Active tab** on CompaniesPage shows `status='active'` companies, sorted by last invoice date.
- **Status lifecycle:** prospect → active (when invoiced) → past (when stale, 12+ months no invoice) → archived.
- Stale detection is manual currently; wishlist item exists for auto-downgrade.

### RAG System (deployed Apr 2 2026)
- Hybrid search: BM25 + vector (70/30 weight) with Reciprocal Rank Fusion
- Reranker: Gemini Flash cross-encoder on ~40 candidates → top 20
- Markdown-aware chunking respecting code blocks, tables, headers, lists
- Inline citations: `[doc:N]` with click-to-preview

### Knowledge Ingestion
- Avoma transcripts, HubSpot engagements, Gmail emails, Apollo/Ocean data
- Google Drive folder sync (per-company)
- Slack search + batch ingest (OAuth connected)

---

## Known Issues

### Council Chat Bug
Model council returns "No synthesis available" — API calls failing silently (~135ms response = too fast). Debug: check API keys in Supabase secrets, verify model IDs, add error logging to catch blocks.

### Lost Crawl Data (discovered Apr 4 2026)
All ~80 historical site crawl sessions were lost — `crawl_sessions` and `crawl_pages` tables are empty (only 3 sentinel rows for chat). Cause unknown — possible DB reset or migration. Need to batch re-crawl company domains to rebuild.

### AI Company Matching (Planned)
`company-match-ai` edge function is deployed but not wired into Phase0Map UI. Plan exists in `kind-baking-mountain.md`.

## Integration Status (verified Apr 4 2026)

| Integration | Health | On-Demand Artifacts | Notes |
|---|---|---|---|
| **HubSpot** | OK | Deals, Engagements (emails/calls/meetings/notes/tasks) | deals/engagements tables empty by design — on-demand only, not persisted |
| **Harvest** | OK (OAuth) | Projects, Time Entries | Invoices not used in Harvest — use QuickBooks. OAuth token expires in 14 days, refresh token stored. |
| **Freshdesk** | OK | Tickets (direct list API) | Switched from search API to `/tickets?company_id=X` — search API no longer supports company_id filter |
| **QuickBooks** | CSV Import | Invoice summaries on companies table | `quickbooks_invoice_summary` JSONB on companies (487 companies). Invoices tab reads from this, not Harvest. |

**Linked companies:** HubSpot: 1,900 | Harvest: 408 | Freshdesk: 587 | QuickBooks: 487

---

## Company-Centric Architecture + Agency Voice (shipped Apr 4 2026)

Moved from site-centric to company-centric architecture. All enrichment and communication now lives on CompanyDetailPage instead of ResultsPage.

**Agency Voice tab** added to Growth and Delivery workspaces with three sub-tabs:
- **Meetings** (Avoma) — company-level meeting search, cached in `companies.enrichment_data.avoma`
- **Emails** (Gmail) — GmailCard supports dual storage (site-level via sessionId OR company-level via companyId)
- **Messages** (Slack) — standalone SlackMessagesCard extracted from CompanyKnowledgeTab

**Contacts tab enhanced:**
- "Find Team via Apollo" button — searches by company domain, syncs results into contacts table
- Per-contact "Enrich" button — individual Apollo enrichment

**Overview tab enhanced:**
- Ocean.io company intelligence card — auto-displays if cached, "Enrich" button if not

**ResultsPage stripped** — removed Apollo, Ocean, Avoma, Gmail (293 lines). Now audit-only (PageSpeed, SEO, accessibility, security, tech stack).

**Lazy migration** — `migrateEnrichmentFromSessions()` copies legacy site-level enrichment data to `companies.enrichment_data` on first company page visit.

**Key files:**
- `src/components/company/CompanyVoiceTab.tsx` — unified Voice shell
- `src/hooks/useCompanyAvoma.ts` — company-level Avoma fetch hook
- `src/components/company/SlackMessagesCard.tsx` — standalone Slack search
- `src/config/workspace-nav.ts` — Voice tab added to Growth + Delivery

### TanStack Query Caching (shipped Apr 4 2026)

All major data fetches now cached via TanStack Query. First load hits Supabase/APIs, subsequent visits within stale window are instant from memory.

**Cached hooks:**
- `useCompanies()` / `useCompany(id)` — companies list + detail (5 min stale)
- `useSessions()` — crawl history (5 min stale)
- `useSiteGroups()` — site groups (5 min stale)
- `useWishlistItems()` — wishlist (5 min stale)
- `usePipelineDeals(pipelineId)` / `usePipelineLeads()` / `usePipelineStats()` — HubSpot pipeline (5 min stale)
- `useServiceOfferings()` — service catalog (30 min stale)
- `useModelPricing()` — model pricing (1 hr stale)
- `useChatThreads(sessionId)` — chat threads (5 min stale)

**Pattern:** `useInvalidateX()` hooks for mutations. All in `src/hooks/useCachedQueries.ts` + `src/hooks/useCompanies.ts` + `src/hooks/useCompany.ts`.

### Sidebar Redesign — Global → Contextual → Utility (shipped Apr 4 2026)

Sidebar restructured per design expert analysis (Nielsen, Krug, Ive, Frog).

**Global section (top):** Max 3-4 items per workspace.
- Growth: Leads, Deals, Companies, Crawl
- Delivery: Clients, Projects
- Admin: Clients, Invoicing

**Contextual section (middle):** Appears when inside `/companies/:id`. Shows company tabs (Overview, Voice, Knowledge, Chat, Roadmap) as sidebar nav items synced with page via `?tab=` URL param.

**Utility section (bottom):** Single "Settings" item (absorbs Connections, Wishlist, Services, Usage). Admin link if admin user.

**Page tabs killed** — CompanyDetailPage and PipelinePage no longer have page-level tab bars. Sidebar owns all navigation. Page titles are dynamic (Leads/Deals based on active tab).

**CrawlPage merged into HistoryPage** — `/` now shows crawl input bar + full crawl history. No standalone CrawlPage. One page, one workflow.

**All page headers compressed** — removed subtitle descriptions, tightened filter rows into title rows.

**Key files:**
- `src/components/AppSidebar.tsx` — Global + Contextual + Utility structure
- `src/components/AppLayout.tsx` — `overflow-hidden` on SidebarInset fixes pipeline width blowout
- `src/config/workspace-nav.ts` — `TAB_ICONS` export, `CompanyTab.icon` field

---

## What Was Built (Apr 4 2026 — "Asana Port + Workspace Redesign" session)

### Asana↔Harvest Integration (SHIPPED)
- `project_mappings` + `asana_config` tables live. 47/51 Asana projects AI-matched to Harvest.
- 3 new edge functions: `asana-clients`, `harvest-project-hours`, `project-mapping` (Claude Haiku AI matching).
- `/projects` page — company-centric merged view (Asana status + Harvest budget).
- `/projects/mapping` page — visible mapping table with edit/lock/unlink/Run AI Match.

### CompaniesPage Workspace Redesign (SHIPPED)
- One-row header: Title + Count + Search + Stats + Sort + View toggle. Killed: smart view tabs, status/sources/data filters, group dropdown, summary row, Mapping/Cleanup buttons.
- **Growth**: Shows HubSpot-connected prospects. Columns: Name, Domain, Last Activity, Industry, Contact.
- **Delivery**: Title says "Clients". Shows active only. Columns: Name, Services, Last Activity, Contacts.
- **Admin**: Shows all non-archived. Columns: Name, Last Invoice, Revenue, Status.
- Archived companies filtered out globally.

### Other UI Changes (SHIPPED)
- `/leads` and `/deals` clean routes (replace `/pipeline?tab=`). Filters merged onto title row.
- Sidebar: removed workspace label, shows company name in contextual section.
- User dropdown: Connections, Wishlist, Services, Usage, Project Mapping, Company Mapping, Cleanup.
- Scroll fade edges on leads/deals (500ms, scroll-position-aware).
- Roadmap/Proposal/Estimate: `company_id` is primary parent, `deal_id` added, `session_id` optional.

## Data-First Architecture (SHIPPED Apr 4 2026)

### Principle
Every page reads from local Supabase tables. External APIs feed sync functions. No exceptions (except AI Chat Live connections).

### Sync Pipeline (all deployed + running)
- `hubspot-deals-sync` — 1,128 deals from 3 pipelines → `deals` table. Auto-creates missing companies + syncs deal contacts to `contacts` table.
- `hubspot-contacts-sync` — lead contacts → `contacts` table with lead_status/lifecycle_stage. Auto-creates missing companies.
- `enrich-contacts` — batch Apollo enrichment, stores full raw response in contacts.enrichment_data.apollo
- `enrich-companies` — batch Ocean.io enrichment, stores full raw response in companies.enrichment_data.ocean
- Auto-enrichment wired into both sync functions.

### Pages Reading from DB (DONE)
- Growth Companies → `deals` + `contacts` tables for pipeline company IDs, scoped query
- Deals page → `deals` table (was: HubSpot API live every page load)
- Leads page → `contacts` table (was: HubSpot API live every page load)
- Company detail Deals/Time/Tickets tabs → local tables (was: company-artifacts edge fn)
- Delivery/Admin Companies → scoped queries by status

### Pages Still Hitting External APIs (TO FIX)
- Projects page → Asana + Harvest APIs live (Phase 4 of plan)
- Company detail Projects tab → company-artifacts edge fn
- Company detail Engagements (overview) → company-artifacts edge fn

### 13 Architecture Rules
Saved in memory. Key ones:
1. Every entity = own row in correct table. Never store as string on another row.
2. Store ENTIRE raw API response. Never cherry-pick fields.
3. When creating companies, also create child entities (contacts, deals).
4. Pages NEVER call external APIs (except AI Chat Live connections / future MCP).
5. Every query scoped to what's displayed. Never load all rows and filter in browser.

### Connection Types (from Agency Brain vision)
- **Static** — one-way read, cached (PageSpeed, Lighthouse)
- **Synced** — scheduled sync to local tables (HubSpot, Harvest, Asana, Freshdesk)
- **Live** — real-time AI queries during Chat (edge functions now, MCP eventually)
- **Backfill** — bulk import (CSV, PDF, URL)

### Schema Cleanup (shipped Apr 5 2026)
13 denormalized string columns dropped. All entity names now come from JOINs, not copied strings.
- **deals**: dropped `contact_name`, `contact_email`, `contact_photo_url`, `company_name` → use `contact_id`/`company_id` JOINs
- **companies**: dropped `hubspot_lifecycle_stage`, `hubspot_has_active_deal` → superseded by contacts/deals tables
- **proposals**: dropped `company_name`, `contact_name`, `contact_email`, `contact_title` → use `company_id` JOIN
- **roadmaps**: dropped `client_name` → use `company_id` JOIN
- **project_estimates**: dropped `client_name` → use `company_id` JOIN
- **deals.contact_id** backfilled (892/1128 matched by email)
- **proposals.contact_id** and **project_mappings.company_id** FKs added
- **hubspot-lifecycle-sync** edge function deleted (dead code)

### Company Resolution Layer (shipped Apr 5 2026)
Shared `_shared/company-resolution.ts` used by all sync functions.
- `resolveCompany()`: external ID → domain match → create with best name
- Name fallback: HubSpot → existing → Ocean.io → Harvest → Freshdesk → domain-derived
- Self-healing: every sync run checks/upgrades placeholder names
- 16 "HubSpot Company {id}" names repaired

### Contact & Site Detail Drawers (shipped Apr 5 2026)
- **ContactDetailDrawer**: click contact → right Sheet with Apollo data, employment, org intel, company deals
- **SiteDetailDrawer**: click site → right Sheet with audit scores, tech stack, "View Full Audit" link
- **ContactDetailPage** at `/contacts/:contactId`
- **ContactsPage** at `/contacts` with table/card views, search, Pipeline/Active/Inactive/All filter

### Crawl Auto-Link + ResultsPage Audit-Only (shipped Apr 5 2026)
- Crawl sessions auto-linked to companies via domain on creation (find or create company)
- **ensureCrawl** utility: shared find-or-create crawl for domain links across all pages
- **DomainLink** component: Globe (crawled, purple) / Search (uncrawled, grey), click → ensure crawl → navigate
- **ResultsPage** stripped to audit-only (removed Prospecting, Knowledge, Chat, Estimates, Roadmap, Proposal tabs)
- **Estimates + Proposal tabs** added to CompanyDetailPage
- Auto-crawl on `hubspot-deals-sync` and `hubspot-contacts-sync` for new pipeline/lead companies

### Navigation Architecture (shipped Apr 5 2026)
- **Growth sidebar**: Leads → Deals → Crawls → Contacts → Companies
- **Default route**: `/leads` (was `/`)
- **Crawls** at `/crawls` (was `/`)
- **All list pages**: consistent header (Title + capsule count + search + filter/sort dropdowns)
- **Pipeline footer**: fixed to viewport bottom with stage totals
- **Sidebar/content alignment**: separator `mb-1` for pixel-perfect baseline alignment

### Async Crawl Reliability (shipped Apr 5 2026)
Hardened the 3-phase crawl pipeline for reliability, cancellation, and progress reporting.

**Session lifecycle:**
- Sessions start as `pending`, `crawl-start` sets `analyzing` after `integration_runs` created
- Client awaits `crawl-start` (no longer fire-and-forget) — shows error toast on failure, marks session `failed`
- `cancelled` status: Stop button writes to DB, all phase functions check before running/dispatching
- Phase dispatch retry: `dispatchNextPhase()` retries once after 2s on failure
- Phase 3 force-complete scoped to only `apollo-team` and `page-tags` keys (was blanket all running)

**Watchdog:**
- `crawl-recover` edge function (new): marks zombie `integration_runs` as failed, completes stuck sessions
- Client-side timer: auto-calls `crawl-recover` if session `pending` >2min or `analyzing` >10min
- Can also be called by pg_cron for server-side watchdog (not yet wired)

**Progress:**
- `useCrawlProgress(sessionId)` hook: computes `{ total, done, failed, percent, currentPhase, phaseLabel }` from realtime `integration_runs`
- ResultsPage: "Initializing..." banner for `pending`, error banner for `failed`, realtime session status subscription
- `use-active-crawl` includes `pending` in active check

**Crawls list:**
- Company column in HistoryPage (FK join + domain fallback for unlinked sessions)
- Domain fallback lookup for sessions without `company_id`

**Key files:**
- `supabase/functions/_shared/phase-runner.ts` — `isSessionCancelled()`, retry dispatch
- `supabase/functions/crawl-recover/index.ts` — zombie watchdog (new)
- `src/hooks/useCrawlProgress.ts` — progress computation hook (new)
- `src/pages/ResultsPage.tsx` — pending/failed/cancelled UI, client watchdog timer, server-side cancel

## Next Session Priority

**#1: Projects page reads from DB.** Phase 4 of data-first plan — sync Asana project data locally, rewrite ProjectsPage to query local tables.

**#2: Collapsible company rows.** Travis wants expandable rows showing contextual sub-content (Growth: lead/deal details, Delivery: projects/services). Was built then removed — needs design rethink.

**#3: Page-by-page UI audit.** Continue with company detail page, projects page — unified controls, tighter layouts.

**#4: Pipeline page horizontal scroll sync.** The fixed footer bar doesn't scroll left/right with the kanban columns — needs scroll position sync with the ScrollArea viewport.

**#5: Consolidate integration registry.** Integration list duplicated in 6 files (crawl-start, phase1-3, crawl-worker, ResultsPage). Move to `_shared/integration-registry.ts`.

**#6: pg_cron for crawl-recover.** Wire `crawl-recover` to run every 5 minutes via pg_cron for fully server-side zombie recovery (currently client-side only).

**Other priorities:**
- Re-crawl sites (80+ historical crawls lost)
- Pattern Library (Brain Pillar 3)
- Team utilization view (port `harvest-time` from AgencyAtlas)
- Scheduled sync (every 30 min deals/contacts, every 6 hrs companies/harvest/freshdesk)
- MCP integration for Chat Live connections
- Supabase types regeneration (schema changed, types.ts is stale)

### Custom Skills (shipped Apr 5 2026)
- `/startup` and `/shutdown` session lifecycle skills at `~/.claude/skills/` (user-level)
- Desktop machine needs manual copy of `~/.claude/skills/startup/` and `~/.claude/skills/shutdown/`
- Project-level copies exist in `.claude/skills/` but worktree autocomplete discovery was unreliable

---

## 3E Methodology
1. **Effective** — solving the problem (most important)
2. **Efficient** — solving it with the least effort
3. **Extraordinary** — exceeding everyone's expectations
