-- Add indexes on external ID columns for company resolution lookups
-- These columns already exist (added via dashboard) but lack indexes

CREATE INDEX IF NOT EXISTS idx_companies_harvest_client_id
  ON companies (harvest_client_id)
  WHERE harvest_client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_freshdesk_company_id
  ON companies (freshdesk_company_id)
  WHERE freshdesk_company_id IS NOT NULL;
