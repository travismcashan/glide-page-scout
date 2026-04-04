# GLIDE® / Ascend — Project Context

## Deployment

Hosted on Vercel with auto-deploy on push to `main`.

## Session Startup

At the start of every session, before starting the dev server:

1. `git fetch origin main && git rebase origin/main` (in the worktree)
2. `cd /Users/travismcashan/glide-page-scout && export PATH="/opt/homebrew/bin:$PATH" && npm install --silent` (main repo root — worktrees share its node_modules)

This ensures dependencies are always up to date. Do not skip this.

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

## Navigation Architecture — Workspaces

The app uses a workspace switcher (in the logo area) to scope the entire UI by pillar. Same brain underneath, different lens on top.

```
┌──────────────────────────────────────────────┐
│  GLIDE® [▾ Growth]              Travis ●     │
│──────────────────────────────────────────────│
│  [ Companies ] [ Pipeline ] [ Knowledge ]    │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  GLIDE® [▾ Delivery]           Travis ●      │
│──────────────────────────────────────────────│
│  [ Clients ] [ Projects ] [ Knowledge ]      │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  GLIDE® [▾ Admin]              Travis ●      │
│──────────────────────────────────────────────│
│  [ Clients ] [ Hours ] [ Invoicing ]         │
└──────────────────────────────────────────────┘
```

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
- **Company detail page:** Dynamic tabs (Overview, Contacts, Deals, Projects, Time, Invoices, Tickets, Sites, Knowledge, Roadmap, Chat). Harvest/Freshdesk tabs appear only when external IDs exist.
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

## 3E Methodology
1. **Effective** — solving the problem (most important)
2. **Efficient** — solving it with the least effort
3. **Extraordinary** — exceeding everyone's expectations
