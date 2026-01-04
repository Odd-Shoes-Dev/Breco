-- Bank Reconciliation System
-- Migration: 028_bank_reconciliation_system.sql

-- Create bank reconciliations table
CREATE TABLE bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  statement_starting_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  statement_ending_balance DECIMAL(15,2) NOT NULL,
  statement_date DATE NOT NULL,
  
  -- Calculated fields
  cleared_balance DECIMAL(15,2) DEFAULT 0,
  uncleared_deposits DECIMAL(15,2) DEFAULT 0,
  uncleared_withdrawals DECIMAL(15,2) DEFAULT 0,
  adjusted_bank_balance DECIMAL(15,2) DEFAULT 0,
  book_balance DECIMAL(15,2) DEFAULT 0,
  difference DECIMAL(15,2) DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  
  -- Audit
  completed_by UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  notes TEXT
);

-- Create reconciliation items junction table
CREATE TABLE bank_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reconciliation_id UUID NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  cleared_date DATE DEFAULT CURRENT_DATE,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  matched_by UUID REFERENCES user_profiles(id),
  
  UNIQUE(reconciliation_id, transaction_id)
);

-- Create indexes
CREATE INDEX idx_bank_reconciliations_account ON bank_reconciliations(bank_account_id);
CREATE INDEX idx_bank_reconciliations_date ON bank_reconciliations(reconciliation_date);
CREATE INDEX idx_bank_reconciliations_status ON bank_reconciliations(status);
CREATE INDEX idx_bank_reconciliation_items_recon ON bank_reconciliation_items(reconciliation_id);
CREATE INDEX idx_bank_reconciliation_items_trans ON bank_reconciliation_items(transaction_id);

-- Function to update reconciliation totals
CREATE OR REPLACE FUNCTION update_reconciliation_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_cleared_total DECIMAL(15,2);
  v_uncleared_deposits DECIMAL(15,2);
  v_uncleared_withdrawals DECIMAL(15,2);
  v_book_balance DECIMAL(15,2);
BEGIN
  -- Calculate cleared balance (sum of matched transactions)
  SELECT COALESCE(SUM(bt.amount), 0)
  INTO v_cleared_total
  FROM bank_reconciliation_items bri
  JOIN bank_transactions bt ON bt.id = bri.transaction_id
  WHERE bri.reconciliation_id = NEW.reconciliation_id;
  
  -- Calculate uncleared deposits (positive amounts not in this reconciliation)
  SELECT COALESCE(SUM(bt.amount), 0)
  INTO v_uncleared_deposits
  FROM bank_transactions bt
  WHERE bt.bank_account_id = (
    SELECT bank_account_id FROM bank_reconciliations WHERE id = NEW.reconciliation_id
  )
  AND bt.amount > 0
  AND bt.is_reconciled = FALSE
  AND bt.id NOT IN (
    SELECT transaction_id FROM bank_reconciliation_items WHERE reconciliation_id = NEW.reconciliation_id
  );
  
  -- Calculate uncleared withdrawals (negative amounts not in this reconciliation)
  SELECT COALESCE(SUM(ABS(bt.amount)), 0)
  INTO v_uncleared_withdrawals
  FROM bank_transactions bt
  WHERE bt.bank_account_id = (
    SELECT bank_account_id FROM bank_reconciliations WHERE id = NEW.reconciliation_id
  )
  AND bt.amount < 0
  AND bt.is_reconciled = FALSE
  AND bt.id NOT IN (
    SELECT transaction_id FROM bank_reconciliation_items WHERE reconciliation_id = NEW.reconciliation_id
  );
  
  -- Get current book balance from bank account
  SELECT COALESCE(current_balance, 0)
  INTO v_book_balance
  FROM bank_accounts
  WHERE id = (SELECT bank_account_id FROM bank_reconciliations WHERE id = NEW.reconciliation_id);
  
  -- Update reconciliation record
  UPDATE bank_reconciliations
  SET 
    cleared_balance = v_cleared_total,
    uncleared_deposits = v_uncleared_deposits,
    uncleared_withdrawals = v_uncleared_withdrawals,
    adjusted_bank_balance = (
      SELECT statement_ending_balance + v_uncleared_deposits - v_uncleared_withdrawals
      FROM bank_reconciliations WHERE id = NEW.reconciliation_id
    ),
    book_balance = v_book_balance,
    difference = v_book_balance - (
      SELECT statement_ending_balance + v_uncleared_deposits - v_uncleared_withdrawals
      FROM bank_reconciliations WHERE id = NEW.reconciliation_id
    ),
    updated_at = NOW()
  WHERE id = NEW.reconciliation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update totals when items are added/removed
DROP TRIGGER IF EXISTS trg_update_reconciliation_totals ON bank_reconciliation_items;
CREATE TRIGGER trg_update_reconciliation_totals
AFTER INSERT OR DELETE ON bank_reconciliation_items
FOR EACH ROW
EXECUTE FUNCTION update_reconciliation_totals();

-- Function to mark transactions as reconciled when reconciliation is completed
CREATE OR REPLACE FUNCTION mark_transactions_reconciled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Mark all transactions in this reconciliation as reconciled
    UPDATE bank_transactions
    SET is_reconciled = TRUE
    WHERE id IN (
      SELECT transaction_id 
      FROM bank_reconciliation_items 
      WHERE reconciliation_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for marking transactions reconciled
DROP TRIGGER IF EXISTS trg_mark_transactions_reconciled ON bank_reconciliations;
CREATE TRIGGER trg_mark_transactions_reconciled
AFTER UPDATE OF status ON bank_reconciliations
FOR EACH ROW
EXECUTE FUNCTION mark_transactions_reconciled();

-- Add comments
COMMENT ON TABLE bank_reconciliations IS 'Bank account reconciliation sessions';
COMMENT ON TABLE bank_reconciliation_items IS 'Transactions matched/cleared in reconciliations';
COMMENT ON COLUMN bank_reconciliations.statement_starting_balance IS 'Opening balance from bank statement';
COMMENT ON COLUMN bank_reconciliations.statement_ending_balance IS 'Ending balance from bank statement';
COMMENT ON COLUMN bank_reconciliations.cleared_balance IS 'Sum of all cleared transactions';
COMMENT ON COLUMN bank_reconciliations.uncleared_deposits IS 'Outstanding deposits not on statement';
COMMENT ON COLUMN bank_reconciliations.uncleared_withdrawals IS 'Outstanding checks/withdrawals not on statement';
COMMENT ON COLUMN bank_reconciliations.adjusted_bank_balance IS 'Statement balance adjusted for outstanding items';
COMMENT ON COLUMN bank_reconciliations.book_balance IS 'Current balance per books';
COMMENT ON COLUMN bank_reconciliations.difference IS 'Difference between adjusted bank balance and book balance (should be zero)';
