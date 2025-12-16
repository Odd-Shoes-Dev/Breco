-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- Breco Safaris Ltd Financial & Operations System
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
  RETURN (
    SELECT role FROM user_profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is accountant or higher (admin, accountant)
CREATE OR REPLACE FUNCTION is_accountant_or_above()
RETURNS BOOLEAN AS $$
DECLARE
  r user_role;
BEGIN
  r := get_user_role();
  RETURN r IN ('admin', 'accountant');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is operations or higher (admin, accountant, operations)
CREATE OR REPLACE FUNCTION is_operations_or_above()
RETURNS BOOLEAN AS $$
DECLARE
  r user_role;
BEGIN
  r := get_user_role();
  RETURN r IN ('admin', 'accountant', 'operations');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can view financials (admin, accountant only)
CREATE OR REPLACE FUNCTION can_view_financials()
RETURNS BOOLEAN AS $$
DECLARE
  r user_role;
BEGIN
  r := get_user_role();
  RETURN r IN ('admin', 'accountant');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMPANY SETTINGS POLICIES
-- =====================================================

CREATE POLICY "Anyone can view company settings"
  ON company_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update company settings"
  ON company_settings FOR UPDATE
  USING (is_admin());

-- =====================================================
-- USER PROFILES POLICIES
-- =====================================================

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id OR is_admin());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON user_profiles FOR ALL
  USING (is_admin());

-- =====================================================
-- ACCOUNTS (CHART OF ACCOUNTS) POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view accounts"
  ON accounts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage accounts"
  ON accounts FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- FISCAL PERIODS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view periods"
  ON fiscal_periods FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage periods"
  ON fiscal_periods FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- JOURNAL ENTRIES POLICIES
-- =====================================================

CREATE POLICY "Users with financial access can view journals"
  ON journal_entries FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can create/update draft journals"
  ON journal_entries FOR INSERT
  WITH CHECK (is_accountant_or_above());

CREATE POLICY "Accountants can update draft journals"
  ON journal_entries FOR UPDATE
  USING (is_accountant_or_above() AND status = 'draft');

CREATE POLICY "Only admins can delete journals"
  ON journal_entries FOR DELETE
  USING (is_admin() AND status = 'draft');

CREATE POLICY "Users with financial access can view journal lines"
  ON journal_lines FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage journal lines"
  ON journal_lines FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- CUSTOMERS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Sales and above can manage customers"
  ON customers FOR ALL
  USING (get_user_role() IN ('admin', 'accountant', 'manager', 'sales'));

-- =====================================================
-- VENDORS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view vendors"
  ON vendors FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage vendors"
  ON vendors FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- PRODUCTS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants and managers can manage products"
  ON products FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Authenticated users can view product categories"
  ON product_categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage product categories"
  ON product_categories FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- INVENTORY POLICIES
-- =====================================================

CREATE POLICY "Users with financial access can view inventory movements"
  ON inventory_movements FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage inventory movements"
  ON inventory_movements FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Users with financial access can view inventory lots"
  ON inventory_lots FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage inventory lots"
  ON inventory_lots FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- INVOICES POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Sales and above can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'accountant', 'manager', 'sales'));

CREATE POLICY "Sales can update draft invoices"
  ON invoices FOR UPDATE
  USING (get_user_role() IN ('admin', 'accountant', 'manager', 'sales') AND status = 'draft');

CREATE POLICY "Accountants can update all invoices"
  ON invoices FOR UPDATE
  USING (is_accountant_or_above());

CREATE POLICY "Authenticated users can view invoice lines"
  ON invoice_lines FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Sales and above can manage invoice lines"
  ON invoice_lines FOR ALL
  USING (get_user_role() IN ('admin', 'accountant', 'manager', 'sales'));

-- =====================================================
-- PAYMENTS RECEIVED POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view payments"
  ON payments_received FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage payments"
  ON payments_received FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Authenticated users can view payment applications"
  ON payment_applications FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage payment applications"
  ON payment_applications FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- BILLS POLICIES
-- =====================================================

CREATE POLICY "Users with financial access can view bills"
  ON bills FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage bills"
  ON bills FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Users with financial access can view bill lines"
  ON bill_lines FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage bill lines"
  ON bill_lines FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- BILL PAYMENTS POLICIES
-- =====================================================

CREATE POLICY "Users with financial access can view bill payments"
  ON bill_payments FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage bill payments"
  ON bill_payments FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Users with financial access can view bill payment applications"
  ON bill_payment_applications FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage bill payment applications"
  ON bill_payment_applications FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- PURCHASE ORDERS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view purchase orders"
  ON purchase_orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants and managers can manage purchase orders"
  ON purchase_orders FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Authenticated users can view PO lines"
  ON purchase_order_lines FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage PO lines"
  ON purchase_order_lines FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- GOODS RECEIPTS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view goods receipts"
  ON goods_receipts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage goods receipts"
  ON goods_receipts FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Authenticated users can view goods receipt lines"
  ON goods_receipt_lines FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage goods receipt lines"
  ON goods_receipt_lines FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- EXPENSES POLICIES
-- =====================================================

CREATE POLICY "Users can view their own expenses"
  ON expenses FOR SELECT
  USING (created_by = auth.uid() OR can_view_financials());

CREATE POLICY "Authenticated users can create expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own draft expenses"
  ON expenses FOR UPDATE
  USING (created_by = auth.uid() OR is_accountant_or_above());

CREATE POLICY "Accountants can delete expenses"
  ON expenses FOR DELETE
  USING (is_accountant_or_above());

-- =====================================================
-- FIXED ASSETS POLICIES
-- =====================================================

CREATE POLICY "Users with financial access can view asset categories"
  ON asset_categories FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage asset categories"
  ON asset_categories FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Users with financial access can view fixed assets"
  ON fixed_assets FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage fixed assets"
  ON fixed_assets FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Users with financial access can view depreciation entries"
  ON depreciation_entries FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage depreciation entries"
  ON depreciation_entries FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- CASH & BANK POLICIES
-- =====================================================

CREATE POLICY "Users with financial access can view cash accounts"
  ON cash_accounts FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage cash accounts"
  ON cash_accounts FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Users with financial access can view cash transactions"
  ON cash_transactions FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Authenticated users can create cash transactions"
  ON cash_transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage cash transactions"
  ON cash_transactions FOR UPDATE
  USING (is_accountant_or_above());

CREATE POLICY "Users with financial access can view bank accounts"
  ON bank_accounts FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Admins can manage bank accounts"
  ON bank_accounts FOR ALL
  USING (is_admin());

CREATE POLICY "Users with financial access can view bank statements"
  ON bank_statements FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage bank statements"
  ON bank_statements FOR ALL
  USING (is_accountant_or_above());

CREATE POLICY "Users with financial access can view bank transactions"
  ON bank_transactions FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage bank transactions"
  ON bank_transactions FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- EXCHANGE RATES POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view exchange rates"
  ON exchange_rates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Accountants can manage exchange rates"
  ON exchange_rates FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- RECURRING TRANSACTIONS POLICIES
-- =====================================================

CREATE POLICY "Users with financial access can view recurring transactions"
  ON recurring_transactions FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Accountants can manage recurring transactions"
  ON recurring_transactions FOR ALL
  USING (is_accountant_or_above());

-- =====================================================
-- BUDGETS POLICIES
-- =====================================================

CREATE POLICY "Users with financial access can view budgets"
  ON budgets FOR SELECT
  USING (can_view_financials());

CREATE POLICY "Managers and above can manage budgets"
  ON budgets FOR ALL
  USING (get_user_role() IN ('admin', 'accountant', 'manager'));

-- =====================================================
-- ACTIVITY LOGS POLICIES
-- =====================================================

CREATE POLICY "Admins and auditors can view all activity logs"
  ON activity_logs FOR SELECT
  USING (get_user_role() IN ('admin', 'auditor'));

CREATE POLICY "Users can view their own activity"
  ON activity_logs FOR SELECT
  USING (user_id = auth.uid());

-- Activity logs are insert-only via triggers
CREATE POLICY "System can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- ALERTS POLICIES
-- =====================================================

CREATE POLICY "Users can view their own alerts"
  ON alerts FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own alerts"
  ON alerts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create alerts"
  ON alerts FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- PROJECTS POLICIES
-- =====================================================

CREATE POLICY "Authenticated users can view projects"
  ON projects FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can manage projects"
  ON projects FOR ALL
  USING (get_user_role() IN ('admin', 'accountant', 'manager'));
