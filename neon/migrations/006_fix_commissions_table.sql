-- =====================================================
-- BRECO SAFARIS LTD - Fix Commissions Table
-- Neon Migration 006
-- Add missing columns to commissions table that routes expect
-- =====================================================

-- Add missing columns
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS base_amount DECIMAL(15,2);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(15,2);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(12,6) DEFAULT 1.000000;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS payment_date DATE;

-- Copy amount to commission_amount for any existing rows, then drop amount
UPDATE commissions SET commission_amount = amount WHERE commission_amount IS NULL AND amount IS NOT NULL;

-- Make employee_id nullable (vendor commissions may not have an employee)
ALTER TABLE commissions ALTER COLUMN employee_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_invoice ON commissions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_commissions_vendor ON commissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_commissions_date ON commissions(commission_date);
