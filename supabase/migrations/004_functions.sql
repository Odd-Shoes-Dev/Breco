-- Database functions for Breco Safaris Financial & Operations System
-- Run this after 003_seed_data.sql

-- =====================================================
-- DROP EXISTING FUNCTIONS (to allow return type changes)
-- =====================================================
DROP FUNCTION IF EXISTS generate_invoice_number();
DROP FUNCTION IF EXISTS generate_bill_number();
DROP FUNCTION IF EXISTS generate_journal_entry_number();
DROP FUNCTION IF EXISTS update_overdue_invoices();
DROP FUNCTION IF EXISTS update_overdue_bills();
DROP FUNCTION IF EXISTS calculate_customer_balance(UUID);
DROP FUNCTION IF EXISTS calculate_vendor_balance(UUID);
DROP FUNCTION IF EXISTS trigger_update_customer_balance();
DROP FUNCTION IF EXISTS trigger_update_vendor_balance();
DROP FUNCTION IF EXISTS validate_journal_entry_balance();
DROP FUNCTION IF EXISTS log_activity(UUID, TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS get_dashboard_stats();

-- =====================================================
-- FUNCTION DEFINITIONS
-- =====================================================

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  new_invoice_number TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the highest invoice number for this year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(invoice_number FROM 'INV-' || current_year || '-(\d+)') AS INT
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || current_year || '-%';
  
  new_invoice_number := 'INV-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
  
  RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate bill numbers
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  new_bill_number TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(bill_number FROM 'BILL-' || current_year || '-(\d+)') AS INT
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM bills
  WHERE bill_number LIKE 'BILL-' || current_year || '-%';
  
  new_bill_number := 'BILL-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
  
  RETURN new_bill_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate journal entry numbers
CREATE OR REPLACE FUNCTION generate_journal_entry_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  new_entry_number TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(entry_number FROM 'JE-' || current_year || '-(\d+)') AS INT
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM journal_entries
  WHERE entry_number LIKE 'JE-' || current_year || '-%';
  
  new_entry_number := 'JE-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
  
  RETURN new_entry_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice status based on due date
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices
  SET status = 'overdue'
  WHERE status IN ('sent', 'partial')
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to update bill status based on due date
CREATE OR REPLACE FUNCTION update_overdue_bills()
RETURNS void AS $$
BEGIN
  UPDATE bills
  SET status = 'overdue'
  WHERE status IN ('pending', 'partial')
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate customer balance
CREATE OR REPLACE FUNCTION calculate_customer_balance(p_customer_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  total_balance DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(total - amount_paid), 0)
  INTO total_balance
  FROM invoices
  WHERE customer_id = p_customer_id
    AND status NOT IN ('draft', 'void', 'paid');
  
  RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate vendor balance
CREATE OR REPLACE FUNCTION calculate_vendor_balance(p_vendor_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  total_balance DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(total - amount_paid), 0)
  INTO total_balance
  FROM bills
  WHERE vendor_id = p_vendor_id
    AND status NOT IN ('draft', 'void', 'paid');
  
  RETURN total_balance;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer balance after invoice changes
CREATE OR REPLACE FUNCTION trigger_update_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE customers
    SET current_balance = calculate_customer_balance(OLD.customer_id)
    WHERE id = OLD.customer_id;
    RETURN OLD;
  ELSE
    UPDATE customers
    SET current_balance = calculate_customer_balance(NEW.customer_id)
    WHERE id = NEW.customer_id;
    
    -- If customer changed, update old customer too
    IF TG_OP = 'UPDATE' AND OLD.customer_id != NEW.customer_id THEN
      UPDATE customers
      SET current_balance = calculate_customer_balance(OLD.customer_id)
      WHERE id = OLD.customer_id;
    END IF;
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_balance_trigger ON invoices;
CREATE TRIGGER update_customer_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_customer_balance();

-- Trigger to update vendor balance after bill changes
CREATE OR REPLACE FUNCTION trigger_update_vendor_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE vendors
    SET current_balance = calculate_vendor_balance(OLD.vendor_id)
    WHERE id = OLD.vendor_id;
    RETURN OLD;
  ELSE
    UPDATE vendors
    SET current_balance = calculate_vendor_balance(NEW.vendor_id)
    WHERE id = NEW.vendor_id;
    
    IF TG_OP = 'UPDATE' AND OLD.vendor_id != NEW.vendor_id THEN
      UPDATE vendors
      SET current_balance = calculate_vendor_balance(OLD.vendor_id)
      WHERE id = OLD.vendor_id;
    END IF;
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vendor_balance_trigger ON bills;
CREATE TRIGGER update_vendor_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_vendor_balance();

-- Function to validate journal entry balance
CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debits DECIMAL(15,2);
  total_credits DECIMAL(15,2);
BEGIN
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM journal_lines
  WHERE journal_entry_id = NEW.journal_entry_id;
  
  IF ABS(total_debits - total_credits) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits: %, Credits: %', total_debits, total_credits;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate balance on journal entry line changes
DROP TRIGGER IF EXISTS validate_journal_balance_trigger ON journal_lines;
CREATE TRIGGER validate_journal_balance_trigger
  AFTER INSERT OR UPDATE ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_entry_balance();

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_details)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  revenue_this_month DECIMAL(15,2);
  expenses_this_month DECIMAL(15,2);
  receivables DECIMAL(15,2);
  payables DECIMAL(15,2);
  overdue_invoices INT;
  overdue_bills INT;
BEGIN
  -- Revenue this month (from invoices)
  SELECT COALESCE(SUM(total), 0)
  INTO revenue_this_month
  FROM invoices
  WHERE status IN ('sent', 'partial', 'paid')
    AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE);
  
  -- Expenses this month
  SELECT COALESCE(SUM(amount), 0)
  INTO expenses_this_month
  FROM expenses
  WHERE status = 'paid'
    AND expense_date >= DATE_TRUNC('month', CURRENT_DATE);
  
  -- Add bill expenses
  SELECT expenses_this_month + COALESCE(SUM(total), 0)
  INTO expenses_this_month
  FROM bills
  WHERE status = 'paid'
    AND bill_date >= DATE_TRUNC('month', CURRENT_DATE);
  
  -- Total receivables
  SELECT COALESCE(SUM(total - amount_paid), 0)
  INTO receivables
  FROM invoices
  WHERE status IN ('sent', 'partial', 'overdue');
  
  -- Total payables
  SELECT COALESCE(SUM(total - amount_paid), 0)
  INTO payables
  FROM bills
  WHERE status IN ('pending', 'partial', 'overdue');
  
  -- Overdue counts
  SELECT COUNT(*)
  INTO overdue_invoices
  FROM invoices
  WHERE status = 'overdue' OR (status IN ('sent', 'partial') AND due_date < CURRENT_DATE);
  
  SELECT COUNT(*)
  INTO overdue_bills
  FROM bills
  WHERE status = 'overdue' OR (status IN ('pending', 'partial') AND due_date < CURRENT_DATE);
  
  result := jsonb_build_object(
    'revenue_this_month', revenue_this_month,
    'expenses_this_month', expenses_this_month,
    'net_income_this_month', revenue_this_month - expenses_this_month,
    'total_receivables', receivables,
    'total_payables', payables,
    'overdue_invoices', overdue_invoices,
    'overdue_bills', overdue_bills
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
