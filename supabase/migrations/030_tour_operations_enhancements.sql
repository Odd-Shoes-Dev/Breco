-- =====================================================
-- TOUR OPERATIONS & FINANCIAL ENHANCEMENTS
-- Migration: 030_tour_operations_enhancements.sql
-- =====================================================

-- =====================================================
-- 1. BOOKING TO INVOICE LINK
-- =====================================================

-- Add booking_id to invoices to link bookings with invoices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'invoices' AND column_name = 'booking_id') THEN
    ALTER TABLE invoices
    ADD COLUMN booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);

COMMENT ON COLUMN invoices.booking_id IS 'Links invoice to tour booking';

-- =====================================================
-- 2. TOUR COST ALLOCATION
-- =====================================================

-- Create table to track actual costs per booking
CREATE TABLE IF NOT EXISTS booking_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  cost_type VARCHAR(50) NOT NULL, -- 'guide_fee', 'vehicle', 'hotel', 'permits', 'meals', 'other'
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  vendor_id UUID REFERENCES vendors(id),
  employee_id UUID REFERENCES employees(id), -- For guide fees
  expense_id UUID REFERENCES expenses(id), -- Link to expense record if applicable
  cost_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_costs_booking ON booking_costs(booking_id);
CREATE INDEX idx_booking_costs_type ON booking_costs(cost_type);
CREATE INDEX idx_booking_costs_vendor ON booking_costs(vendor_id);
CREATE INDEX idx_booking_costs_employee ON booking_costs(employee_id);
CREATE INDEX idx_booking_costs_date ON booking_costs(cost_date);

COMMENT ON TABLE booking_costs IS 'Actual costs allocated to tour bookings for profitability tracking';
COMMENT ON COLUMN booking_costs.cost_type IS 'Type of cost: guide_fee, vehicle, hotel, permits, meals, other';

-- =====================================================
-- 3. COMMISSIONS TRACKING
-- =====================================================

-- Create commissions table for travel agents and guides
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commission_type VARCHAR(50) NOT NULL, -- 'agent', 'guide', 'hotel_booking'
  
  -- Related entities
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  employee_id UUID REFERENCES employees(id), -- For guides
  vendor_id UUID REFERENCES vendors(id), -- For travel agents
  
  -- Commission calculation
  commission_rate DECIMAL(5,2), -- Percentage (e.g., 10.00 for 10%)
  base_amount DECIMAL(15,2) NOT NULL, -- Amount commission is calculated on
  commission_amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  
  -- Payment tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  due_date DATE,
  paid_date DATE,
  payment_reference VARCHAR(100),
  
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commissions_type ON commissions(commission_type);
CREATE INDEX idx_commissions_booking ON commissions(booking_id);
CREATE INDEX idx_commissions_employee ON commissions(employee_id);
CREATE INDEX idx_commissions_vendor ON commissions(vendor_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_due_date ON commissions(due_date);

COMMENT ON TABLE commissions IS 'Commission tracking for agents, guides, and partners';
COMMENT ON COLUMN commissions.commission_type IS 'Type: agent (travel agent), guide, hotel_booking';

-- =====================================================
-- 4. DEFERRED REVENUE TRACKING
-- =====================================================

-- Add deferred revenue tracking fields to invoices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'invoices' AND column_name = 'is_advance_payment') THEN
    ALTER TABLE invoices ADD COLUMN is_advance_payment BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'invoices' AND column_name = 'service_start_date') THEN
    ALTER TABLE invoices ADD COLUMN service_start_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'invoices' AND column_name = 'service_end_date') THEN
    ALTER TABLE invoices ADD COLUMN service_end_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'invoices' AND column_name = 'revenue_recognized_amount') THEN
    ALTER TABLE invoices ADD COLUMN revenue_recognized_amount DECIMAL(15,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'invoices' AND column_name = 'revenue_recognition_date') THEN
    ALTER TABLE invoices ADD COLUMN revenue_recognition_date DATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_service_dates ON invoices(service_start_date, service_end_date);
CREATE INDEX IF NOT EXISTS idx_invoices_advance_payment ON invoices(is_advance_payment) WHERE is_advance_payment = true;

COMMENT ON COLUMN invoices.is_advance_payment IS 'True if payment received before service delivery (deferred revenue)';
COMMENT ON COLUMN invoices.service_start_date IS 'When service/tour begins (for revenue recognition)';
COMMENT ON COLUMN invoices.service_end_date IS 'When service/tour ends (for revenue recognition)';
COMMENT ON COLUMN invoices.revenue_recognized_amount IS 'Amount of revenue already recognized';
COMMENT ON COLUMN invoices.revenue_recognition_date IS 'Date when revenue was fully recognized';

-- =====================================================
-- 5. SEASONAL PRICING ENHANCEMENTS
-- =====================================================

-- Add automatic price calculation flag
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tour_seasonal_pricing' AND column_name = 'is_active') THEN
    ALTER TABLE tour_seasonal_pricing ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tour_seasonal_pricing' AND column_name = 'priority') THEN
    ALTER TABLE tour_seasonal_pricing ADD COLUMN priority INTEGER DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_seasonal_pricing_active ON tour_seasonal_pricing(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_seasonal_pricing_dates ON tour_seasonal_pricing(start_date, end_date);

COMMENT ON COLUMN tour_seasonal_pricing.is_active IS 'Whether this pricing rule is currently active';
COMMENT ON COLUMN tour_seasonal_pricing.priority IS 'Priority when multiple seasons overlap (higher wins)';

-- Function to calculate price with seasonal adjustment
CREATE OR REPLACE FUNCTION calculate_tour_price(
  p_tour_package_id UUID,
  p_travel_date DATE,
  p_base_price DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  v_adjustment DECIMAL := 0;
  v_final_price DECIMAL;
BEGIN
  -- Get the highest priority seasonal pricing that applies
  SELECT COALESCE(price_adjustment_fixed_usd, 0) + (p_base_price * COALESCE(price_adjustment_percent, 0) / 100)
  INTO v_adjustment
  FROM tour_seasonal_pricing
  WHERE tour_package_id = p_tour_package_id
    AND p_travel_date BETWEEN start_date AND end_date
    AND is_active = true
  ORDER BY priority DESC, price_adjustment_percent DESC
  LIMIT 1;
  
  v_final_price := p_base_price + COALESCE(v_adjustment, 0);
  
  RETURN GREATEST(v_final_price, 0); -- Never return negative price
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_tour_price IS 'Calculates tour price with seasonal adjustments applied';

-- =====================================================
-- 6. HOTEL BOOKING INTEGRATION
-- =====================================================

-- Enhance booking_hotels table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'booking_hotels' AND column_name = 'room_type_id') THEN
    ALTER TABLE booking_hotels ADD COLUMN room_type_id UUID REFERENCES hotel_room_types(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'booking_hotels' AND column_name = 'room_rate') THEN
    ALTER TABLE booking_hotels ADD COLUMN room_rate DECIMAL(15,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'booking_hotels' AND column_name = 'currency') THEN
    ALTER TABLE booking_hotels ADD COLUMN currency CHAR(3) DEFAULT 'USD';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'booking_hotels' AND column_name = 'commission_rate') THEN
    ALTER TABLE booking_hotels ADD COLUMN commission_rate DECIMAL(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'booking_hotels' AND column_name = 'commission_amount') THEN
    ALTER TABLE booking_hotels ADD COLUMN commission_amount DECIMAL(15,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'booking_hotels' AND column_name = 'confirmation_number') THEN
    ALTER TABLE booking_hotels ADD COLUMN confirmation_number VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'booking_hotels' AND column_name = 'status') THEN
    ALTER TABLE booking_hotels ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    ALTER TABLE booking_hotels ADD CONSTRAINT booking_hotels_status_check CHECK (status IN ('pending', 'confirmed', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_booking_hotels_room_type ON booking_hotels(room_type_id);
CREATE INDEX IF NOT EXISTS idx_booking_hotels_status ON booking_hotels(status);

COMMENT ON COLUMN booking_hotels.room_type_id IS 'Specific room type booked';
COMMENT ON COLUMN booking_hotels.room_rate IS 'Rate per night for this room';
COMMENT ON COLUMN booking_hotels.confirmation_number IS 'Hotel confirmation reference';

-- =====================================================
-- 7. PURCHASE ORDER STATUS TRACKING
-- =====================================================

-- Add approval workflow fields to purchase orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'purchase_orders' AND column_name = 'approved_by') THEN
    ALTER TABLE purchase_orders ADD COLUMN approved_by UUID REFERENCES user_profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'purchase_orders' AND column_name = 'approved_at') THEN
    ALTER TABLE purchase_orders ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'purchase_orders' AND column_name = 'received_date') THEN
    ALTER TABLE purchase_orders ADD COLUMN received_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'purchase_orders' AND column_name = 'received_by') THEN
    ALTER TABLE purchase_orders ADD COLUMN received_by UUID REFERENCES user_profiles(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_approved_by ON purchase_orders(approved_by);

COMMENT ON COLUMN purchase_orders.approved_by IS 'User who approved the PO';
COMMENT ON COLUMN purchase_orders.received_date IS 'Date goods were received';

-- =====================================================
-- 8. GOODS RECEIPT STATUS
-- =====================================================

-- Add status field to goods receipts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'goods_receipts' AND column_name = 'status') THEN
    ALTER TABLE goods_receipts ADD COLUMN status VARCHAR(20) DEFAULT 'received';
    ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_status_check CHECK (status IN ('received', 'inspected', 'accepted', 'rejected', 'returned'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_goods_receipts_status ON goods_receipts(status);

COMMENT ON COLUMN goods_receipts.status IS 'Status of goods receipt: received, inspected, accepted, rejected, returned';

-- =====================================================
-- 9. BANK TRANSFER APPROVAL
-- =====================================================

-- Create bank transfers table if not exists (safety check)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_transfers') THEN
    CREATE TABLE bank_transfers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      transfer_number VARCHAR(50) UNIQUE,
      from_account_id UUID NOT NULL REFERENCES bank_accounts(id),
      to_account_id UUID NOT NULL REFERENCES bank_accounts(id),
      amount DECIMAL(15,2) NOT NULL,
      transfer_date DATE NOT NULL,
      reference VARCHAR(255),
      notes TEXT,
      journal_entry_id UUID REFERENCES journal_entries(id),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
      created_by UUID REFERENCES user_profiles(id),
      approved_by UUID REFERENCES user_profiles(id),
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX idx_bank_transfers_from ON bank_transfers(from_account_id);
    CREATE INDEX idx_bank_transfers_to ON bank_transfers(to_account_id);
    CREATE INDEX idx_bank_transfers_date ON bank_transfers(transfer_date);
    CREATE INDEX idx_bank_transfers_status ON bank_transfers(status);
  END IF;
END $$;

-- Add approval tracking if columns don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bank_transfers' AND column_name = 'approved_by') THEN
    ALTER TABLE bank_transfers
    ADD COLUMN approved_by UUID REFERENCES user_profiles(id),
    ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bank_transfers' AND column_name = 'status') THEN
    ALTER TABLE bank_transfers
    ADD COLUMN status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled'));
  END IF;
END $$;

-- =====================================================
-- 10. PETTY CASH MANAGEMENT
-- =====================================================

-- Create petty cash disbursements table
CREATE TABLE IF NOT EXISTS petty_cash_disbursements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  disbursement_number VARCHAR(50) UNIQUE NOT NULL,
  cash_account_id UUID NOT NULL REFERENCES bank_accounts(id), -- The petty cash account
  amount DECIMAL(15,2) NOT NULL,
  disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category VARCHAR(100), -- e.g., 'office_supplies', 'fuel', 'meals'
  description TEXT NOT NULL,
  recipient_name VARCHAR(255),
  receipt_number VARCHAR(100),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  expense_id UUID REFERENCES expenses(id), -- Link to expense if recorded
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_petty_cash_account ON petty_cash_disbursements(cash_account_id);
CREATE INDEX idx_petty_cash_date ON petty_cash_disbursements(disbursement_date);
CREATE INDEX idx_petty_cash_category ON petty_cash_disbursements(category);

-- Create petty cash replenishments table
CREATE TABLE IF NOT EXISTS petty_cash_replenishments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  replenishment_number VARCHAR(50) UNIQUE NOT NULL,
  cash_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  from_account_id UUID NOT NULL REFERENCES bank_accounts(id), -- Main bank account
  amount DECIMAL(15,2) NOT NULL,
  replenishment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  total_disbursements DECIMAL(15,2) NOT NULL,
  notes TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_petty_cash_replen_account ON petty_cash_replenishments(cash_account_id);
CREATE INDEX idx_petty_cash_replen_date ON petty_cash_replenishments(replenishment_date);

COMMENT ON TABLE petty_cash_disbursements IS 'Petty cash usage tracking';
COMMENT ON TABLE petty_cash_replenishments IS 'Petty cash fund replenishments';

-- =====================================================
-- 11. ASSET DISPOSAL
-- =====================================================

-- Add disposal tracking to fixed_assets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'disposal_date') THEN
    ALTER TABLE fixed_assets ADD COLUMN disposal_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'disposal_method') THEN
    ALTER TABLE fixed_assets ADD COLUMN disposal_method VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'disposal_amount') THEN
    ALTER TABLE fixed_assets ADD COLUMN disposal_amount DECIMAL(15,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'disposal_journal_entry_id') THEN
    ALTER TABLE fixed_assets ADD COLUMN disposal_journal_entry_id UUID REFERENCES journal_entries(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'disposal_notes') THEN
    ALTER TABLE fixed_assets ADD COLUMN disposal_notes TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_disposal ON fixed_assets(disposal_date) WHERE disposal_date IS NOT NULL;

COMMENT ON COLUMN fixed_assets.disposal_date IS 'Date asset was disposed of';
COMMENT ON COLUMN fixed_assets.disposal_method IS 'How asset was disposed: sold, scrapped, donated, traded';
COMMENT ON COLUMN fixed_assets.disposal_amount IS 'Proceeds from sale or trade-in value';

-- =====================================================
-- 12. BUDGET MANAGEMENT
-- =====================================================

-- Enhance budgets table with more tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'budgets' AND column_name = 'approved_by') THEN
    ALTER TABLE budgets ADD COLUMN approved_by UUID REFERENCES user_profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'budgets' AND column_name = 'approved_at') THEN
    ALTER TABLE budgets ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'budgets' AND column_name = 'version') THEN
    ALTER TABLE budgets ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'budgets' AND column_name = 'is_active') THEN
    ALTER TABLE budgets ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_budgets_fiscal_year ON budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budgets_account ON budgets(account_id);
CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(is_active) WHERE is_active = true;

COMMENT ON COLUMN budgets.version IS 'Budget version number for revisions';
COMMENT ON COLUMN budgets.is_active IS 'Whether this budget version is currently active';

-- =====================================================
-- 13. UPDATE TIMESTAMPS
-- =====================================================

-- Add updated_at triggers for new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
DROP TRIGGER IF EXISTS update_booking_costs_updated_at ON booking_costs;
CREATE TRIGGER update_booking_costs_updated_at
  BEFORE UPDATE ON booking_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_commissions_updated_at ON commissions;
CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
