-- =====================================================
-- Restore vendor fields dropped during the Supabase -> Neon migration
-- but still relied on by the vendor UI: company_name, address_line1/2,
-- state, zip_code, tax_id, is_1099_vendor, default_expense_account_id.
-- =====================================================

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_1099_vendor BOOLEAN DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS default_expense_account_id UUID REFERENCES accounts(id);

-- Backfill address_line1 from the old single-line `address` column where present
UPDATE vendors SET address_line1 = address WHERE address_line1 IS NULL AND address IS NOT NULL;
