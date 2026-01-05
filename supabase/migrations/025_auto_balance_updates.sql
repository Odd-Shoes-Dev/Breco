-- Add functions to automatically update customer and vendor balances

-- Function to update vendor balance
CREATE OR REPLACE FUNCTION update_vendor_balance(p_vendor_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE vendors
  SET current_balance = COALESCE(current_balance, 0) + p_amount
  WHERE id = p_vendor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update customer balance
CREATE OR REPLACE FUNCTION update_customer_balance(p_customer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET current_balance = COALESCE(current_balance, 0) + p_amount
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update bank account balance
CREATE OR REPLACE FUNCTION update_bank_account_balance(p_account_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE bank_accounts
  SET current_balance = COALESCE(current_balance, 0) + p_amount
  WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for when bills are created or updated
CREATE OR REPLACE FUNCTION update_vendor_balance_on_bill()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increase vendor balance (what we owe) when bill is created
    PERFORM update_vendor_balance(NEW.vendor_id, NEW.total);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Adjust for total changes
    IF OLD.total != NEW.total THEN
      PERFORM update_vendor_balance(NEW.vendor_id, NEW.total - OLD.total);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for when invoices are created or updated
CREATE OR REPLACE FUNCTION update_customer_balance_on_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.document_type = 'invoice' THEN
    -- Increase customer balance (what they owe us) when invoice is created
    PERFORM update_customer_balance(NEW.customer_id, NEW.total);
  ELSIF TG_OP = 'UPDATE' AND NEW.document_type = 'invoice' THEN
    -- Adjust for total changes
    IF OLD.total != NEW.total THEN
      PERFORM update_customer_balance(NEW.customer_id, NEW.total - OLD.total);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for when payments are received
CREATE OR REPLACE FUNCTION update_customer_balance_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice invoices%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the invoice to find customer
    SELECT * INTO v_invoice FROM invoices WHERE id = NEW.invoice_id;
    
    IF v_invoice.id IS NOT NULL THEN
      -- Decrease customer balance (they paid us)
      PERFORM update_customer_balance(v_invoice.customer_id, -NEW.amount);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for when bill payments are made
CREATE OR REPLACE FUNCTION update_vendor_balance_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_bill bills%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the bill to find vendor
    SELECT * INTO v_bill FROM bills WHERE id = NEW.bill_id;
    
    IF v_bill.id IS NOT NULL THEN
      -- Decrease vendor balance (we paid them)
      PERFORM update_vendor_balance(v_bill.vendor_id, -NEW.amount);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for bills
DROP TRIGGER IF EXISTS trg_bill_vendor_balance ON bills;
CREATE TRIGGER trg_bill_vendor_balance
  AFTER INSERT OR UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_balance_on_bill();

-- Create triggers for invoices
DROP TRIGGER IF EXISTS trg_invoice_customer_balance ON invoices;
CREATE TRIGGER trg_invoice_customer_balance
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_balance_on_invoice();

-- Create triggers for payments received
DROP TRIGGER IF EXISTS trg_payment_customer_balance ON payments_received;
CREATE TRIGGER trg_payment_customer_balance
  AFTER INSERT ON payments_received
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_balance_on_payment();

-- Create triggers for bill payments
DROP TRIGGER IF EXISTS trg_bill_payment_vendor_balance ON bill_payments;
CREATE TRIGGER trg_bill_payment_vendor_balance
  AFTER INSERT ON bill_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_balance_on_payment();
