# Plan: Contact deduplication across sync sources

## Research Findings

### Contact Write Paths — 5 sources, 4 dedup strategies

| Source | File | Dedup Strategy | Match Key | Upsert? |
|--------|------|----------------|-----------|---------|
| **HubSpot Deals Sync** | `hubspot-deals-sync/index.ts:262-311` | Manual select-then-insert/update | `hubspot_contact_id` | No — manual loop |
| **HubSpot Contacts Sync** | `hubspot-contacts-sync/index.ts:168-212` | Batch upsert | `hubspot_contact_id` (onConflict) | Yes |
| **Harvest Sync** | `harvest-sync/index.ts:274-319` | Manual select-then-insert/update | `email + company_id` | No — manual loop |
| **Freshdesk Sync** | `freshdesk-sync/index.ts:190-235` | Manual select-then-insert/update | `email + company_id` | No — manual loop |
| **Apollo (frontend)** | `src/lib/agencyBrain.ts:83-148` | Manual select-then-insert/update | `email` (global) | No — manual loop |

### The Dedup Problem

There is **no unique constraint on email** in the contacts table. The schema has indexes (`idx_contacts_email`) but no UNIQUE constraint. This means:

1. **HubSpot deals sync** deduplicates within its own batch (line 272: `if (contactRows.find(r => r.email === contact.email)) continue`) but matches existing records by `hubspot_contact_id` only. If a contact was previously created by Harvest or Freshdesk (no `hubspot_contact_id`), a duplicate will be created.

2. **HubSpot contacts sync** upserts on `hubspot_contact_id`. Same issue — won't match contacts from other sources.

3. **Harvest sync** deduplicates by `email + company_id`. If the same person exists under a different `company_id` (or null), it creates a duplicate.

4. **Freshdesk sync** — identical to Harvest: `email + company_id`.

5. **Apollo (frontend)** deduplicates by `email` globally (the best approach currently). But uses `maybeSingle()` — if duplicates already exist, this could error.

### Unique Identifiers Available

| Column | Source | Notes |
|--------|--------|-------|
| `email` | All 5 sources | Best universal key. Most reliable. Not always present (some contacts are phone-only). |
| `hubspot_contact_id` | HubSpot only | Unique within HubSpot. Not set by Harvest/Freshdesk/Apollo. |
| `apollo_person_id` | Apollo only | Set during enrichment. Not set by HubSpot/Harvest/Freshdesk. |
| `phone` | Some sources | Too unreliable for matching (formatting varies). |

### Actual Duplicate Count

Cannot query production directly from this environment. However, the duplication scenario is clear from code analysis:
- A contact with email `john@acme.com` created by Harvest (no `hubspot_contact_id`)
- Same email synced later by HubSpot deals sync → creates a second row because it matches on `hubspot_contact_id`, not email
- Result: two rows with the same email, different IDs, potentially different data

### Data Conflicts When Same Contact Exists from Two Sources

| Field | HubSpot | Harvest | Freshdesk | Apollo |
|-------|---------|---------|-----------|--------|
| `first_name` | From CRM | From Harvest | Parsed from `name` | From Apollo |
| `last_name` | From CRM | From Harvest | Parsed from `name` (split) | From Apollo |
| `email` | yes | yes | yes | yes |
| `phone` | `phone` | `phone_office` or `phone_mobile` | `phone` or `mobile` | `phone` |
| `title` | `jobtitle` | `title` | `job_title` | `title` |
| `lead_status` | HubSpot only | — | — | — |
| `lifecycle_stage` | HubSpot only | — | — | — |
| `hubspot_owner_id` | HubSpot only | — | — | — |
| `enrichment_data` | HubSpot metadata | — | — | Full Apollo person data |
| `linkedin_url` | — | — | — | Apollo only |
| `seniority` | — | — | — | Apollo only |
| `department` | — | — | — | Apollo only |

**Conflict resolution priority:** Apollo > HubSpot > Harvest > Freshdesk (Apollo has the richest data, HubSpot is the CRM of record).

### Company Resolution Pattern (for reference)

`_shared/company-resolution.ts` uses a **waterfall match strategy:**
1. Match by external ID (`hubspot_company_id`)
2. Match by domain
3. Create new

With a name resolution chain: HubSpot → existing → Ocean.io → Harvest → Freshdesk → domain-derived.

This pattern directly translates to contacts: match by external ID → match by email → create new.

## Recommendation

Create a **`_shared/contact-resolution.ts`** module following the same pattern as `company-resolution.ts`. All 5 contact write paths should use this single module instead of their own dedup logic.

### Resolution Algorithm
1. **Match by `hubspot_contact_id`** (if provided) → update and return
2. **Match by `apollo_person_id`** (if provided) → update and return
3. **Match by `email`** (global, not scoped to company) → merge and return
4. **Create new** with best available data

### Merge Strategy (when matching by email)
- **Never overwrite with null/empty** — only upgrade fields
- **Priority chain for names:** Apollo > HubSpot > existing > Harvest > Freshdesk
- **Always merge external IDs:** if existing has `hubspot_contact_id` but not `apollo_person_id`, add the Apollo ID
- **Enrichment data:** deep merge, don't replace
- **company_id:** keep existing unless null, then take incoming

### Database Cleanup
Add a UNIQUE constraint or unique index on `email` (where email IS NOT NULL) after deduplicating existing records.

## Implementation Steps

### Phase 1: Create contact-resolution module
- [ ] **Step 1: Create `supabase/functions/_shared/contact-resolution.ts`**
  ```typescript
  interface ContactCandidate {
    user_id: string;
    company_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
    hubspot_contact_id?: string | null;
    apollo_person_id?: string | null;
    linkedin_url?: string | null;
    photo_url?: string | null;
    seniority?: string | null;
    department?: string | null;
    lead_status?: string | null;
    lifecycle_stage?: string | null;
    hubspot_owner_id?: string | null;
    enrichment_data?: Record<string, any>;
  }

  interface ResolvedContact {
    contactId: string;
    created: boolean;
    matchType: "hubspot_id" | "apollo_id" | "email" | "created";
    fieldsUpdated: number;
  }

  export async function resolveContact(
    supabase: any,
    candidate: ContactCandidate
  ): Promise<ResolvedContact>;
  ```

- [ ] **Step 2: Implement merge logic** — `mergeContactFields()` function that compares incoming vs. existing, only upgrades non-null fields, returns update object and count of fields changed

### Phase 2: Migrate all sync functions
- [ ] **Step 3: Update `hubspot-deals-sync/index.ts`** — Replace lines 262-311 (manual loop with `hubspot_contact_id` match) with `resolveContact()` calls
- [ ] **Step 4: Update `hubspot-contacts-sync/index.ts`** — Replace batch upsert on `hubspot_contact_id` with per-contact `resolveContact()` calls (loses batch efficiency but gains dedup correctness; can batch-optimize later)
- [ ] **Step 5: Update `harvest-sync/index.ts`** — Replace `email + company_id` match with `resolveContact()` 
- [ ] **Step 6: Update `freshdesk-sync/index.ts`** — Replace `email + company_id` match with `resolveContact()`
- [ ] **Step 7: Update `src/lib/agencyBrain.ts`** — Replace `upsertContactFromApollo()` with frontend-compatible version or keep as-is (it already matches globally by email, which is correct; just needs to also check `apollo_person_id`)

### Phase 3: Database cleanup
- [ ] **Step 8: Write dedup migration script** — SQL or edge function that:
  1. Finds all contacts with duplicate emails
  2. For each group: pick the "richest" record (most non-null fields, prefer one with `hubspot_contact_id`)
  3. Merge external IDs and enrichment data from duplicates into the winner
  4. Update any `deals.contact_id` FKs pointing to losers → winner
  5. Delete loser records
- [ ] **Step 9: Add unique index** — `CREATE UNIQUE INDEX idx_contacts_email_unique ON contacts(email) WHERE email IS NOT NULL` (partial unique index — allows multiple null emails)
- [ ] **Step 10: Test** — Run each sync function, verify no duplicates created, verify dedup script correctly merged existing dupes

## Affected Files

- `supabase/functions/_shared/contact-resolution.ts` — **NEW** shared module
- `supabase/functions/hubspot-deals-sync/index.ts` — **EDIT** replace contact sync block (lines 262-311)
- `supabase/functions/hubspot-contacts-sync/index.ts` — **EDIT** replace upsert block (lines 168-212)
- `supabase/functions/harvest-sync/index.ts` — **EDIT** replace contact sync function (lines 276-321)
- `supabase/functions/freshdesk-sync/index.ts` — **EDIT** replace contact sync function (lines 190-235)
- `src/lib/agencyBrain.ts` — **MINOR EDIT** add `apollo_person_id` check to `upsertContactFromApollo` (lines 83-148)
- `supabase/migrations/YYYYMMDDHHMMSS_contact_dedup.sql` — **NEW** dedup script + partial unique index

## Dependencies

- Should be done **after** Task #12 (company-resolution strengthening) since the patterns should be consistent
- Dedup migration must run **before** the unique index is added (otherwise existing duplicates will block the index creation)
- All sync functions should be tested after changes to verify no regressions

## Risks

- **Medium risk — FK cascade on dedup.** When merging duplicate contacts, `deals.contact_id` may reference the "loser" contact. The dedup script must reassign these FKs before deleting.
- **Loss of batch upsert efficiency.** `hubspot-contacts-sync` currently batch-upserts 100 contacts at a time. Moving to per-contact `resolveContact()` will be slower (100 individual queries vs. 1 batch). Mitigation: can implement batch pre-check (select all by email in one query, then decide per-contact).
- **Email-less contacts.** Some contacts have no email (phone-only). These can't be deduplicated by email and will remain as separate records. The partial unique index (`WHERE email IS NOT NULL`) handles this correctly.
- **Concurrent sync race condition.** If two sync functions run simultaneously and both try to create the same contact, one will fail on the unique index. The resolution module should catch this error and retry as an update (UPSERT semantics).
- **Name parsing quality.** Freshdesk splits `name` on first space — "Mary Jane Watson" becomes first_name="Mary", last_name="Jane Watson". HubSpot has separate fields. The merge logic should prefer HubSpot/Apollo names over Freshdesk-parsed names.
