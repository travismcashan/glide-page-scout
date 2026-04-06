# Plan: Connections + Knowledge Base Completeness

> "Get ALL the info in and elegantly stored in knowledge."

## Strategy
Prove the full data pipeline on 3 test companies (1 lead, 1 deal, 1 active client), then scale to all.

## Test Companies

| Type | Company | ID | Domain |
|------|---------|-----|--------|
| Lead | Texas Pecan Growers Association | 1775259f-d640-4946-ba48-72da17bf3cb7 | tpga.org |
| Deal | ABC Home & Commercial Services | 24743304-c53c-441f-a2a0-470ed92d39bf | goanteater.com |
| Active Client | AllerVie Health | 6d1d3ae8-26b0-41df-9568-5d3770aa41aa | allervie.com |

## Phase 1: Fill Communication Tables (per-company sync)

For each test company, run all 3 communication syncs + engagements vectorization:

### Step 1: Gmail sync
- Invoke `gmail-sync` with company_id + domain
- Expect: emails from/to company domain stored in company_emails
- Prerequisite: Google OAuth token in oauth_connections (check if exists)

### Step 2: Avoma sync
- Invoke `avoma-sync` with company_id + domain + contact emails
- Expect: meetings with company contacts stored in company_meetings with full transcripts

### Step 3: Slack sync  
- Invoke `slack-sync` with company_id + company name + domain
- Expect: Slack messages mentioning company stored in company_messages
- Prerequisite: Slack OAuth token in oauth_connections (check if exists)

### Step 4: Vectorize engagements
- Run `rag-vectorize-comms` to process remaining un-vectorized engagements for these 3 companies
- Expect: engagements appear in knowledge_chunks, searchable by Chat

### Step 5: Verify RAG auto-ingest
- After each sync, verify new records appear in knowledge_documents + knowledge_chunks
- Test Chat search: "What meetings have we had with AllerVie?" should return results

## Phase 2: Fill Knowledge Gaps (per-company)

### Step 6: Ensure crawl data exists
- Each company should have at least 1 crawl session
- If not, trigger a crawl for their domain
- Crawl data (site content, tech stack, page text) should be in KB

### Step 7: Apollo org enrichment
- Run dedicated org enrichment endpoint for richer company data
- Store in companies.enrichment_data.apollo_org

### Step 8: Surface all data on company pages
- Visit each test company page
- Verify every tab has data:
  - Overview: metrics, enrichment cards (Apollo, Ocean, GA4, GSC)
  - Contacts: team with enrichment badges
  - Deals: pipeline cards (deal company) or empty state (lead)
  - Voice: emails, meetings, messages (FROM LOCAL DB, not live)
  - Knowledge: RAG documents searchable
  - Chat: can answer questions about the company using all ingested data
  - Patterns: AI suggestions based on industry + crawl data

## Phase 3: Test Chat Intelligence

### Step 9: Chat queries across sources
For AllerVie (richest data), test these Chat queries:
- "Summarize our relationship with AllerVie"
- "What were the action items from our last meeting?"
- "What's their tech stack and how does it compare to similar healthcare companies?"
- "What Slack conversations have we had about them?"

Each should draw from multiple sources (engagements, meetings, crawl data, enrichment).

## Phase 4: Scale to All

### Step 10: Batch sync
Only AFTER Phase 1-3 prove the pipeline works:
- Build `batch-comm-sync` edge function (like batch-crawl)
- Run for all leads with HubSpot contacts
- Run for all deal companies
- Run for all active clients
- Monitor: check knowledge_documents count grows, verify no errors in sync_runs

## Success Criteria

A company page should feel like opening a complete dossier:
- Every email, meeting, and Slack message with that company — stored and searchable
- Site audit with scores, tech stack, content analysis
- Contact team with enrichment (titles, LinkedIn, org intel)
- Deal pipeline with velocity metrics
- AI Chat that can answer ANY question by searching across ALL sources
- Pattern suggestions based on their industry and site data

## Prerequisites to Check Before Starting

1. Google OAuth token exists in oauth_connections for Gmail access
2. Slack OAuth token exists in oauth_connections for Slack access
3. AVOMA_API_KEY is valid and has API access
4. All 3 test companies have at least 1 contact with email (for Avoma matching)
5. rag-ingest edge function is deployed and working

## Estimated Effort

- Phase 1 (fill tables): 1 agent, ~30 min
- Phase 2 (knowledge gaps): 1 agent, ~30 min
- Phase 3 (test chat): manual verification by Travis
- Phase 4 (scale): 1 agent, ~30 min (after Travis approves Phase 1-3)
