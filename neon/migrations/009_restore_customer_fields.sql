-- =====================================================
-- Restore customer fields dropped during the Supabase -> Neon migration
-- but still relied on by the customer UI: company_name, address_line1/2,
-- tax_id, tax_exempt, email_2/3/4.
-- =====================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_2 VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_3 VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_4 VARCHAR(255);

-- Backfill address_line1 from the old single-line `address` column where present
UPDATE customers SET address_line1 = address WHERE address_line1 IS NULL AND address IS NOT NULL;
