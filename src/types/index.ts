// Re-export all types
export * from './database';
export * from './breco';

// Additional utility types for the application

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

// Report types
export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

export interface BalanceSheetSection {
  title: string;
  accounts: {
    accountId: string;
    accountCode: string;
    accountName: string;
    balance: number;
  }[];
  total: number;
}

export interface BalanceSheet {
  asOfDate: string;
  assets: BalanceSheetSection[];
  totalAssets: number;
  liabilities: BalanceSheetSection[];
  totalLiabilities: number;
  equity: BalanceSheetSection[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
}

export interface ProfitLossSection {
  title: string;
  accounts: {
    accountId: string;
    accountCode: string;
    accountName: string;
    amount: number;
  }[];
  total: number;
}

export interface ProfitLoss {
  periodStart: string;
  periodEnd: string;
  revenue: ProfitLossSection[];
  totalRevenue: number;
  costOfGoodsSold: ProfitLossSection[];
  totalCogs: number;
  grossProfit: number;
  expenses: ProfitLossSection[];
  totalExpenses: number;
  netIncome: number;
}

export interface AgingBucket {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

export interface ARAgingReport {
  asOfDate: string;
  customers: {
    customerId: string;
    customerName: string;
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
    total: number;
  }[];
  totals: AgingBucket;
}

export interface APAgingReport {
  asOfDate: string;
  vendors: {
    vendorId: string;
    vendorName: string;
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
    total: number;
  }[];
  totals: AgingBucket;
}

// Dashboard types
export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  cashBalance: number;
  accountsReceivable: number;
  accountsPayable: number;
  inventoryValue: number;
  overdueInvoices: number;
  overdueBills: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface RevenueChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
}

// Form types
export interface InvoiceFormData {
  customer_id: string;
  invoice_date: string;
  due_date: string;
  payment_terms: number;
  po_number?: string;
  notes?: string;
  lines: {
    product_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent?: number;
    tax_rate?: number;
  }[];
}

export interface BillFormData {
  vendor_id: string;
  vendor_invoice_number?: string;
  bill_date: string;
  due_date: string;
  payment_terms: number;
  notes?: string;
  lines: {
    description: string;
    quantity: number;
    unit_cost: number;
    expense_account_id: string;
    product_id?: string;
    tax_rate?: number;
  }[];
}

export interface PaymentFormData {
  customer_id?: string;
  vendor_id?: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  deposit_to_account_id?: string;
  pay_from_account_id?: string;
  notes?: string;
  applications: {
    invoice_id?: string;
    bill_id?: string;
    amount_applied: number;
  }[];
}

export interface JournalEntryFormData {
  entry_date: string;
  description: string;
  memo?: string;
  is_adjusting?: boolean;
  lines: {
    account_id: string;
    description?: string;
    debit: number;
    credit: number;
    customer_id?: string;
    vendor_id?: string;
    project_id?: string;
    department?: string;
  }[];
}

export interface ExpenseFormData {
  expense_date: string;
  payee?: string;
  vendor_id?: string;
  amount: number;
  tax_amount?: number;
  payment_method: string;
  reference_number?: string;
  expense_account_id: string;
  payment_account_id: string;
  category?: string;
  department?: string;
  project_id?: string;
  description?: string;
  is_reimbursable?: boolean;
  is_billable?: boolean;
}

export interface ProductFormData {
  sku?: string;
  name: string;
  description?: string;
  category_id?: string;
  product_type: 'inventory' | 'non_inventory' | 'service';
  unit_price: number;
  cost_price?: number;
  track_inventory?: boolean;
  quantity_on_hand?: number;
  reorder_point?: number;
  reorder_quantity?: number;
  unit_of_measure?: string;
  revenue_account_id?: string;
  cogs_account_id?: string;
  inventory_account_id?: string;
  is_taxable?: boolean;
  tax_rate?: number;
}

export interface FixedAssetFormData {
  name: string;
  description?: string;
  category_id?: string;
  purchase_date: string;
  purchase_price: number;
  vendor_id?: string;
  serial_number?: string;
  depreciation_method: string;
  useful_life_months: number;
  residual_value?: number;
  depreciation_start_date: string;
  asset_account_id?: string;
  location?: string;
  notes?: string;
}
