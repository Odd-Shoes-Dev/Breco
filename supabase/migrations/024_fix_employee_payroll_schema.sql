-- =====================================================
-- FIX EMPLOYEE & PAYROLL SCHEMA ISSUES
-- Migration: 024_fix_employee_payroll_schema.sql
-- Date: 2026-01-04
-- =====================================================

-- =====================================================
-- STEP 1: ADD MISSING EMPLOYMENT_STATUS COLUMN
-- =====================================================

-- Add employment_status column to employees table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status') THEN
    CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'terminated', 'probation');
  END IF;
END $$;

-- Add the column if it doesn't exist
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS employment_status employment_status DEFAULT 'active';

-- Update existing records based on is_active flag
UPDATE employees 
SET employment_status = CASE 
  WHEN termination_date IS NOT NULL THEN 'terminated'::employment_status
  WHEN is_active = true THEN 'active'::employment_status
  ELSE 'active'::employment_status
END
WHERE employment_status IS NULL;

-- =====================================================
-- STEP 2: FIX PAY_FREQUENCY ENUM
-- =====================================================

-- Add bi_weekly value to pay_frequency enum
ALTER TYPE pay_frequency ADD VALUE IF NOT EXISTS 'bi_weekly';

-- =====================================================
-- STEP 3: FIX PAYROLL_STATUS ENUM
-- =====================================================

-- Add processing value to payroll_status enum
ALTER TYPE payroll_status ADD VALUE IF NOT EXISTS 'processing';

-- =====================================================
-- STEP 4: ADD EMPLOYEE_COUNT TO PAYROLL_PERIODS
-- =====================================================

-- Add employee_count column to payroll_periods
ALTER TABLE payroll_periods
ADD COLUMN IF NOT EXISTS employee_count INT DEFAULT 0;

-- Update employee_count for existing payroll periods
UPDATE payroll_periods pp
SET employee_count = (
  SELECT COUNT(*)
  FROM payslips p
  WHERE p.payroll_period_id = pp.id
);

-- Create trigger to automatically update employee_count when payslips change
CREATE OR REPLACE FUNCTION update_payroll_employee_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE payroll_periods
    SET employee_count = employee_count + 1
    WHERE id = NEW.payroll_period_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE payroll_periods
    SET employee_count = GREATEST(0, employee_count - 1)
    WHERE id = OLD.payroll_period_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payroll_employee_count ON payslips;
CREATE TRIGGER trigger_update_payroll_employee_count
AFTER INSERT OR DELETE ON payslips
FOR EACH ROW
EXECUTE FUNCTION update_payroll_employee_count();

-- =====================================================
-- STEP 5: ADD MISSING PAYROLL TOTALS COLUMNS
-- =====================================================

-- Add missing total columns if they don't exist
ALTER TABLE payroll_periods
ADD COLUMN IF NOT EXISTS total_paye DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_nssf DECIMAL(15,2) DEFAULT 0;

-- =====================================================
-- STEP 6: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_employees_employment_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_payslips_payroll_period ON payslips(payroll_period_id);

-- =====================================================
-- STEP 7: ADD JOURNAL ENTRY TRACKING TO PAYROLL
-- =====================================================

-- Add journal_entry_id to track GL posting for payroll
ALTER TABLE payroll_periods
ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id);

ALTER TABLE payslips
ADD COLUMN IF NOT EXISTS payment_journal_entry_id UUID REFERENCES journal_entries(id);

-- =====================================================
-- STEP 8: CREATE FUNCTION TO CALCULATE PAYROLL TOTALS
-- =====================================================

CREATE OR REPLACE FUNCTION update_payroll_period_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE payroll_periods pp
  SET 
    total_gross = COALESCE((SELECT SUM(gross_salary) FROM payslips WHERE payroll_period_id = pp.id), 0),
    total_deductions = COALESCE((SELECT SUM(total_deductions) FROM payslips WHERE payroll_period_id = pp.id), 0),
    total_net = COALESCE((SELECT SUM(net_salary) FROM payslips WHERE payroll_period_id = pp.id), 0),
    total_paye = COALESCE((SELECT SUM(paye) FROM payslips WHERE payroll_period_id = pp.id), 0),
    total_nssf = COALESCE((SELECT SUM(nssf_employee + nssf_employer) FROM payslips WHERE payroll_period_id = pp.id), 0),
    updated_at = NOW()
  WHERE pp.id = COALESCE(NEW.payroll_period_id, OLD.payroll_period_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payroll_totals ON payslips;
CREATE TRIGGER trigger_update_payroll_totals
AFTER INSERT OR UPDATE OR DELETE ON payslips
FOR EACH ROW
EXECUTE FUNCTION update_payroll_period_totals();

-- =====================================================
-- STEP 9: ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN employees.employment_status IS 'Employee work status: active, on_leave, terminated, or probation';
COMMENT ON COLUMN payroll_periods.employee_count IS 'Number of employees in this payroll period (auto-updated)';
COMMENT ON COLUMN payroll_periods.journal_entry_id IS 'Journal entry created when payroll is posted to GL';
COMMENT ON COLUMN payslips.payment_journal_entry_id IS 'Journal entry for individual payment if tracked separately';
