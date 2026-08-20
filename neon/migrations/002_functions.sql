-- =====================================================
-- BRECO SAFARIS LTD - DATABASE FUNCTIONS & TRIGGERS
-- Neon Migration 002
-- Run after 001_initial_schema.sql
-- =====================================================

-- =====================================================
-- SEQUENCES for auto-numbering
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS customer_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS vendor_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS proforma_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS bill_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS journal_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payment_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS booking_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS employee_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payslip_number_seq START 1;

-- =====================================================
-- DOCUMENT NUMBER GENERATORS
-- All return formatted strings with year prefix
-- =====================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-' || current_year || '-(\d+)') AS INT)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || current_year || '-%';
  RETURN 'INV-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_proforma_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(proforma_number FROM 'PRO-' || current_year || '-(\d+)') AS INT)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE proforma_number LIKE 'PRO-' || current_year || '-%';
  RETURN 'PRO-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM 'QUO-' || current_year || '-(\d+)') AS INT)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE quotation_number LIKE 'QUO-' || current_year || '-%';
  RETURN 'QUO-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 'REC-' || current_year || '-(\d+)') AS INT)), 0) + 1
  INTO next_number
  FROM invoices
  WHERE receipt_number LIKE 'REC-' || current_year || '-%';
  RETURN 'REC-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(bill_number FROM 'BILL-' || current_year || '-(\d+)') AS INT)), 0) + 1
  INTO next_number
  FROM bills
  WHERE bill_number LIKE 'BILL-' || current_year || '-%';
  RETURN 'BILL-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_journal_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 'JE-' || current_year || '-(\d+)') AS INT)), 0) + 1
  INTO next_number
  FROM journal_entries
  WHERE entry_number LIKE 'JE-' || current_year || '-%';
  RETURN 'JE-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT AS $$
  SELECT 'PAY-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('payment_number_seq')::TEXT, 5, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION generate_customer_number()
RETURNS VARCHAR AS $$
  SELECT 'CUST-' || LPAD(nextval('customer_number_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION generate_vendor_number()
RETURNS VARCHAR AS $$
  SELECT 'VEND-' || LPAD(nextval('vendor_number_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS VARCHAR AS $$
  SELECT 'BK-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('booking_number_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS VARCHAR AS $$
  SELECT 'EMP-' || LPAD(nextval('employee_number_seq')::TEXT, 4, '0');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION generate_payslip_number()
RETURNS VARCHAR AS $$
  SELECT 'PS-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('payslip_number_seq')::TEXT, 5, '0');
$$ LANGUAGE sql;

-- =====================================================
-- CURRENCY FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency CHAR(3),
  p_to_currency CHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(18,8) AS $$
DECLARE
  v_rate DECIMAL(18,8);
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN 1.00000000;
  END IF;
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;
  RETURN v_rate;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION convert_currency(
  p_amount DECIMAL,
  p_from_currency CHAR(3),
  p_to_currency CHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(18,2) AS $$
DECLARE
  v_rate DECIMAL(18,8);
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN p_amount;
  END IF;
  v_rate := get_exchange_rate(p_from_currency, p_to_currency, p_date);
  IF v_rate IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN ROUND(p_amount * v_rate, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- BALANCE FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_customer_balance(p_customer_id UUID)
RETURNS DECIMAL(15,2) AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(total - amount_paid)
    FROM invoices
    WHERE customer_id = p_customer_id
      AND status NOT IN ('draft', 'void', 'paid')
  ), 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_vendor_balance(p_vendor_id UUID)
RETURNS DECIMAL(15,2) AS $$
BEGIN
  RETURN COALESCE((
    SELECT SUM(total - amount_paid)
    FROM bills
    WHERE vendor_id = p_vendor_id
      AND status NOT IN ('draft', 'void', 'paid')
  ), 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_customer_balance(p_customer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET current_balance = COALESCE(current_balance, 0) + p_amount
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_vendor_balance(p_vendor_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE vendors
  SET current_balance = COALESCE(current_balance, 0) + p_amount
  WHERE id = p_vendor_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_bank_account_balance(p_account_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE bank_accounts
  SET current_balance = COALESCE(current_balance, 0) + p_amount
  WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS: BALANCE AUTO-UPDATE
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_update_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE customers SET current_balance = calculate_customer_balance(OLD.customer_id) WHERE id = OLD.customer_id;
    RETURN OLD;
  ELSE
    UPDATE customers SET current_balance = calculate_customer_balance(NEW.customer_id) WHERE id = NEW.customer_id;
    IF TG_OP = 'UPDATE' AND OLD.customer_id != NEW.customer_id THEN
      UPDATE customers SET current_balance = calculate_customer_balance(OLD.customer_id) WHERE id = OLD.customer_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_balance_trigger ON invoices;
CREATE TRIGGER update_customer_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_update_customer_balance();

CREATE OR REPLACE FUNCTION trigger_update_vendor_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE vendors SET current_balance = calculate_vendor_balance(OLD.vendor_id) WHERE id = OLD.vendor_id;
    RETURN OLD;
  ELSE
    UPDATE vendors SET current_balance = calculate_vendor_balance(NEW.vendor_id) WHERE id = NEW.vendor_id;
    IF TG_OP = 'UPDATE' AND OLD.vendor_id != NEW.vendor_id THEN
      UPDATE vendors SET current_balance = calculate_vendor_balance(OLD.vendor_id) WHERE id = OLD.vendor_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vendor_balance_trigger ON bills;
CREATE TRIGGER update_vendor_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON bills
  FOR EACH ROW EXECUTE FUNCTION trigger_update_vendor_balance();

-- =====================================================
-- TRIGGERS: JOURNAL ENTRY BALANCE VALIDATION
-- =====================================================

CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debits DECIMAL(15,2);
  total_credits DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM journal_lines
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF ABS(total_debits - total_credits) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits: %, Credits: %', total_debits, total_credits;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_journal_balance_trigger ON journal_lines;
CREATE TRIGGER validate_journal_balance_trigger
  AFTER INSERT OR UPDATE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION validate_journal_entry_balance();

-- =====================================================
-- TRIGGERS: TOUR AVAILABILITY
-- =====================================================

CREATE OR REPLACE FUNCTION update_tour_availability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE tour_packages
    SET available_slots = available_slots - COALESCE(NEW.number_of_people, 1),
        slots_reserved = slots_reserved + COALESCE(NEW.number_of_people, 1)
    WHERE id = NEW.tour_package_id;
    NEW.booking_confirmed_at = NOW();
  END IF;

  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE tour_packages
    SET available_slots = available_slots + COALESCE(NEW.number_of_people, 1),
        slots_reserved = slots_reserved - COALESCE(NEW.number_of_people, 1)
    WHERE id = NEW.tour_package_id;
    NEW.cancellation_date = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tour_availability_trigger ON bookings;
CREATE TRIGGER update_tour_availability_trigger
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_tour_availability();

-- =====================================================
-- TRIGGERS: updated_at columns
-- =====================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','company_settings','accounts','fiscal_periods','journal_entries',
    'customers','vendors','products','invoices','bills','expenses',
    'purchase_orders','goods_receipts','fixed_assets','bank_accounts',
    'bank_reconciliations','bank_transfers','destinations','tour_packages',
    'hotels','bookings','vehicles','car_rentals','employees','payroll_periods',
    'inventory_locations','stock_takes','inventory_transfers','projects'
  ] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', t, t);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UTILITY: STATUS AUTO-UPDATE
-- =====================================================

CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices SET status = 'overdue'
  WHERE status IN ('sent', 'partial') AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_overdue_bills()
RETURNS void AS $$
BEGIN
  UPDATE bills SET status = 'overdue'
  WHERE status IN ('pending_approval', 'approved', 'partial') AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TOUR AVAILABILITY CHECK
-- =====================================================

CREATE OR REPLACE FUNCTION check_tour_availability(
  p_tour_package_id UUID,
  p_num_people INT DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_slots INT;
BEGIN
  SELECT available_slots INTO v_slots FROM tour_packages WHERE id = p_tour_package_id;
  RETURN COALESCE(v_slots, 0) >= p_num_people;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- ACTIVITY LOG HELPER
-- =====================================================

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

-- =====================================================
-- STOCK MANAGEMENT
-- =====================================================

CREATE OR REPLACE FUNCTION update_product_stock(
  p_product_id UUID,
  p_quantity DECIMAL,
  p_movement_type stock_movement_type,
  p_unit_cost DECIMAL DEFAULT 0,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO inventory_movements (
    product_id, movement_type, quantity, unit_cost,
    total_cost, reference_type, reference_id, created_by
  ) VALUES (
    p_product_id, p_movement_type, p_quantity, p_unit_cost,
    p_quantity * p_unit_cost, p_reference_type, p_reference_id, p_created_by
  );
END;
$$ LANGUAGE plpgsql;
