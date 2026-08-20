-- =====================================================
-- BRECO SAFARIS LTD - INITIAL SCHEMA
-- Neon Migration 001
-- Run this first. All subsequent migrations depend on it.
-- =====================================================

-- Extensions
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
CREATE TYPE payment_method AS ENUM ('cash', 'check', 'bank_transfer', 'credit_card', 'stripe', 'mobile_money', 'petty_cash', 'other');

CREATE TYPE inventory_method AS ENUM ('fifo', 'lifo', 'weighted_average');
CREATE TYPE stock_movement_type AS ENUM ('purchase', 'sale', 'adjustment', 'transfer', 'return', 'write_off');

CREATE TYPE asset_status AS ENUM ('active', 'disposed', 'fully_depreciated');
CREATE TYPE depreciation_method AS ENUM ('straight_line', 'reducing_balance', 'units_of_production');

-- User roles for the tour operations company
CREATE TYPE user_role AS ENUM ('admin', 'accountant', 'operations', 'sales', 'guide');

-- Booking lifecycle
CREATE TYPE booking_status AS ENUM (
  'inquiry', 'quote_sent', 'confirmed', 'deposit_paid',
  'fully_paid', 'in_progress', 'completed', 'cancelled', 'refunded'
);

CREATE TYPE vehicle_status AS ENUM ('available', 'booked', 'in_use', 'maintenance', 'out_of_service');
CREATE TYPE pay_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE payroll_status AS ENUM ('draft', 'pending_approval', 'approved', 'paid', 'void');
CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'terminated', 'probation');

-- =====================================================
-- UTILITY FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users (replaces Supabase auth.users + user_profiles)
-- Passwords are hashed with bcrypt in the application layer
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'sales',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Company settings (single row)
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  ein VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Uganda',
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  logo_url VARCHAR(500),
  base_currency CHAR(3) DEFAULT 'UGX',
  fiscal_year_start_month INT DEFAULT 1,
  sales_tax_rate DECIMAL(5,4) DEFAULT 0.18,
  inventory_method inventory_method DEFAULT 'fifo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chart of accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  account_subtype account_subtype NOT NULL,
  normal_balance VARCHAR(10) NOT NULL DEFAULT 'debit',
  parent_id UUID REFERENCES accounts(id),
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_code ON accounts(code);
CREATE INDEX idx_accounts_type ON accounts(account_type);

-- Fiscal periods
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  level period_level NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status period_status DEFAULT 'open',
  parent_period_id UUID REFERENCES fiscal_periods(id),
  locked_by UUID REFERENCES users(id),
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);
CREATE INDEX idx_fiscal_periods_status ON fiscal_periods(status);

-- Journal entries (double-entry header)
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number VARCHAR(50) NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  status journal_status DEFAULT 'draft',
  fiscal_period_id UUID REFERENCES fiscal_periods(id),
  reference_type VARCHAR(50),
  reference_id UUID,
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);

-- Journal lines (double-entry detail)
CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  description TEXT,
  currency CHAR(3) DEFAULT 'UGX',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  line_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);

-- =====================================================
-- CUSTOMERS & VENDORS
-- =====================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_number VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  country VARCHAR(100),
  currency CHAR(3) DEFAULT 'USD',
  current_balance DECIMAL(15,2) DEFAULT 0,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  payment_terms INT DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_number VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  currency CHAR(3) DEFAULT 'USD',
  current_balance DECIMAL(15,2) DEFAULT 0,
  payment_terms INT DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendors_name ON vendors(name);

-- =====================================================
-- PRODUCTS & INVENTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id),
  unit_of_measure VARCHAR(50) DEFAULT 'unit',
  purchase_price DECIMAL(15,2) DEFAULT 0,
  selling_price DECIMAL(15,2) DEFAULT 0,
  is_taxable BOOLEAN DEFAULT true,
  track_inventory BOOLEAN DEFAULT false,
  reorder_point INT DEFAULT 0,
  income_account_id UUID REFERENCES accounts(id),
  expense_account_id UUID REFERENCES accounts(id),
  inventory_account_id UUID REFERENCES accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  movement_type stock_movement_type NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,2) DEFAULT 0,
  total_cost DECIMAL(15,2) DEFAULT 0,
  reference_type VARCHAR(50),
  reference_id UUID,
  location_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(created_at);

CREATE TABLE IF NOT EXISTS inventory_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  lot_number VARCHAR(100),
  purchase_date DATE,
  quantity_received DECIMAL(15,4) NOT NULL,
  quantity_remaining DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,2) NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_lots_product ON inventory_lots(product_id);

-- =====================================================
-- INVOICING & AR
-- =====================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE,
  quotation_number VARCHAR(50),
  proforma_number VARCHAR(50),
  receipt_number VARCHAR(50),
  document_type VARCHAR(20) DEFAULT 'invoice', -- invoice, quotation, proforma, receipt
  customer_id UUID NOT NULL REFERENCES customers(id),
  booking_id UUID, -- FK added after bookings table created
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_terms INT DEFAULT 30,
  po_number VARCHAR(100),
  status invoice_status DEFAULT 'draft',
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  ar_account_id UUID REFERENCES accounts(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  reference_invoice_number VARCHAR(50),
  notes TEXT,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_document_type ON invoices(document_type);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number INT NOT NULL DEFAULT 1,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);

CREATE TABLE IF NOT EXISTS payments_received (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number VARCHAR(50) UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'bank_transfer',
  reference_number VARCHAR(100),
  bank_account_id UUID,
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  journal_entry_id UUID REFERENCES journal_entries(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_received_customer ON payments_received(customer_id);
CREATE INDEX idx_payments_received_date ON payments_received(payment_date);

CREATE TABLE IF NOT EXISTS payment_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments_received(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  amount_applied DECIMAL(15,2) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BILLS & AP
-- =====================================================

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_number VARCHAR(50) UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_terms INT DEFAULT 30,
  status bill_status DEFAULT 'draft',
  currency CHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  ap_account_id UUID REFERENCES accounts(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bills_vendor ON bills(vendor_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_date ON bills(bill_date);

CREATE TABLE IF NOT EXISTS bill_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  line_number INT NOT NULL DEFAULT 1,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number VARCHAR(50) UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'bank_transfer',
  reference_number VARCHAR(100),
  bank_account_id UUID,
  currency CHAR(3) DEFAULT 'USD',
  journal_entry_id UUID REFERENCES journal_entries(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payment_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES bill_payments(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id),
  amount_applied DECIMAL(15,2) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EXPENSES
-- =====================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_number VARCHAR(50) UNIQUE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id UUID REFERENCES vendors(id),
  account_id UUID REFERENCES accounts(id),
  bank_account_id UUID,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  currency CHAR(3) DEFAULT 'UGX',
  payment_method payment_method DEFAULT 'cash',
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  paid_by UUID REFERENCES users(id),
  paid_at TIMESTAMPTZ,
  receipt_url VARCHAR(500),
  journal_entry_id UUID REFERENCES journal_entries(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_status ON expenses(status);

-- =====================================================
-- PURCHASE ORDERS & GOODS RECEIPTS
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(50) NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  status VARCHAR(50) DEFAULT 'draft',
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  currency CHAR(3) DEFAULT 'UGX',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,
  quantity_received DECIMAL(15,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gr_number VARCHAR(50) NOT NULL UNIQUE,
  po_id UUID REFERENCES purchase_orders(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gr_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  po_line_id UUID REFERENCES purchase_order_lines(id),
  product_id UUID REFERENCES products(id),
  description TEXT,
  quantity_received DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FIXED ASSETS
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_useful_life_months INT DEFAULT 60,
  default_depreciation_method depreciation_method DEFAULT 'straight_line',
  depreciation_expense_account_id UUID REFERENCES accounts(id),
  accumulated_depreciation_account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_number VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES asset_categories(id),
  status asset_status DEFAULT 'active',
  purchase_date DATE NOT NULL,
  purchase_price DECIMAL(15,2) NOT NULL,
  salvage_value DECIMAL(15,2) DEFAULT 0,
  useful_life_months INT NOT NULL,
  depreciation_method depreciation_method DEFAULT 'straight_line',
  accumulated_depreciation DECIMAL(15,2) DEFAULT 0,
  current_book_value DECIMAL(15,2),
  asset_account_id UUID REFERENCES accounts(id),
  depreciation_account_id UUID REFERENCES accounts(id),
  accumulated_depr_account_id UUID REFERENCES accounts(id),
  disposal_date DATE,
  disposal_amount DECIMAL(15,2),
  currency CHAR(3) DEFAULT 'UGX',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fixed_assets_number ON fixed_assets(asset_number);
CREATE INDEX idx_fixed_assets_status ON fixed_assets(status);

CREATE TABLE IF NOT EXISTS depreciation_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id),
  entry_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  depreciation_amount DECIMAL(15,2) NOT NULL,
  accumulated_depreciation DECIMAL(15,2) NOT NULL,
  book_value DECIMAL(15,2) NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_depreciation_entries_asset ON depreciation_entries(asset_id);

-- Depreciation posting batches
CREATE TABLE IF NOT EXISTS depreciation_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  posting_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_depreciation DECIMAL(15,2) NOT NULL DEFAULT 0,
  assets_count INTEGER NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES journal_entries(id),
  status VARCHAR(20) DEFAULT 'posted',
  notes TEXT,
  posted_by UUID NOT NULL REFERENCES users(id),
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  voided_by UUID REFERENCES users(id),
  voided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS depreciation_posting_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  posting_id UUID NOT NULL REFERENCES depreciation_postings(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  depreciation_amount DECIMAL(15,2) NOT NULL,
  accumulated_before DECIMAL(15,2) NOT NULL,
  accumulated_after DECIMAL(15,2) NOT NULL,
  book_value_before DECIMAL(15,2) NOT NULL,
  book_value_after DECIMAL(15,2) NOT NULL
);

-- =====================================================
-- BANKING
-- =====================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  swift_code VARCHAR(20),
  currency CHAR(3) DEFAULT 'UGX',
  current_balance DECIMAL(15,2) DEFAULT 0,
  gl_account_id UUID REFERENCES accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- debit, credit
  reference_number VARCHAR(100),
  is_reconciled BOOLEAN DEFAULT false,
  reconciliation_id UUID,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);

CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  statement_date DATE NOT NULL,
  opening_balance DECIMAL(15,2) NOT NULL,
  closing_balance DECIMAL(15,2) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank reconciliation sessions
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  statement_starting_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  statement_ending_balance DECIMAL(15,2) NOT NULL,
  statement_date DATE NOT NULL,
  cleared_balance DECIMAL(15,2) DEFAULT 0,
  uncleared_deposits DECIMAL(15,2) DEFAULT 0,
  uncleared_withdrawals DECIMAL(15,2) DEFAULT 0,
  adjusted_bank_balance DECIMAL(15,2) DEFAULT 0,
  book_balance DECIMAL(15,2) DEFAULT 0,
  difference DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'in_progress',
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reconciliation_id UUID NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  is_cleared BOOLEAN DEFAULT false,
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank transfers between accounts
CREATE TABLE IF NOT EXISTS bank_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number VARCHAR(50) UNIQUE,
  from_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  to_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  journal_entry_id UUID REFERENCES journal_entries(id),
  approved_by UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EXCHANGE RATES
-- =====================================================

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency CHAR(3) NOT NULL,
  to_currency CHAR(3) NOT NULL,
  rate DECIMAL(18,8) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_rate_per_day UNIQUE(from_currency, to_currency, effective_date)
);

CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(effective_date DESC);

-- =====================================================
-- TOUR OPERATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Uganda',
  region VARCHAR(100),
  description TEXT,
  highlights TEXT[],
  best_time_to_visit VARCHAR(255),
  typical_duration_days INT,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tour_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_days INT NOT NULL,
  duration_nights INT NOT NULL,
  base_price_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
  base_price_eur DECIMAL(15,2) DEFAULT 0,
  base_price_ugx DECIMAL(15,2) DEFAULT 0,
  price_per_person BOOLEAN DEFAULT true,
  min_group_size INT DEFAULT 1,
  max_group_size INT DEFAULT 20,
  max_capacity INTEGER DEFAULT 0,
  available_slots INTEGER DEFAULT 0,
  slots_reserved INTEGER DEFAULT 0,
  tour_type VARCHAR(100),
  difficulty_level VARCHAR(50) DEFAULT 'moderate',
  inclusions TEXT,
  exclusions TEXT,
  primary_destination_id UUID REFERENCES destinations(id),
  image_url VARCHAR(500),
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tour_packages_code ON tour_packages(package_code);
CREATE INDEX idx_tour_packages_active ON tour_packages(is_active);

CREATE TABLE IF NOT EXISTS tour_package_destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES destinations(id),
  visit_order INT NOT NULL DEFAULT 1,
  nights_stay INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tour_package_id, destination_id)
);

CREATE TABLE IF NOT EXISTS tour_itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  activities TEXT[],
  meals_included VARCHAR(50),
  accommodation VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  destination_id UUID REFERENCES destinations(id),
  star_rating INT,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  single_rate_usd DECIMAL(15,2),
  double_rate_usd DECIMAL(15,2),
  triple_rate_usd DECIMAL(15,2),
  suite_rate_usd DECIMAL(15,2),
  contact_person VARCHAR(255),
  contact_phone VARCHAR(50),
  commission_rate DECIMAL(5,2) DEFAULT 10,
  notes TEXT,
  is_partner BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotel_room_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  max_occupancy INT DEFAULT 2,
  rate_usd DECIMAL(15,2) NOT NULL,
  rate_ugx DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  booking_type VARCHAR(50) NOT NULL DEFAULT 'tour',
  tour_package_id UUID REFERENCES tour_packages(id),
  hotel_id UUID REFERENCES hotels(id),
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  travel_start_date DATE NOT NULL,
  travel_end_date DATE NOT NULL,
  num_adults INT NOT NULL DEFAULT 1,
  num_children INT DEFAULT 0,
  num_infants INT DEFAULT 0,
  number_of_people INTEGER DEFAULT 1,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  balance_due DECIMAL(15,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  status booking_status DEFAULT 'inquiry',
  special_requests TEXT,
  dietary_requirements TEXT,
  room_type VARCHAR(100),
  num_rooms INT DEFAULT 1,
  rental_type VARCHAR(50),
  pickup_location VARCHAR(200),
  dropoff_location VARCHAR(200),
  assigned_guide_id UUID REFERENCES users(id),
  assigned_vehicle_id UUID,
  invoice_id UUID REFERENCES invoices(id),
  quotation_id UUID REFERENCES invoices(id),
  booking_confirmed_at TIMESTAMPTZ,
  cancellation_date TIMESTAMPTZ,
  cancellation_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_travel_dates CHECK (travel_end_date >= travel_start_date)
);

CREATE INDEX idx_bookings_number ON bookings(booking_number);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_dates ON bookings(travel_start_date, travel_end_date);
CREATE INDEX idx_bookings_hotel ON bookings(hotel_id);
CREATE INDEX idx_bookings_type ON bookings(booking_type);

-- Add booking_id FK to invoices now that bookings table exists
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_booking
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX idx_invoices_booking_id ON invoices(booking_id);

CREATE TABLE IF NOT EXISTS booking_guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  nationality VARCHAR(100),
  passport_number VARCHAR(50),
  passport_expiry DATE,
  date_of_birth DATE,
  is_lead_guest BOOLEAN DEFAULT false,
  special_requirements TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_hotels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES hotels(id),
  room_type_id UUID REFERENCES hotel_room_types(id),
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  num_rooms INT DEFAULT 1,
  room_rate DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  confirmation_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  activity_name VARCHAR(255) NOT NULL,
  description TEXT,
  num_participants INT DEFAULT 1,
  unit_cost DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  permit_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments_received(id),
  amount DECIMAL(15,2) NOT NULL,
  payment_type VARCHAR(50) DEFAULT 'deposit',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  cost_type VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  vendor_id UUID REFERENCES vendors(id),
  bill_id UUID REFERENCES bills(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FLEET MANAGEMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_number VARCHAR(50) NOT NULL UNIQUE,
  registration_number VARCHAR(50) NOT NULL UNIQUE,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INT,
  color VARCHAR(50),
  vehicle_type VARCHAR(100),
  fuel_type VARCHAR(50) DEFAULT 'diesel',
  transmission VARCHAR(50) DEFAULT 'manual',
  seating_capacity INT NOT NULL DEFAULT 4,
  luggage_capacity VARCHAR(100),
  features TEXT[],
  purchase_date DATE,
  purchase_price DECIMAL(15,2),
  current_value DECIMAL(15,2),
  insurance_expiry DATE,
  daily_rate_usd DECIMAL(15,2),
  daily_rate_ugx DECIMAL(15,2),
  weekly_rate_usd DECIMAL(15,2),
  mileage_rate DECIMAL(10,2),
  status vehicle_status DEFAULT 'available',
  current_mileage INT DEFAULT 0,
  last_service_date DATE,
  next_service_mileage INT,
  location VARCHAR(100),
  fixed_asset_id UUID REFERENCES fixed_assets(id),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vehicles_number ON vehicles(vehicle_number);
CREATE INDEX idx_vehicles_status ON vehicles(status);

ALTER TABLE bookings ADD CONSTRAINT bookings_assigned_vehicle_id_fkey
  FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_vehicle ON bookings(assigned_vehicle_id);

CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL,
  maintenance_type VARCHAR(100) NOT NULL,
  description TEXT,
  mileage_at_service INT,
  cost DECIMAL(15,2),
  vendor_id UUID REFERENCES vendors(id),
  performed_by VARCHAR(255),
  next_service_date DATE,
  next_service_mileage INT,
  receipt_url VARCHAR(500),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS car_rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_number VARCHAR(50) NOT NULL UNIQUE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  booking_id UUID REFERENCES bookings(id),
  pickup_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ NOT NULL,
  actual_return_date TIMESTAMPTZ,
  pickup_location VARCHAR(255),
  return_location VARCHAR(255),
  with_driver BOOLEAN DEFAULT true,
  driver_id UUID REFERENCES users(id),
  start_mileage INT,
  end_mileage INT,
  mileage_limit INT,
  extra_mileage_rate DECIMAL(10,2),
  daily_rate DECIMAL(15,2) NOT NULL,
  num_days INT NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  extras_total DECIMAL(15,2) DEFAULT 0,
  fuel_charge DECIMAL(15,2) DEFAULT 0,
  damage_charge DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'reserved',
  insurance_option VARCHAR(100),
  insurance_cost DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PAYROLL
-- =====================================================

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_number VARCHAR(50) NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  other_names VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(20),
  nationality VARCHAR(100) DEFAULT 'Ugandan',
  national_id VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  job_title VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  employment_type VARCHAR(50) DEFAULT 'full_time',
  employment_status employment_status DEFAULT 'active',
  hire_date DATE NOT NULL,
  termination_date DATE,
  reporting_to UUID REFERENCES employees(id),
  basic_salary DECIMAL(15,2) NOT NULL,
  salary_currency CHAR(3) DEFAULT 'UGX',
  pay_frequency pay_frequency DEFAULT 'monthly',
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  bank_account_number VARCHAR(100),
  bank_account_name VARCHAR(255),
  swift_code VARCHAR(20),
  tin VARCHAR(50),
  nssf_number VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_number ON employees(employee_number);
CREATE INDEX idx_employees_active ON employees(is_active);

CREATE TABLE IF NOT EXISTS employee_allowances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  allowance_type VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  is_taxable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  deduction_type VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  is_percentage BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_name VARCHAR(100) NOT NULL,
  period_type pay_frequency NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_date DATE NOT NULL,
  status payroll_status DEFAULT 'draft',
  total_gross DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  total_net DECIMAL(15,2) DEFAULT 0,
  total_employer_contributions DECIMAL(15,2) DEFAULT 0,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payslip_number VARCHAR(50) NOT NULL UNIQUE,
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  basic_salary DECIMAL(15,2) NOT NULL,
  total_allowances DECIMAL(15,2) DEFAULT 0,
  overtime_hours DECIMAL(10,2) DEFAULT 0,
  overtime_amount DECIMAL(15,2) DEFAULT 0,
  bonus DECIMAL(15,2) DEFAULT 0,
  commission DECIMAL(15,2) DEFAULT 0,
  reimbursements DECIMAL(15,2) DEFAULT 0,
  gross_salary DECIMAL(15,2) NOT NULL,
  paye DECIMAL(15,2) DEFAULT 0,
  nssf_employee DECIMAL(15,2) DEFAULT 0,
  loan_deduction DECIMAL(15,2) DEFAULT 0,
  salary_advance DECIMAL(15,2) DEFAULT 0,
  other_deductions DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  net_salary DECIMAL(15,2) NOT NULL,
  nssf_employer DECIMAL(15,2) DEFAULT 0,
  payment_method payment_method DEFAULT 'bank_transfer',
  payment_reference VARCHAR(100),
  paid_at TIMESTAMPTZ,
  currency CHAR(3) DEFAULT 'UGX',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payslips_period ON payslips(payroll_period_id);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);

CREATE TABLE IF NOT EXISTS payslip_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payslip_id UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  is_taxable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  reason TEXT,
  repayment_months INT DEFAULT 1,
  amount_repaid DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  expense_id UUID REFERENCES expenses(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_reimbursements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  reimbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type VARCHAR(100) NOT NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  receipt_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  paid_in_payroll_id UUID REFERENCES payroll_periods(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INVENTORY LOCATIONS & STOCK TAKES
-- =====================================================

CREATE TABLE IF NOT EXISTS inventory_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'warehouse',
  address_line1 VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Uganda',
  phone VARCHAR(50),
  manager_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_takes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number VARCHAR(50) NOT NULL UNIQUE,
  location_id UUID REFERENCES inventory_locations(id),
  status VARCHAR(50) DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_take_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  expected_quantity DECIMAL(15,4) DEFAULT 0,
  counted_quantity DECIMAL(15,4),
  variance DECIMAL(15,4) GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
  unit_cost DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number VARCHAR(50) NOT NULL UNIQUE,
  from_location_id UUID REFERENCES inventory_locations(id),
  to_location_id UUID REFERENCES inventory_locations(id),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transfer_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ACTIVITY LOGS & ALERTS
-- =====================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_date ON activity_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  alert_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  entity_type VARCHAR(100),
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);

-- =====================================================
-- MISCELLANEOUS
-- =====================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(15,2),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  next_date DATE NOT NULL,
  end_date DATE,
  amount DECIMAL(15,2) NOT NULL,
  account_id UUID REFERENCES accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  fiscal_period_id UUID REFERENCES fiscal_periods(id),
  account_id UUID REFERENCES accounts(id),
  amount DECIMAL(15,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tour_package_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255),
  display_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cafe sales (simple POS)
CREATE TABLE IF NOT EXISTS cafe_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  payment_method payment_method DEFAULT 'cash',
  account_id UUID REFERENCES accounts(id),
  bank_account_id UUID REFERENCES bank_accounts(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
