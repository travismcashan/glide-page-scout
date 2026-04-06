# API/Integration Gap Audit — Full Inventory

> Generated 2026-04-05 by api-auditor agent
> Covers all 25+ integrations in the Ascend platform

---

## Table of Contents

1. [HubSpot](#1-hubspot)
2. [Apollo.io](#2-apolloio)
3. [Ocean.io](#3-oceanio)
4. [Harvest](#4-harvest)
5. [Asana](#5-asana)
6. [Freshdesk](#6-freshdesk)
7. [Avoma](#7-avoma)
8. [Gmail](#8-gmail)
9. [Slack](#9-slack)
10. [Google Analytics (GA4)](#10-google-analytics-ga4)
11. [Google Search Console](#11-google-search-console)
12. [Google Drive](#12-google-drive)
13. [PageSpeed Insights](#13-pagespeed-insights)
14. [GTmetrix](#14-gtmetrix)
15. [WAVE](#15-wave)
16. [W3C Validation](#16-w3c-validation)
17. [Mozilla Observatory](#17-mozilla-observatory)
18. [SSL Labs](#18-ssl-labs)
19. [Website Carbon](#19-website-carbon)
20. [CrUX](#20-crux)
21. [SEMrush](#21-semrush)
22. [Yellow Lab Tools](#22-yellow-lab-tools)
23. [BuiltWith](#23-builtwith)
24. [Firecrawl](#24-firecrawl)
25. [Other Crawl Integrations](#25-other-crawl-integrations)

---

## 1. HubSpot

### Edge Functions
- `hubspot-lookup` — crawl-time domain lookup (returns companies, contacts, deals, engagements, form submissions)
- `hubspot-deals-sync` — batch sync of ALL deals across 3 pipelines → `deals` table
- `hubspot-contacts-sync` — batch sync of lead contacts (by lead_status) → `contacts` table
- `hubspot-pipeline` — pipeline stage config/fetching
- `hubspot-sync` — legacy batch sync (reference/fallback)
- `company-artifacts` — on-demand deals + engagements fetch per company

### Connection Type
**Synced** (deals-sync + contacts-sync run on schedule/manual) + **Live** (company-artifacts on-demand)

### Fields We Fetch from HubSpot API

**Companies** (via search + batch read):
- name, domain, industry, numberofemployees, annualrevenue, city, state, country, phone, website, description, lifecyclestage, hs_lead_status, createdate, notes_last_updated

**Contacts** (via search + batch read):
- firstname, lastname, email, company, jobtitle, phone, mobilephone, lifecyclestage, hs_lead_status, hubspot_owner_id, notes_last_updated, lastmodifieddate, createdate, hs_email_last_send_date

**Deals** (via search):
- dealname, amount, dealstage, pipeline, closedate, createdate, hs_lastmodifieddate, hubspot_owner_id, dealtype, hs_priority, deal_source_details, hs_forecast_probability, notes_last_contacted

**Engagements** (5 types via associations):
- Emails: hs_email_subject, hs_email_direction, hs_email_status, hs_email_text, hs_timestamp, hs_email_sender_email, hs_email_to_email
- Calls: hs_call_title, hs_call_body, hs_call_direction, hs_call_disposition, hs_call_duration, hs_call_status, hs_timestamp
- Meetings: hs_meeting_title, hs_meeting_body, hs_meeting_start_time, hs_meeting_end_time, hs_meeting_outcome, hs_timestamp
- Notes: hs_note_body, hs_timestamp
- Tasks: hs_task_subject, hs_task_body, hs_task_status, hs_task_priority, hs_timestamp

**Form Submissions** (via contacts profile + form submissions API):
- form title, form ID, page URL, timestamp, conversion ID, all field values

**Owners**: firstName, lastName, email (via /crm/v3/owners)

### Where We Store It

| Data | Table | Key Columns |
|------|-------|-------------|
| Deals | `deals` | hubspot_deal_id, company_id, contact_id, name, amount, stage, pipeline, deal_type, priority, close_date, status, hubspot_owner_id, properties (JSONB with createdate, hs_lastmodifieddate, forecast_probability, etc.) |
| Lead contacts | `contacts` | hubspot_contact_id, company_id, first_name, last_name, email, phone, title, photo_url, lead_status, lifecycle_stage, hubspot_owner_id, enrichment_data (JSONB with company_name, dates, owner_name) |
| Deal contacts | `contacts` | same as above (synced via deals-sync) |
| Companies | `companies` | hubspot_company_id, name, domain, industry, employee_count, annual_revenue, location, website_url, status |
| HubSpot raw (crawl) | `crawl_sessions.hubspot_data` | Full response from hubspot-lookup (companies, contacts, deals, engagements, form submissions, stats) |
| Enrichment forward-sync | `companies.enrichment_data.hubspot` | Copied from crawl_sessions via syncEnrichmentToCompany() |
| Engagements | `engagements` table | hubspot_engagement_id, company_id, contact_id, deal_id, engagement_type, subject, body_preview, direction, occurred_at, metadata |

### What We DON'T Store (Gaps)

1. **HubSpot company properties**: description, phone, notes_last_updated — fetched but not stored on companies table
2. **Contact mobilephone** — fetched but not stored
3. **Contact city/state/country** — fetched in hubspot-lookup but not stored anywhere
4. **Deal contact associations** — only first contact per deal stored (1:1), HubSpot supports many:many
5. **HubSpot custom properties** — none fetched beyond standard fields
6. **HubSpot pipeline stage labels/probabilities** — partially in deals.properties but not in a dedicated lookup table
7. **HubSpot company lifecycle stage transitions** — not tracked historically
8. **Form submission field values** — fetched in hubspot-lookup but not persisted to any table (only returned live)
9. **Engagement full body** — body_preview truncated to 500 chars, full text not stored
10. **HubSpot tickets** — not fetched at all (using Freshdesk for tickets)
11. **HubSpot marketing emails / sequences** — not fetched
12. **HubSpot line items / products / quotes** — not fetched
13. **HubSpot company associations** (parent/child companies) — not fetched
14. **Owner email / team assignments** — only name stored in deals.properties

---

## 2. Apollo.io

### Edge Functions
- `apollo-enrich` — single person/match by email or domain → crawl_sessions.apollo_data
- `apollo-team-search` — team discovery (marketing + c-suite) → crawl_sessions.apollo_team_data
- `enrich-contacts` — batch enrichment of contacts table via Apollo people/match

### Connection Type
**Static** (crawl-time) + **Synced** (batch enrichment triggered by sync functions)

### Fields We Fetch

**People/Match API** (`/v1/people/match`):
- Person: id, first_name, last_name, name, title, headline, photo_url, email, email_status, personal_emails, phone_numbers, street_address, city, state, country, postal_code, formatted_address, linkedin_url, twitter_url, facebook_url, github_url, seniority, departments, subdepartments, functions, is_likely_to_engage, intent_strength, employment_history
- Organization (nested): name, primary_domain, website_url, logo_url, industry, industries, secondary_industries, estimated_num_employees, founded_year, annual_revenue, short_description, keywords, phone, city, state, country, linkedin_url, twitter_url, facebook_url, sic_codes, naics_codes, alexa_ranking, publicly_traded_symbol, headcount_growth (6/12/24mo), current_technologies

**Team Search API** (`/api/v1/mixed_people/api_search`):
- Same person fields as above, searched by domain with seniority/department filters
- Bulk match enrichment on top 5 per group

### Where We Store It

| Data | Table | Column |
|------|-------|--------|
| Crawl-time person+org | `crawl_sessions.apollo_data` | Full response from apollo-enrich |
| Crawl-time team | `crawl_sessions.apollo_team_data` | Full response from apollo-team-search |
| Contact enrichment | `contacts.enrichment_data.apollo` | **ENTIRE raw Apollo person object** (per data-first rules) |
| Contact top-level fields | `contacts` | apollo_person_id, photo_url, title, seniority, linkedin_url, department |
| Org data forward-synced | `companies.enrichment_data.apollo_org` | Organization-prefixed fields extracted from apollo_data |
| Team data forward-synced | `companies.enrichment_data.apollo_team` | Full team search response |

### What We DON'T Store (Gaps)

1. **Apollo org enrichment API** (`/v1/organizations/enrich`) — NOT used. Org data only comes as nested data within person/match. The dedicated org enrichment endpoint provides more fields (technologies list, funding data, org chart data, departmental headcounts).
2. **Apollo people search** (`/v1/mixed_people/search`) — team search only hits marketing + c-suite. No broader search by department.
3. **Apollo account data** — not used at all
4. **Apollo sequences/campaigns** — not integrated
5. **Apollo job postings** (`/v1/organizations/job_postings`) — not used, could provide hiring signals
6. **Contact phone numbers** — fetched but only first number stored on contacts.phone; all numbers are in enrichment_data
7. **Employment history** — in enrichment_data but not surfaced as structured data
8. **Intent signals** (is_likely_to_engage, intent_strength) — in enrichment_data but not surfaced/used for scoring

---

## 3. Ocean.io

### Edge Functions
- `ocean-enrich` — company enrichment by domain → crawl_sessions.ocean_data
- `enrich-companies` — batch enrichment of companies table via Ocean.io

### Connection Type
**Static** (crawl-time) + **Synced** (batch enrichment)

### Fields We Fetch

**Company Enrich API** (`/v2/enrich/company`):
- domain, name, countries, primaryCountry, companySize, industries, industryCategories, linkedinIndustry, technologies, technologyCategories, yearFounded, revenue, description, ecommercePlatform, employeeCountLinkedin, employeeCountOcean, departmentSizes, locations, emails, medias, logo, keywords, webTraffic, rootUrl, updatedAt

### Where We Store It

| Data | Table | Column |
|------|-------|--------|
| Crawl-time response | `crawl_sessions.ocean_data` | Full response |
| Batch enrichment | `companies.enrichment_data.ocean` | **ENTIRE raw Ocean.io response** + enriched_at timestamp |
| Forward-synced | `companies.enrichment_data.ocean` | Copied from crawl_sessions via syncEnrichmentToCompany() |
| Top-level updates | `companies.industry`, `companies.logo_url` | Updated if empty |

### What We DON'T Store (Gaps)

1. **Ocean.io similar companies** (`/v2/similar/companies`) — not used, could provide lookalike companies for prospecting
2. **Ocean.io people search** — not used, could supplement Apollo for contacts
3. **Web traffic details** — webTraffic is stored but not broken down or historicized
4. **Department size trends** — point-in-time only, no historical tracking

---

## 4. Harvest

### Edge Functions
- `harvest-sync` — full sync of projects, time entries, invoices, payments, contacts → dedicated Harvest tables
- `harvest-lookup` — (exists but harvest-sync is primary)
- `harvest-oauth-exchange` — OAuth token exchange
- `company-artifacts` — on-demand projects, time_entries, invoices per company

### Connection Type
**Synced** (harvest-sync) + **Live** (company-artifacts on-demand)

### Fields We Fetch

**Projects** (`/v2/projects`): id, name, code, is_active, is_billable, bill_by, budget, budget_by, budget_is_monthly, notify_when_over_budget, over_budget_notification_percentage, starts_on, ends_on, notes, cost_budget, cost_budget_include_expenses, fee, hourly_rate, created_at, updated_at

**Time Entries** (`/v2/time_entries`): id, spent_date, hours, rounded_hours, billable, budgeted, billable_rate, cost_rate, notes, is_locked, is_closed, is_billed, is_running, project (id, name), task (id, name), user (id, name), client (id), created_at, updated_at

**Invoices** (`/v2/invoices`): id, number, amount, due_amount, tax, tax_amount, tax2, tax2_amount, discount, discount_amount, subject, notes, state, issue_date, due_date, sent_at, paid_at, paid_date, period_start, period_end, currency, purchase_order, payment_term, client (id)

**Invoice Payments** (`/v2/invoices/{id}/payments`): id, amount, paid_at, paid_date, recorded_by, recorded_by_email, notes, transaction_id, payment_gateway

**Client Contacts** (`/v2/contacts`): first_name, last_name, email, phone_office, phone_mobile, title, client (id)

**Clients** (`/v2/clients`): id, name, is_active (fetched in global-sync)

### Where We Store It

| Data | Table | Key Columns |
|------|-------|-------------|
| Projects | `harvest_projects` | harvest_project_id, company_id, name, code, is_active, is_billable, budget, budget_by, hourly_rate, fee, starts_on, ends_on, notes, raw_data (full response) |
| Time Entries | `harvest_time_entries` | harvest_time_entry_id, company_id, harvest_project_id, harvest_task_id, harvest_user_id, harvest_user_name, task_name, project_name, spent_date, hours, rounded_hours, billable, notes, raw_data |
| Invoices | `harvest_invoices` | harvest_invoice_id, company_id, harvest_client_id, number, amount, due_amount, subject, state, issue_date, due_date, paid_at, period_start, period_end, raw_data |
| Payments | `harvest_invoice_payments` | harvest_payment_id, harvest_invoice_id, amount, paid_at, notes, raw_data |
| Contacts | `contacts` (merged) | first_name, last_name, email, phone, title, company_id |
| Client mapping | `companies.harvest_client_id` | Links company to Harvest client |
| QuickBooks summary | `companies.quickbooks_invoice_summary` | JSONB invoice summary (from CSV import, not Harvest) |

### What We DON'T Store (Gaps)

1. **Harvest expenses** — not fetched at all (`/v2/expenses`)
2. **Harvest tasks** — not synced as standalone entities (only task_name on time entries)
3. **Harvest user assignments per project** — not fetched (`/v2/user_assignments`)
4. **Harvest task assignments per project** — not fetched (`/v2/task_assignments`)
5. **Harvest company/client address/currency** — available but not synced
6. **Harvest estimates** — not fetched (`/v2/estimates`)
7. **Harvest roles** — not fetched
8. **Invoice line items** — not fetched (only invoice-level totals)
9. **Budget utilization** — calculated on-the-fly, not stored as a metric

---

## 5. Asana

### Edge Functions
- `asana-projects-sync` — syncs projects from configured portfolios → `asana_projects` table
- `asana-lookup` — direct project/task lookup
- `company-artifacts` — NOT used for Asana (Projects page hits Asana API live)

### Connection Type
**Synced** (asana-projects-sync on schedule) + **Live** (Projects page still hits API directly — TODO)

### Fields We Fetch

**Projects** (via portfolio items + project details):
- gid, name, current_status (color, text, modified_at), start_on, due_on, owner.name, members.name, custom_fields (name, display_value), num_tasks, archived

### Where We Store It

| Data | Table | Key Columns |
|------|-------|-------------|
| Projects | `asana_projects` | asana_project_gid, company_id, name, status_color, status_text, start_on, due_on, owner_name, num_tasks, archived, portfolio_name, custom_fields, raw_data |
| Mapping | `project_mappings` | asana_project_gid → harvest_project_id, with AI-match confidence |
| Config | `asana_config` | portfolio_gid, portfolio_name, display_name |
| Company link | `companies.asana_project_gids` | Array of Asana project GIDs per company |

### What We DON'T Store (Gaps)

1. **Asana tasks** — not synced at all (only num_tasks count). Tasks contain the actual work items, assignees, due dates, subtasks, stories.
2. **Asana sections** — not synced (project board columns/phases)
3. **Asana milestones** — not fetched
4. **Asana goals** — not fetched (could map to KPIs)
5. **Asana time tracking** — not fetched (Asana has built-in time tracking)
6. **Asana project members** — names fetched but not stored in contacts
7. **Asana attachments** — not fetched
8. **Asana project status updates history** — only current_status stored
9. **Asana portfolios** — config stored but portfolio-level metadata not synced
10. **Asana custom fields** — stored as array but not parsed into structured data

---

## 6. Freshdesk

### Edge Functions
- `freshdesk-sync` — full sync of tickets, conversations, contacts → dedicated tables
- `freshdesk-lookup` — (exists)
- `company-artifacts` — on-demand ticket fetch per company

### Connection Type
**Synced** (freshdesk-sync) + **Live** (company-artifacts on-demand)

### Fields We Fetch

**Tickets** (`/api/v2/tickets`): id, subject, description_text, status, priority, type, source, tags, requester (name, email), stats (resolved_at, closed_at, first_responded_at), group_id, responder_id, company_id, created_at, updated_at, due_by, satisfaction_rating

**Ticket Conversations** (`/api/v2/tickets/{id}/conversations`): id, body_text, body (HTML), incoming, private, from_email, to_emails, support_email, source, created_at

**Contacts** (`/api/v2/contacts`): name, email, phone, mobile, job_title, company_id

### Where We Store It

| Data | Table | Key Columns |
|------|-------|-------------|
| Tickets | `freshdesk_tickets` | freshdesk_ticket_id, company_id, requester_name, requester_email, subject, description_text (2000 char), status, status_label, priority, priority_label, ticket_type, source_label, tags, resolved_at, closed_at, first_responded_at, satisfaction_rating, raw_data |
| Conversations | `freshdesk_ticket_conversations` | freshdesk_conversation_id, freshdesk_ticket_id, body_text (5000 char), incoming, private_note, from_email, to_emails, raw_data |
| Contacts | `contacts` (merged) | first_name, last_name, email, phone, title, company_id |
| Company mapping | `companies.freshdesk_company_id` | Links company to Freshdesk |

### What We DON'T Store (Gaps)

1. **Freshdesk companies** — company details (domain, health_score, industry, etc.) not synced from Freshdesk
2. **Freshdesk satisfaction survey details** — only rating stored, not survey comments
3. **Freshdesk ticket custom fields** — not extracted
4. **Freshdesk canned responses / solutions** — not fetched
5. **Freshdesk agent metrics** — not fetched (response times, resolution times as aggregates)
6. **Freshdesk time entries on tickets** — not fetched
7. **Group/agent names** — stored as "group-{id}" / "agent-{id}", not resolved to actual names

---

## 7. Avoma

### Edge Functions
- `avoma-lookup` — meeting search by domain + contact emails, with transcript + insights enrichment

### Connection Type
**Static** (crawl-time) + **Live** (on-demand meeting search)

### Fields We Fetch

**Meetings API** (`/v1/meetings/`): uuid, subject, start_at, end_at, duration, state, is_call, organizer_email, attendees (email, name), purpose, outcome, transcript_ready, notes_ready, transcription_uuid, recording_uuid

**Transcriptions API** (`/v1/transcriptions/{uuid}/`): speakers (id, name, email), transcript segments (transcript text, speaker_id, timestamps)

**Insights API** (`/v1/meetings/{uuid}/insights/`): ai_notes (text, note_type), keywords (popular), speakers

### Where We Store It

| Data | Table | Column |
|------|-------|--------|
| Crawl-time response | `crawl_sessions.avoma_data` | Full meeting list + enriched transcripts/insights |
| Forward-synced | `companies.enrichment_data.avoma` | Copied from crawl_sessions |

### What We DON'T Store (Gaps)

1. **Full transcripts** — only first 50 segments stored per meeting (truncated)
2. **Meeting recordings/videos** — recording_uuid stored but actual recordings not downloaded
3. **Avoma CRM sync data** — not used
4. **Avoma coaching/scoring data** — not fetched
5. **Avoma action items** — not extracted from insights
6. **Historical meeting data** — no persistent storage in dedicated table; re-fetched every time
7. **Meeting attendee details** — only email+name, no enrichment cross-reference with contacts table

---

## 8. Gmail

### Edge Functions
- `gmail-lookup` — email search by contact emails or domain, attachment download

### Connection Type
**Live** (OAuth, on-demand search)

### Fields We Fetch

**Messages API** (`/gmail/v1/users/me/messages`): id, threadId, subject, from, to, date, snippet, body (text/html, 5000 char limit), attachments (id, filename, mimeType, size)

### Where We Store It

| Data | Storage |
|------|---------|
| Emails | **NOT persisted** — returned live to client, no DB storage |

### What We DON'T Store (Gaps)

1. **No email persistence at all** — every search re-fetches from Gmail API
2. **Email threads** — threadId fetched but threads not aggregated
3. **Labels/categories** — not fetched
4. **CC/BCC** — not fetched
5. **Full body** — truncated to 5,000 chars
6. **Attachment content** — downloadable via separate action but not stored
7. **Email metadata** — no tracking of communication frequency/patterns

---

## 9. Slack

### Edge Functions
- `slack-search` — message search by query string
- `slack-oauth-exchange` — OAuth token exchange

### Connection Type
**Live** (OAuth, on-demand search)

### Fields We Fetch

**Search API** (`search.messages`): ts, text, username/user, channel (name, id), permalink

### Where We Store It

| Data | Storage |
|------|---------|
| Messages | **NOT persisted** — returned live to client, no DB storage |

### What We DON'T Store (Gaps)

1. **No message persistence** — re-fetched every search
2. **Channel history** — not fetched (only search results)
3. **Slack reactions/threads** — not fetched
4. **Slack files/attachments** — not fetched
5. **Slack user profiles** — not enriched
6. **Slack channel list** — not stored
7. **Bookmarks/pins** — not fetched

---

## 10. Google Analytics (GA4)

### Edge Functions
- `ga4-lookup` (also called `ga4-fetch` in registry) — fetches analytics data by domain/property

### Connection Type
**Premium** (OAuth required, not auto-run in crawl pipeline)

### Fields We Fetch

Fetches from GA4 Data API (`analyticsdata.googleapis.com`): sessions, users, pageviews, bounce rate, session duration, traffic sources, top pages, conversions/key events

### Where We Store It

| Data | Table | Column |
|------|-------|--------|
| GA4 data | `crawl_sessions.ga4_data` | Full response |

### What We DON'T Store (Gaps)

1. **GA4 data not on companies table** — only on crawl_sessions, not forward-synced to enrichment_data
2. **Historical trends** — point-in-time only, no time-series tracking
3. **Real-time data** — not fetched
4. **Custom dimensions/metrics** — not specified in requests
5. **E-commerce data** — not fetched
6. **User demographics (age, gender, interests)** — not fetched
7. **Event-level data** — only aggregate metrics
8. **Google Ads linked data** — not fetched through GA4

---

## 11. Google Search Console

### Edge Functions
- `search-console-lookup` (also `search-console-fetch` in registry) — fetches search performance data

### Connection Type
**Premium** (OAuth required, not auto-run)

### Fields We Fetch

Fetches from Search Console API: queries, pages, clicks, impressions, CTR, position

### Where We Store It

| Data | Table | Column |
|------|-------|--------|
| GSC data | `crawl_sessions.search_console_data` | Full response |

### What We DON'T Store (Gaps)

1. **GSC data not on companies table** — not forward-synced to enrichment_data
2. **Index coverage** — not fetched (which pages indexed, errors, warnings)
3. **Sitemaps status** — not fetched from GSC
4. **URL inspection** — not used
5. **Core Web Vitals (GSC view)** — not fetched (using CrUX instead)
6. **Historical trends** — point-in-time only
7. **Mobile vs desktop breakdown** — not specified

---

## 12. Google Drive

### Edge Functions
- `google-drive-list` — list files in folders
- `google-drive-download` — download file content
- `google-drive-picker` — picker integration
- `google-doc-export` — export Google Docs to markdown

### Connection Type
**Live** (OAuth, on-demand)

### Where We Store It

Drive content is ingested into the **Knowledge Base** via `rag-ingest` for RAG search. No structured storage of Drive metadata.

### What We DON'T Store (Gaps)

1. **File metadata** — not stored (modified dates, owners, sharing permissions)
2. **Folder structure** — not mapped
3. **File change history** — not tracked
4. **Sync status** — no tracking of which files have been ingested

---

## 13. PageSpeed Insights

### Edge Functions
- `pagespeed-insights` — Lighthouse audit via PSI API

### Connection Type
**Static** (crawl-time, free, auto-run)

### Where We Store It
`crawl_sessions.psi_data` — Full Lighthouse response (performance, SEO, accessibility, best practices scores + audits)

### Gaps
- Full Lighthouse JSON stored; comprehensive for a single page
- **Multi-page audits** — only homepage tested
- No historical trend storage

---

## 14. GTmetrix

### Edge Functions
- `gtmetrix-test` — performance test
- `gtmetrix-pdf` — PDF report download

### Connection Type
**Static** (crawl-time, paid, auto-run)

### Where We Store It
`crawl_sessions.gtmetrix_scores` + `crawl_sessions.gtmetrix_grade` + `crawl_sessions.gtmetrix_test_id`

### Gaps
- **Only homepage tested**
- PDF reports not stored permanently
- Historical performance trends not tracked

---

## 15. WAVE

### Edge Functions
- `wave-lookup` — accessibility audit

### Connection Type
**Static** (crawl-time, freemium, auto-run)

### Where We Store It
`crawl_sessions.wave_data` — errors, contrast issues, ARIA problems, alerts, features, structure

### Gaps
- **Single page only** (homepage)
- No WCAG conformance level tracking

---

## 16. W3C Validation

### Edge Functions
- `w3c-validate` — HTML validation

### Connection Type
**Static** (crawl-time, free, auto-run)

### Where We Store It
`crawl_sessions.w3c_data`

### Gaps
- **Single page only**
- CSS validation not included

---

## 17. Mozilla Observatory

### Edge Functions
- `observatory-scan` — security header analysis

### Connection Type
**Static** (crawl-time, free, auto-run)

### Where We Store It
`crawl_sessions.observatory_data`

### Gaps
- Comprehensive for security headers
- No penetration testing or vulnerability scanning

---

## 18. SSL Labs

### Edge Functions
- `ssllabs-scan` — SSL/TLS analysis

### Connection Type
**Premium** (free but not auto-run — slow API, manual trigger)

### Where We Store It
`crawl_sessions.ssllabs_data`

### Gaps
- Long scan times (can take minutes)
- Not integrated into scoring by default

---

## 19. Website Carbon

### Edge Functions
- `website-carbon` — carbon footprint estimation

### Connection Type
**Static** (crawl-time, free, auto-run)

### Where We Store It
`crawl_sessions.carbon_data`

### Gaps
- Single page only
- Relative comparison data limited

---

## 20. CrUX

### Edge Functions
- `crux-lookup` — Chrome UX Report (real user data)

### Connection Type
**Static** (crawl-time, free, auto-run)

### Where We Store It
`crawl_sessions.crux_data` — Core Web Vitals (LCP, FID/INP, CLS) with percentile distributions

### Gaps
- Only available for sites with enough traffic (many smaller sites return no data)
- No historical trends

---

## 21. SEMrush

### Edge Functions
- `semrush-domain` — domain overview (rankings, traffic, keywords)

### Connection Type
**Static** (crawl-time, paid, **currently paused** — out of credits)

### Where We Store It
`crawl_sessions.semrush_data` + forward-synced to `companies.enrichment_data.semrush`

### Gaps
- **Currently non-functional** (paused, empty data)
- When active: only domain overview, no keyword-level detail, no backlink data, no competitor comparison
- No historical ranking trends

---

## 22. Yellow Lab Tools

### Edge Functions
- `yellowlab-scan` — code quality analysis

### Connection Type
**Static** (crawl-time, free, auto-run)

### Where We Store It
`crawl_sessions.yellowlab_data`

### Gaps
- Single page only
- Detailed rule-level breakdown may not be fully utilized

---

## 23. BuiltWith

### Edge Functions
- `builtwith-lookup` — technology detection

### Connection Type
**Static** (crawl-time, paid, auto-run)

### Where We Store It
`crawl_sessions.builtwith_data`

### Gaps
- Good coverage; also supplemented by `detectzestack-lookup` and `tech-analysis` (AI synthesis)
- Technology change tracking over time not implemented

---

## 24. Firecrawl

### Edge Functions
- `firecrawl-map` — URL discovery (site map)
- `firecrawl-scrape` — page content extraction (separate from crawl pipeline)
- `content-scrape` — markdown extraction

### Connection Type
**Static** (crawl-time, paid, auto-run for map; manual for content)

### Where We Store It
`crawl_sessions.discovered_urls` — list of all discovered URLs on the site
`crawl_sessions.content_data` — page markdown content (manual trigger)

### Gaps
- URL discovery is comprehensive
- **Page content not auto-scraped** for all pages (manual/on-demand only)
- No persistent content storage across crawl sessions

---

## 25. Other Crawl Integrations

| Integration | Edge Function | Column | Notes |
|---|---|---|---|
| Schema.org | `schema-validate` | `schema_data` | JSON-LD/microdata validation |
| XML Sitemaps | `sitemap-parse` | `sitemap_data` | Sitemap analysis |
| HTTP Status | `httpstatus-check` | `httpstatus_data` | Redirect chain, TTFB |
| Link Checker | `link-checker` | `linkcheck_data` | Broken links, redirects |
| Readability | `readable-score` | `readable_data` | Flesch score, grade level |
| Nav Structure | `nav-extract` | `nav_structure` | Navigation depth/breadth |
| Content Types | `content-types` | `content_types_data` | Page type classification |
| Forms Detection | `forms-detect` | `forms_data` | Form types, platforms, captcha |
| Page Tags | `page-tag-orchestrate` | `page_tags` | AI page classification |
| Content Audit | `content-audit` | `content_audit_data` | Template tier analysis |
| Screenshots | `screenshots` | `screenshots_data` | Visual capture (manual) |
| Tech Analysis | `tech-analysis` | `tech_analysis_data` | AI-synthesized tech assessment |
| DetectZeStack | `detectzestack-lookup` | `detectzestack_data` | Alt tech detection |

All stored on `crawl_sessions`. **Gaps**: All are single-session point-in-time. No cross-session comparison or trend tracking.

---

## Summary: Cross-Cutting Gaps

### 1. Data Persistence Gaps
- **Gmail emails**: fetched live, never stored
- **Slack messages**: fetched live, never stored
- **Avoma meetings**: fetched live, no dedicated meetings table
- **HubSpot form submissions**: fetched but not persisted
- **HubSpot engagements (live)**: company-artifacts returns live, engagements table may be empty for many companies

### 2. Enrichment Gaps
- **Apollo org enrichment** endpoint not used (only person endpoint with nested org)
- **Apollo job postings** not used (hiring signals)
- **Ocean.io similar companies** not used (lookalike prospecting)
- **SEMrush** paused (no credits)
- **Google Ads** not integrated at all

### 3. Historical/Trend Gaps
- No crawl-over-crawl comparison (no site health trends)
- No deal velocity tracking over time (only current state)
- No contact engagement scoring over time
- No company health score trending

### 4. Missing Integrations (Not Connected)
- **Google Ads** — no integration exists
- **LinkedIn** — no API integration (only URL storage)
- **QuickBooks** — CSV import only, no live API
- **Calendly/scheduling** — no integration
- **Zoom** — no integration (using Avoma for meeting data)

### 5. Forward-Sync Gaps
- `ga4_data` and `search_console_data` NOT forward-synced to `companies.enrichment_data`
- `hubspot_data` from crawl partially synced but form submissions lost
- Avoma data forward-synced but re-fetched every time anyway

### 6. Table/Entity Gaps
- No `meetings` table (Avoma data lives on crawl_sessions/enrichment_data)
- No `emails` table (Gmail data not stored)
- No `messages` table (Slack data not stored)
- No `form_submissions` table (HubSpot form data not persisted)
- No `site_health_history` table (no crawl trending)
- `engagements` table exists but may be empty (on-demand only via company-artifacts, not batch synced)
