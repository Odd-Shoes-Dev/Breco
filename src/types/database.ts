// =====================================================
// Breco Safaris Ltd - Financial & Operations System
// Database Types for Supabase tables
// =====================================================

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type AccountSubtype =
  | 'cash' | 'bank' | 'receivable' | 'inventory' | 'fixed_asset' | 'other_asset'
  | 'payable' | 'accrued' | 'loan' | 'other_liability'
  | 'capital' | 'retained_earnings' | 'other_equity'
  | 'sales' | 'service' | 'other_income'
  | 'cost_of_goods' | 'operating' | 'administrative' | 'marketing' | 'depreciation' | 'tax' | 'other_expense';

export type JournalStatus = 'draft' | 'pending' | 'posted' | 'void';
export type PeriodStatus = 'open' | 'closed' | 'locked';
export type PeriodLevel = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

export type DocumentType = 'invoice' | 'receipt' | 'quotation' | 'proforma';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void' | 'cancelled';
export type BillStatus = 'draft' | 'pending_approval' | 'approved' | 'partial' | 'paid' | 'overdue' | 'void';
export type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'stripe' | 'mobile_money' | 'petty_cash' | 'other';

export type InventoryMethod = 'fifo' | 'lifo' | 'weighted_average';
export type StockMovementType = 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'return' | 'write_off';

export type AssetStatus = 'active' | 'disposed' | 'fully_depreciated';
export type DepreciationMethod = 'straight_line' | 'reducing_balance' | 'units_of_production';

export type UserRole = 'admin' | 'accountant' | 'operations' | 'guide';
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';

// =====================================================
// CORE ENTITIES
// =====================================================

export interface CompanySettings {
  id: string;
  name: string;
  legal_name: string | null;
  ein: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  base_currency: string;
  fiscal_year_start_month: number;
  inventory_method: InventoryMethod;
  default_payment_terms: number;
  sales_tax_rate: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  department: string | null;
  phone: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  description: string | null;
  account_type: AccountType;
  account_subtype: AccountSubtype | null;
  parent_id: string | null;
  currency: string;
  is_system: boolean;
  is_active: boolean;
  is_bank_account: boolean;
  bank_account_id: string | null;
  normal_balance: 'debit' | 'credit';
  created_at: string;
  updated_at: string;
}

export interface FiscalPeriod {
  id: string;
  name: string;
  level: PeriodLevel;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  parent_period_id: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
}

// =====================================================
// GENERAL LEDGER
// =====================================================

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  period_id: string | null;
  description: string | null;
  memo: string | null;
  source_module: string | null;
  source_document_id: string | null;
  status: JournalStatus;
  is_adjusting: boolean;
  is_closing: boolean;
  is_reversing: boolean;
  reversed_entry_id: string | null;
  created_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalLine {
  id: string;
  journal_entry_id: string;
  line_number: number;
  account_id: string;
  description: string | null;
  debit: number;
  credit: number;
  currency: string;
  exchange_rate: number;
  base_debit: number;
  base_credit: number;
  customer_id: string | null;
  vendor_id: string | null;
  project_id: string | null;
  department: string | null;
  created_at: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalLine[];
}

// =====================================================
// CUSTOMERS & VENDORS
// =====================================================

export interface Customer {
  id: string;
  customer_number: string | null;
  name: string;
  company_name: string | null;
  email: string | null;
  email_2: string | null;
  email_3: string | null;
  email_4: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  tax_exempt: boolean;
  tax_id: string | null;
  payment_terms: number;
  credit_limit: number | null;
  current_balance: number | null;
  currency: 'USD' | 'EUR' | 'GBP' | 'UGX';
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source: string;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  vendor_number: string | null;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  tax_id: string | null;
  is_1099_vendor: boolean;
  payment_terms: number;
  currency: string;
  default_expense_account_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// PRODUCTS & INVENTORY
// =====================================================

export interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  product_type: 'inventory' | 'non_inventory' | 'service';
  unit_price: number;
  cost_price: number;
  currency: string;
  track_inventory: boolean;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_point: number | null;
  reorder_quantity: number | null;
  unit_of_measure: string;
  revenue_account_id: string | null;
  cogs_account_id: string | null;
  inventory_account_id: string | null;
  is_taxable: boolean;
  tax_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InventoryLot {
  id: string;
  product_id: string;
  lot_number: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  received_date: string;
  expiry_date: string | null;
  purchase_order_id: string | null;
  created_at: string;
}

// =====================================================
// INVOICES & RECEIVABLES
// =====================================================

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'UGX';
  exchange_rate: number;
  status: InvoiceStatus;
  payment_terms: number;
  po_number: string | null;
  notes: string | null;
  terms_and_conditions: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  pdf_url: string | null;
  journal_entry_id: string | null;
  ar_account_id: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  document_type: DocumentType;
  quotation_number: string | null;
  proforma_number: string | null;
  receipt_number: string | null;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  line_number: number;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  revenue_account_id: string | null;
  created_at: string;
}

export interface InvoiceWithLines extends Invoice {
  lines: InvoiceLine[];
  customer?: Customer;
}

export interface PaymentReceived {
  id: string;
  payment_number: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  stripe_payment_id: string | null;
  stripe_charge_id: string | null;
  deposit_to_account_id: string | null;
  journal_entry_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PaymentApplication {
  id: string;
  payment_id: string;
  invoice_id: string;
  amount_applied: number;
  created_at: string;
}

// =====================================================
// BILLS & PAYABLES
// =====================================================

export interface Bill {
  id: string;
  bill_number: string;
  vendor_id: string;
  vendor_invoice_number: string | null;
  bill_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  currency: string;
  exchange_rate: number;
  status: BillStatus;
  payment_terms: number;
  notes: string | null;
  attachment_url: string | null;
  journal_entry_id: string | null;
  ap_account_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillLine {
  id: string;
  bill_id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_cost: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  expense_account_id: string | null;
  product_id: string | null;
  project_id: string | null;
  department: string | null;
  created_at: string;
}

export interface BillWithLines extends Bill {
  lines: BillLine[];
  vendor?: Vendor;
}

export interface BillPayment {
  id: string;
  payment_number: string;
  vendor_id: string;
  payment_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  pay_from_account_id: string | null;
  journal_entry_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// =====================================================
// PURCHASE ORDERS
// =====================================================

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  order_date: string;
  expected_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: string;
  shipping_address: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  line_number: number;
  product_id: string | null;
  description: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
}

// =====================================================
// EXPENSES
// =====================================================

export interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  payee: string | null;
  vendor_id: string | null;
  amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  expense_account_id: string;
  payment_account_id: string;
  category: string | null;
  department: string | null;
  project_id: string | null;
  description: string | null;
  receipt_url: string | null;
  is_reimbursable: boolean;
  is_billable: boolean;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// FIXED ASSETS
// =====================================================

export interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  default_useful_life_months: number | null;
  default_depreciation_method: DepreciationMethod;
  depreciation_expense_account_id: string | null;
  accumulated_depreciation_account_id: string | null;
  created_at: string;
}

export interface FixedAsset {
  id: string;
  asset_number: string;
  name: string;
  description: string | null;
  category_id: string | null;
  purchase_date: string;
  purchase_price: number;
  vendor_id: string | null;
  serial_number: string | null;
  depreciation_method: DepreciationMethod;
  useful_life_months: number;
  residual_value: number;
  depreciation_start_date: string;
  accumulated_depreciation: number;
  book_value: number;
  status: AssetStatus;
  disposal_date: string | null;
  disposal_price: number | null;
  disposal_journal_id: string | null;
  asset_account_id: string | null;
  location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepreciationEntry {
  id: string;
  asset_id: string;
  period_id: string | null;
  depreciation_date: string;
  amount: number;
  journal_entry_id: string | null;
  created_at: string;
}

// =====================================================
// CASH & BANK
// =====================================================

export interface CashAccount {
  id: string;
  name: string;
  account_type: string;
  gl_account_id: string | null;
  currency: string;
  current_balance: number;
  custodian_user_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CashTransaction {
  id: string;
  cash_account_id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  reference_number: string | null;
  expense_id: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number_encrypted: string | null;
  routing_number: string | null;
  wire_routing_number: string | null;
  account_type: string;
  currency: string;
  gl_account_id: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankStatement {
  id: string;
  bank_account_id: string;
  statement_date: string;
  start_date: string;
  end_date: string;
  beginning_balance: number;
  ending_balance: number;
  is_reconciled: boolean;
  reconciled_by: string | null;
  reconciled_at: string | null;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  transaction_type: string | null;
  description: string | null;
  amount: number;
  reference_number: string | null;
  is_reconciled: boolean;
  reconciled_statement_id: string | null;
  matched_journal_line_id: string | null;
  created_at: string;
}

// =====================================================
// BUDGETS & RECURRING
// =====================================================

export interface Budget {
  id: string;
  name: string;
  fiscal_year: number;
  account_id: string;
  department: string | null;
  project_id: string | null;
  jan_amount: number;
  feb_amount: number;
  mar_amount: number;
  apr_amount: number;
  may_amount: number;
  jun_amount: number;
  jul_amount: number;
  aug_amount: number;
  sep_amount: number;
  oct_amount: number;
  nov_amount: number;
  dec_amount: number;
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringTransaction {
  id: string;
  name: string;
  transaction_type: string;
  template_data: Record<string, unknown>;
  frequency: RecurringFrequency;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  last_run_date: string | null;
  run_count: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// PROJECTS & ALERTS
// =====================================================

export interface Project {
  id: string;
  project_number: string | null;
  name: string;
  customer_id: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  status: string;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  user_id: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source: string;
  created_at: string;
}

// =====================================================
// DATABASE SCHEMA TYPE
// =====================================================

export interface Database {
  public: {
    Tables: {
      company_settings: { Row: CompanySettings; Insert: Partial<CompanySettings>; Update: Partial<CompanySettings> };
      user_profiles: { Row: UserProfile; Insert: Partial<UserProfile>; Update: Partial<UserProfile> };
      accounts: { Row: Account; Insert: Partial<Account>; Update: Partial<Account> };
      fiscal_periods: { Row: FiscalPeriod; Insert: Partial<FiscalPeriod>; Update: Partial<FiscalPeriod> };
      journal_entries: { Row: JournalEntry; Insert: Partial<JournalEntry>; Update: Partial<JournalEntry> };
      journal_lines: { Row: JournalLine; Insert: Partial<JournalLine>; Update: Partial<JournalLine> };
      customers: { Row: Customer; Insert: Partial<Customer>; Update: Partial<Customer> };
      vendors: { Row: Vendor; Insert: Partial<Vendor>; Update: Partial<Vendor> };
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      product_categories: { Row: ProductCategory; Insert: Partial<ProductCategory>; Update: Partial<ProductCategory> };
      inventory_movements: { Row: InventoryMovement; Insert: Partial<InventoryMovement>; Update: Partial<InventoryMovement> };
      inventory_lots: { Row: InventoryLot; Insert: Partial<InventoryLot>; Update: Partial<InventoryLot> };
      invoices: { Row: Invoice; Insert: Partial<Invoice>; Update: Partial<Invoice> };
      invoice_lines: { Row: InvoiceLine; Insert: Partial<InvoiceLine>; Update: Partial<InvoiceLine> };
      payments_received: { Row: PaymentReceived; Insert: Partial<PaymentReceived>; Update: Partial<PaymentReceived> };
      payment_applications: { Row: PaymentApplication; Insert: Partial<PaymentApplication>; Update: Partial<PaymentApplication> };
      bills: { Row: Bill; Insert: Partial<Bill>; Update: Partial<Bill> };
      bill_lines: { Row: BillLine; Insert: Partial<BillLine>; Update: Partial<BillLine> };
      bill_payments: { Row: BillPayment; Insert: Partial<BillPayment>; Update: Partial<BillPayment> };
      purchase_orders: { Row: PurchaseOrder; Insert: Partial<PurchaseOrder>; Update: Partial<PurchaseOrder> };
      purchase_order_lines: { Row: PurchaseOrderLine; Insert: Partial<PurchaseOrderLine>; Update: Partial<PurchaseOrderLine> };
      expenses: { Row: Expense; Insert: Partial<Expense>; Update: Partial<Expense> };
      asset_categories: { Row: AssetCategory; Insert: Partial<AssetCategory>; Update: Partial<AssetCategory> };
      fixed_assets: { Row: FixedAsset; Insert: Partial<FixedAsset>; Update: Partial<FixedAsset> };
      depreciation_entries: { Row: DepreciationEntry; Insert: Partial<DepreciationEntry>; Update: Partial<DepreciationEntry> };
      cash_accounts: { Row: CashAccount; Insert: Partial<CashAccount>; Update: Partial<CashAccount> };
      cash_transactions: { Row: CashTransaction; Insert: Partial<CashTransaction>; Update: Partial<CashTransaction> };
      bank_accounts: { Row: BankAccount; Insert: Partial<BankAccount>; Update: Partial<BankAccount> };
      bank_statements: { Row: BankStatement; Insert: Partial<BankStatement>; Update: Partial<BankStatement> };
      bank_transactions: { Row: BankTransaction; Insert: Partial<BankTransaction>; Update: Partial<BankTransaction> };
      budgets: { Row: Budget; Insert: Partial<Budget>; Update: Partial<Budget> };
      recurring_transactions: { Row: RecurringTransaction; Insert: Partial<RecurringTransaction>; Update: Partial<RecurringTransaction> };
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project> };
      alerts: { Row: Alert; Insert: Partial<Alert>; Update: Partial<Alert> };
      activity_logs: { Row: ActivityLog; Insert: Partial<ActivityLog>; Update: Partial<ActivityLog> };
      exchange_rates: { Row: ExchangeRate; Insert: Partial<ExchangeRate>; Update: Partial<ExchangeRate> };
    };
  };
}
