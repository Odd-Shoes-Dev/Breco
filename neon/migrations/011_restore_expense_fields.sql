-- =====================================================
-- Restore expense fields dropped during the Supabase -> Neon migration
-- but still relied on by the expense detail/edit UI and its API route:
-- payee, reference_number, category, department, project_id, customer_id,
-- is_reimbursable, is_billable, total, payment_account_id.
-- The GL expense account stays on the existing `account_id` column.
-- =====================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payee VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS total DECIMAL(15,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_account_id UUID REFERENCES accounts(id);

-- Backfill total from amount + tax for existing rows
UPDATE expenses SET total = COALESCE(amount, 0) + COALESCE(tax_amount, 0) WHERE total IS NULL;
