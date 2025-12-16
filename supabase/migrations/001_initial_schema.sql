-- =====================================================
-- BRECO SAFARIS LTD FINANCIAL & OPERATIONS SYSTEM
-- Company: Breco Safaris Ltd
-- Address: Plot 22 Bombo Road, Kampala, Uganda
-- TIN: 1014756280
-- Bank: Stanbic Bank Uganda
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE account_subtype AS ENUM (
  'cash', 'bank', 'receivable', 'inventory', 'fixed_asset', 'other_asset',
  'payable', 'accrued', 'loan', 'other_liability',
  'capital', 'retained_earnings', 'other_equity',
  'sales', 'service', 'other_income',
  'cost_of_goods', 'operating', 'administrative', 'marketing', 'depreciation', 'tax', 'other_expense'
);

CREATE TYPE journal_status AS ENUM ('draft', 'pending', 'posted', 'void');
CREATE TYPE period_status AS ENUM ('open', 'closed', 'locked');
CREATE TYPE period_level AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'annual');

CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'partial', 'paid', 'overdue', 'void', 'cancelled');
CREATE TYPE bill_status AS ENUM ('draft', 'pending_approval', 'approved', 'partial', 'paid', 'overdue', 'void');
CREATE TYPE payment_method AS ENUM ('cash', 'check', 'bank_transfer', 'credit_card', 'stripe', 'other');

CREATE TYPE inventory_method AS ENUM ('fifo', 'lifo', 'weighted_average');
CREATE TYPE stock_movement_type AS ENUM ('purchase', 'sale', 'adjustment', 'transfer', 'return', 'write_off');

CREATE TYPE asset_status AS ENUM ('active', 'disposed', 'fully_depreciated');
CREATE TYPE depreciation_method AS ENUM ('straight_line', 'reducing_balance', 'units_of_production');

-- Breco Safaris roles: admin, accountant, operations (tours/bookings), guide
CREATE TYPE user_role AS ENUM ('admin', 'accountant', 'operations', 'guide');
CREATE TYPE recurring_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually');

-- =====================================================
-- COMPANY & CONFIGURATION
-- =====================================================

CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL DEFAULT 'Breco Safaris Ltd',
  legal_name VARCHAR(255) DEFAULT 'Breco Safaris Ltd',
  ein VARCHAR(20) DEFAULT '1014756280',
  address_line1 VARCHAR(255) DEFAULT 'Plot 22 Bombo Road',
  address_line2 VARCHAR(255),
  city VARCHAR(100) DEFAULT 'Kampala',
  state VARCHAR(50) DEFAULT '',
  zip_code VARCHAR(20) DEFAULT '',
  country VARCHAR(100) DEFAULT 'Uganda',
  phone VARCHAR(50) DEFAULT '+256 700 123456',
  email VARCHAR(255),
  website VARCHAR(255),
  logo_url VARCHAR(500),
  base_currency CHAR(3) DEFAULT 'USD',
  fiscal_year_start_month INT DEFAULT 1, -- January
  inventory_method inventory_method DEFAULT 'fifo',
  default_payment_terms INT DEFAULT 30, -- days
  sales_tax_rate DECIMAL(5,4) DEFAULT 0.0625, -- 6.25% MA sales tax
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255) DEFAULT 'Stanbic Bank Uganda',
  account_number_encrypted BYTEA, -- encrypted with pgcrypto
  routing_number VARCHAR(20),
  wire_routing_number VARCHAR(20),
  swift_code VARCHAR(20) DEFAULT 'SBICUGKX',
  account_type VARCHAR(50) DEFAULT 'checking',
  currency CHAR(3) DEFAULT 'USD',
  gl_account_id UUID, -- links to accounts table
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USERS & ROLES
-- =====================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role user_role DEFAULT 'sales',
  department VARCHAR(100),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CHART OF ACCOUNTS
-- =====================================================

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  account_type account_type NOT NULL,
  account_subtype account_subtype,
  parent_id UUID REFERENCES accounts(id),
  currency CHAR(3) DEFAULT 'USD',
  is_system BOOLEAN DEFAULT false, -- system accounts cannot be deleted
  is_active BOOLEAN DEFAULT true,
  is_bank_account BOOLEAN DEFAULT false,
  bank_account_id UUID REFERENCES bank_accounts(id),
  normal_balance VARCHAR(10) DEFAULT 'debit', -- 'debit' or 'credit'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_type ON accounts(account_type);
CREATE INDEX idx_accounts_code ON accounts(code);
CREATE INDEX idx_accounts_parent ON accounts(parent_id);

-- =====================================================
-- FISCAL PERIODS
-- =====================================================

CREATE TABLE fiscal_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  level period_level NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status period_status DEFAULT 'open',
  parent_period_id UUID REFERENCES fiscal_periods(id),
  closed_by UUID REFERENCES user_profiles(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);
CREATE INDEX idx_fiscal_periods_status ON fiscal_periods(status);

-- =====================================================
-- GENERAL LEDGER - JOURNAL ENTRIES
-- =====================================================

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number VARCHAR(50) NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  period_id UUID REFERENCES fiscal_periods(id),
  description TEXT,
  memo TEXT,
  source_module VARCHAR(50), -- 'sales', 'purchases', 'expenses', 'assets', 'manual', etc.
  source_document_id UUID, -- reference to invoice, bill, etc.
  status journal_status DEFAULT 'draft',
  is_adjusting BOOLEAN DEFAULT false,
  is_closing BOOLEAN DEFAULT false,
  is_reversing BOOLEAN DEFAULT false,
  reversed_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES user_profiles(id),
  posted_by UUID REFERENCES user_profiles(id),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_source ON journal_entries(source_module, source_document_id);

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id),
  description TEXT,
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  base_debit DECIMAL(15,2) DEFAULT 0, -- in base currency (USD)
  base_credit DECIMAL(15,2) DEFAULT 0,
  customer_id UUID,
  vendor_id UUID,
  project_id UUID,
  department VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT positive_amounts CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT single_side CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_journal_lines_journal ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);

-- Trigger to ensure journal entries balance
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debits DECIMAL(15,2);
  total_credits DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(base_debit), 0), COALESCE(SUM(base_credit), 0)
  INTO total_debits, total_credits
  FROM journal_lines
  WHERE journal_entry_id = NEW.journal_entry_id;
  
  IF ABS(total_debits - total_credits) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry does not balance. Debits: %, Credits: %', total_debits, total_credits;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CUSTOMERS
-- =====================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_number VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'USA',
  tax_exempt BOOLEAN DEFAULT false,
  tax_id VARCHAR(50),
  payment_terms INT DEFAULT 30,
  credit_limit DECIMAL(15,2),
  currency CHAR(3) DEFAULT 'USD',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_email ON customers(email);

-- =====================================================
-- VENDORS
-- =====================================================

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_number VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'USA',
  tax_id VARCHAR(50),
  is_1099_vendor BOOLEAN DEFAULT false,
  payment_terms INT DEFAULT 30,
  currency CHAR(3) DEFAULT 'USD',
  default_expense_account_id UUID REFERENCES accounts(id),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendors_name ON vendors(name);

-- =====================================================
-- PRODUCTS & SERVICES (INVENTORY)
-- =====================================================

CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id),
  product_type VARCHAR(50) DEFAULT 'inventory', -- 'inventory', 'non_inventory', 'service'
  
  -- Pricing
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(15,2) DEFAULT 0,
  currency CHAR(3) DEFAULT 'USD',
  
  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  quantity_on_hand DECIMAL(15,4) DEFAULT 0,
  quantity_reserved DECIMAL(15,4) DEFAULT 0,
  quantity_available DECIMAL(15,4) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  reorder_point DECIMAL(15,4),
  reorder_quantity DECIMAL(15,4),
  unit_of_measure VARCHAR(50) DEFAULT 'each',
  
  -- Accounting
  revenue_account_id UUID REFERENCES accounts(id),
  cogs_account_id UUID REFERENCES accounts(id),
  inventory_account_id UUID REFERENCES accounts(id),
  
  -- Tax
  is_taxable BOOLEAN DEFAULT true,
  tax_rate DECIMAL(5,4),
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);

-- =====================================================
-- INVENTORY MOVEMENTS
-- =====================================================

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  movement_type stock_movement_type NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,4),
  total_cost DECIMAL(15,2),
  reference_type VARCHAR(50), -- 'purchase_order', 'invoice', 'adjustment', etc.
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(created_at);

-- Inventory lot tracking for FIFO/LIFO
CREATE TABLE inventory_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  lot_number VARCHAR(100),
  quantity_received DECIMAL(15,4) NOT NULL,
  quantity_remaining DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,4) NOT NULL,
  received_date DATE NOT NULL,
  expiry_date DATE,
  purchase_order_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_lots_product ON inventory_lots(product_id);

-- =====================================================
-- INVOICES (ACCOUNTS RECEIVABLE)
-- =====================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  
  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  
  -- Amounts
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  balance_due DECIMAL(15,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  
  -- Status & Terms
  status invoice_status DEFAULT 'draft',
  payment_terms INT DEFAULT 30,
  
  -- Additional Info
  po_number VARCHAR(100),
  notes TEXT,
  terms_and_conditions TEXT,
  
  -- Stripe
  stripe_invoice_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  
  -- PDF
  pdf_url VARCHAR(500),
  
  -- Accounting
  journal_entry_id UUID REFERENCES journal_entries(id),
  ar_account_id UUID REFERENCES accounts(id),
  
  -- Audit
  sent_at TIMESTAMPTZ,
  sent_to_email VARCHAR(255),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,4) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  revenue_account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- =====================================================
-- PAYMENTS RECEIVED
-- =====================================================

CREATE TABLE payments_received (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  payment_method payment_method NOT NULL,
  reference_number VARCHAR(100), -- check number, transaction ID, etc.
  
  -- Stripe
  stripe_payment_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  
  -- Bank
  deposit_to_account_id UUID REFERENCES accounts(id),
  
  -- Accounting
  journal_entry_id UUID REFERENCES journal_entries(id),
  
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_received_customer ON payments_received(customer_id);
CREATE INDEX idx_payments_received_date ON payments_received(payment_date);

-- Payment applications (which invoices a payment applies to)
CREATE TABLE payment_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments_received(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  amount_applied DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_applications_payment ON payment_applications(payment_id);
CREATE INDEX idx_payment_applications_invoice ON payment_applications(invoice_id);

-- =====================================================
-- BILLS (ACCOUNTS PAYABLE)
-- =====================================================

CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_number VARCHAR(50) NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  vendor_invoice_number VARCHAR(100),
  
  -- Dates
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  
  -- Amounts
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  balance_due DECIMAL(15,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  
  -- Status & Terms
  status bill_status DEFAULT 'draft',
  payment_terms INT DEFAULT 30,
  
  -- Additional Info
  notes TEXT,
  attachment_url VARCHAR(500),
  
  -- Accounting
  journal_entry_id UUID REFERENCES journal_entries(id),
  ap_account_id UUID REFERENCES accounts(id),
  
  -- Approval
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bills_vendor ON bills(vendor_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_due_date ON bills(due_date);

CREATE TABLE bill_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
  unit_cost DECIMAL(15,4) NOT NULL,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  expense_account_id UUID REFERENCES accounts(id),
  product_id UUID REFERENCES products(id), -- for inventory purchases
  project_id UUID,
  department VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bill_lines_bill ON bill_lines(bill_id);

-- =====================================================
-- BILL PAYMENTS
-- =====================================================

CREATE TABLE bill_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  payment_method payment_method NOT NULL,
  reference_number VARCHAR(100),
  
  -- Bank
  pay_from_account_id UUID REFERENCES accounts(id),
  
  -- Accounting
  journal_entry_id UUID REFERENCES journal_entries(id),
  
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bill_payments_vendor ON bill_payments(vendor_id);
CREATE INDEX idx_bill_payments_date ON bill_payments(payment_date);

-- Bill payment applications
CREATE TABLE bill_payment_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_payment_id UUID NOT NULL REFERENCES bill_payments(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id),
  amount_applied DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PURCHASE ORDERS
-- =====================================================

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(50) NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  currency CHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, partial, received, cancelled
  
  shipping_address TEXT,
  notes TEXT,
  
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity_ordered DECIMAL(15,4) NOT NULL,
  quantity_received DECIMAL(15,4) DEFAULT 0,
  unit_cost DECIMAL(15,4) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- GOODS RECEIPTS
-- =====================================================

CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_line_id UUID REFERENCES purchase_order_lines(id),
  product_id UUID REFERENCES products(id),
  quantity_received DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EXPENSES (DIRECT ENTRY)
-- =====================================================

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_number VARCHAR(50) NOT NULL UNIQUE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  payee VARCHAR(255),
  vendor_id UUID REFERENCES vendors(id),
  
  amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  
  currency CHAR(3) DEFAULT 'USD',
  payment_method payment_method NOT NULL,
  reference_number VARCHAR(100),
  
  expense_account_id UUID NOT NULL REFERENCES accounts(id),
  payment_account_id UUID NOT NULL REFERENCES accounts(id),
  
  category VARCHAR(100),
  department VARCHAR(100),
  project_id UUID,
  
  description TEXT,
  receipt_url VARCHAR(500),
  
  is_reimbursable BOOLEAN DEFAULT false,
  is_billable BOOLEAN DEFAULT false,
  
  -- Accounting
  journal_entry_id UUID REFERENCES journal_entries(id),
  
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_account ON expenses(expense_account_id);

-- =====================================================
-- FIXED ASSETS
-- =====================================================

CREATE TABLE asset_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_useful_life_months INT,
  default_depreciation_method depreciation_method DEFAULT 'straight_line',
  depreciation_expense_account_id UUID REFERENCES accounts(id),
  accumulated_depreciation_account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fixed_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_number VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES asset_categories(id),
  
  -- Purchase Info
  purchase_date DATE NOT NULL,
  purchase_price DECIMAL(15,2) NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  serial_number VARCHAR(100),
  
  -- Depreciation
  depreciation_method depreciation_method DEFAULT 'straight_line',
  useful_life_months INT NOT NULL,
  residual_value DECIMAL(15,2) DEFAULT 0,
  depreciation_start_date DATE NOT NULL,
  
  -- Current Values
  accumulated_depreciation DECIMAL(15,2) DEFAULT 0,
  book_value DECIMAL(15,2) GENERATED ALWAYS AS (purchase_price - accumulated_depreciation) STORED,
  
  -- Disposal
  status asset_status DEFAULT 'active',
  disposal_date DATE,
  disposal_price DECIMAL(15,2),
  disposal_journal_id UUID REFERENCES journal_entries(id),
  
  -- Accounting
  asset_account_id UUID REFERENCES accounts(id),
  
  location VARCHAR(255),
  notes TEXT,
  
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fixed_assets_status ON fixed_assets(status);
CREATE INDEX idx_fixed_assets_category ON fixed_assets(category_id);

CREATE TABLE depreciation_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id),
  period_id UUID REFERENCES fiscal_periods(id),
  depreciation_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_depreciation_entries_asset ON depreciation_entries(asset_id);
CREATE INDEX idx_depreciation_entries_date ON depreciation_entries(depreciation_date);

-- =====================================================
-- CASH & PETTY CASH
-- =====================================================

CREATE TABLE cash_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) DEFAULT 'petty_cash', -- 'petty_cash', 'cash_drawer', 'safe'
  gl_account_id UUID REFERENCES accounts(id),
  currency CHAR(3) DEFAULT 'USD',
  current_balance DECIMAL(15,2) DEFAULT 0,
  custodian_user_id UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_account_id UUID NOT NULL REFERENCES cash_accounts(id),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type VARCHAR(50) NOT NULL, -- 'replenishment', 'expense', 'deposit', 'withdrawal'
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference_number VARCHAR(100),
  expense_id UUID REFERENCES expenses(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BANK RECONCILIATION
-- =====================================================

CREATE TABLE bank_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  statement_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  beginning_balance DECIMAL(15,2) NOT NULL,
  ending_balance DECIMAL(15,2) NOT NULL,
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_by UUID REFERENCES user_profiles(id),
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(50), -- 'deposit', 'withdrawal', 'fee', 'interest', 'transfer'
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  reference_number VARCHAR(100),
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_statement_id UUID REFERENCES bank_statements(id),
  matched_journal_line_id UUID REFERENCES journal_lines(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EXCHANGE RATES
-- =====================================================

CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency CHAR(3) NOT NULL,
  to_currency CHAR(3) NOT NULL DEFAULT 'USD',
  rate DECIMAL(12,6) NOT NULL,
  effective_date DATE NOT NULL,
  source VARCHAR(100) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(from_currency, to_currency, effective_date)
);

CREATE INDEX idx_exchange_rates_date ON exchange_rates(effective_date);

-- =====================================================
-- RECURRING TRANSACTIONS
-- =====================================================

CREATE TABLE recurring_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'invoice', 'bill', 'journal', 'expense'
  template_data JSONB NOT NULL, -- stores the transaction template
  frequency recurring_frequency NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  next_run_date DATE NOT NULL,
  last_run_date DATE,
  run_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BUDGETS
-- =====================================================

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  fiscal_year INT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id),
  department VARCHAR(100),
  project_id UUID,
  
  jan_amount DECIMAL(15,2) DEFAULT 0,
  feb_amount DECIMAL(15,2) DEFAULT 0,
  mar_amount DECIMAL(15,2) DEFAULT 0,
  apr_amount DECIMAL(15,2) DEFAULT 0,
  may_amount DECIMAL(15,2) DEFAULT 0,
  jun_amount DECIMAL(15,2) DEFAULT 0,
  jul_amount DECIMAL(15,2) DEFAULT 0,
  aug_amount DECIMAL(15,2) DEFAULT 0,
  sep_amount DECIMAL(15,2) DEFAULT 0,
  oct_amount DECIMAL(15,2) DEFAULT 0,
  nov_amount DECIMAL(15,2) DEFAULT 0,
  dec_amount DECIMAL(15,2) DEFAULT 0,
  
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (
    jan_amount + feb_amount + mar_amount + apr_amount + may_amount + jun_amount +
    jul_amount + aug_amount + sep_amount + oct_amount + nov_amount + dec_amount
  ) STORED,
  
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budgets_year ON budgets(fiscal_year);
CREATE INDEX idx_budgets_account ON budgets(account_id);

-- =====================================================
-- ACTIVITY LOGS (AUDIT TRAIL)
-- =====================================================

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'post', 'void', 'login', etc.
  entity_type VARCHAR(100) NOT NULL, -- 'invoice', 'bill', 'journal', etc.
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_date ON activity_logs(created_at);

-- =====================================================
-- ALERTS & NOTIFICATIONS
-- =====================================================

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type VARCHAR(100) NOT NULL, -- 'low_cash', 'overdue_invoice', 'overdue_bill', 'expense_approval', etc.
  severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  entity_type VARCHAR(100),
  entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  user_id UUID REFERENCES user_profiles(id), -- target user
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_unread ON alerts(user_id, is_read) WHERE is_read = false;

-- =====================================================
-- PROJECTS (for tracking profitability)
-- =====================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_number VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  description TEXT,
  start_date DATE,
  end_date DATE,
  budget DECIMAL(15,2),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'on_hold', 'cancelled'
  is_billable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SEQUENCE GENERATORS
-- =====================================================

CREATE SEQUENCE invoice_number_seq START 1001;
CREATE SEQUENCE bill_number_seq START 1001;
CREATE SEQUENCE payment_number_seq START 1001;
CREATE SEQUENCE expense_number_seq START 1001;
CREATE SEQUENCE journal_number_seq START 1001;
CREATE SEQUENCE po_number_seq START 1001;
CREATE SEQUENCE asset_number_seq START 1001;
CREATE SEQUENCE customer_number_seq START 1001;
CREATE SEQUENCE vendor_number_seq START 1001;

-- Functions to generate formatted numbers
CREATE OR REPLACE FUNCTION generate_invoice_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'INV-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_bill_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'BILL-' || LPAD(nextval('bill_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_payment_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'PMT-' || LPAD(nextval('payment_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_expense_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'EXP-' || LPAD(nextval('expense_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_journal_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'JE-' || LPAD(nextval('journal_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fixed_assets_updated_at BEFORE UPDATE ON fixed_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_transactions_updated_at BEFORE UPDATE ON recurring_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
