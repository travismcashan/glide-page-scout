-- Contact deduplication: merge duplicates by email, then add partial unique index.
-- Must run dedup BEFORE creating the unique index.

-- Step 1: For each email with duplicates, pick the "winner" (most recently updated,
-- preferring rows with hubspot_contact_id or apollo_person_id set).
-- Merge external IDs from losers into winners, reassign FK references, then delete losers.

-- 1a: Create temp table of winners (one per email)
CREATE TEMP TABLE _contact_winners AS
WITH ranked AS (
  SELECT
    id,
    email,
    hubspot_contact_id,
    apollo_person_id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(email))
      ORDER BY
        -- Prefer contacts with external IDs
        CASE WHEN hubspot_contact_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN apollo_person_id IS NOT NULL AND apollo_person_id != 'not_found' THEN 1 ELSE 0 END DESC,
        -- Then most recently updated
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
    ) AS rn
  FROM contacts
  WHERE email IS NOT NULL AND TRIM(email) != ''
)
SELECT id, LOWER(TRIM(email)) AS norm_email
FROM ranked
WHERE rn = 1;

-- 1b: Identify losers (all non-winner rows for emails that have duplicates)
CREATE TEMP TABLE _contact_losers AS
SELECT c.id AS loser_id, w.id AS winner_id
FROM contacts c
JOIN _contact_winners w ON LOWER(TRIM(c.email)) = w.norm_email
WHERE c.id != w.id
  AND c.email IS NOT NULL AND TRIM(c.email) != '';

-- Step 2: Merge external IDs from losers into winners (fill empty slots only)
UPDATE contacts AS winner
SET
  hubspot_contact_id = COALESCE(winner.hubspot_contact_id, loser.hubspot_contact_id),
  apollo_person_id = CASE
    WHEN winner.apollo_person_id IS NOT NULL AND winner.apollo_person_id != 'not_found'
    THEN winner.apollo_person_id
    ELSE COALESCE(loser.apollo_person_id, winner.apollo_person_id)
  END,
  company_id = COALESCE(winner.company_id, loser.company_id),
  first_name = COALESCE(winner.first_name, loser.first_name),
  last_name = COALESCE(winner.last_name, loser.last_name),
  phone = COALESCE(winner.phone, loser.phone),
  title = COALESCE(winner.title, loser.title),
  department = COALESCE(winner.department, loser.department),
  linkedin_url = COALESCE(winner.linkedin_url, loser.linkedin_url),
  photo_url = COALESCE(winner.photo_url, loser.photo_url),
  seniority = COALESCE(winner.seniority, loser.seniority),
  enrichment_data = winner.enrichment_data || COALESCE(loser.enrichment_data, '{}'::jsonb),
  updated_at = now()
FROM (
  -- For each winner, pick the "richest" loser (most non-null fields) to merge from
  SELECT DISTINCT ON (cl.winner_id)
    cl.winner_id,
    c.hubspot_contact_id,
    c.apollo_person_id,
    c.company_id,
    c.first_name,
    c.last_name,
    c.phone,
    c.title,
    c.department,
    c.linkedin_url,
    c.photo_url,
    c.seniority,
    c.enrichment_data
  FROM _contact_losers cl
  JOIN contacts c ON c.id = cl.loser_id
  ORDER BY cl.winner_id, c.updated_at DESC NULLS LAST
) AS loser
WHERE winner.id = loser.winner_id;

-- Step 3: Reassign FK references from losers to winners
UPDATE deals
SET contact_id = cl.winner_id
FROM _contact_losers cl
WHERE deals.contact_id = cl.loser_id;

-- Step 4: Delete loser records
DELETE FROM contacts
WHERE id IN (SELECT loser_id FROM _contact_losers);

-- Step 5: Normalize emails on remaining records (lowercase + trim)
UPDATE contacts
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL AND email != LOWER(TRIM(email));

-- Step 6: Add partial unique index on email (allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_unique
  ON contacts (email)
  WHERE email IS NOT NULL;

-- Cleanup temp tables
DROP TABLE IF EXISTS _contact_losers;
DROP TABLE IF EXISTS _contact_winners;
