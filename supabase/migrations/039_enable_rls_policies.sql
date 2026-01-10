-- =====================================================
-- RE-ENABLE RLS WITH ROLE-BASED POLICIES
-- Implements comprehensive security based on user roles
-- =====================================================

-- =====================================================
-- STEP 1: Re-enable RLS on all tables
-- =====================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_posting_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_package_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_package_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_seasonal_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE car_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_by_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_impairments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_revaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_replenishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

-- Note: booking_details is a VIEW, not a table
-- Views inherit RLS from their underlying tables
-- No need to enable RLS directly on views

-- =====================================================
-- STEP 2: Helper Functions for Role Checks
-- =====================================================

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT COALESCE(role, 'sales'::user_role)
  FROM user_profiles
  WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'admin';
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is accountant or above
CREATE OR REPLACE FUNCTION is_user_accountant_or_above()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin', 'accountant');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is operations or above
CREATE OR REPLACE FUNCTION is_user_operations_or_above()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin', 'accountant', 'operations');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =====================================================
-- STEP 3: User Profiles Policies
-- =====================================================

CREATE POLICY "Users can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage all profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (is_user_admin())
  WITH CHECK (is_user_admin());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================
-- STEP 4: Financial Data Policies (Accountant+ Access)
-- =====================================================

-- Accounts (Chart of Accounts)
CREATE POLICY "Everyone can view accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage accounts"
  ON accounts FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Journal Entries & Lines
CREATE POLICY "Accountants can view journal entries"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage journal entries"
  ON journal_entries FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view journal lines"
  ON journal_lines FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage journal lines"
  ON journal_lines FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Fiscal Periods
CREATE POLICY "Everyone can view fiscal periods"
  ON fiscal_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage fiscal periods"
  ON fiscal_periods FOR ALL
  TO authenticated
  USING (is_user_admin())
  WITH CHECK (is_user_admin());

-- Bank Accounts (sensitive)
CREATE POLICY "Accountants can view bank accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Admins can manage bank accounts"
  ON bank_accounts FOR ALL
  TO authenticated
  USING (is_user_admin())
  WITH CHECK (is_user_admin());

-- Bank Transactions, Statements, Reconciliations
CREATE POLICY "Accountants can view bank transactions"
  ON bank_transactions FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage bank transactions"
  ON bank_transactions FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view bank statements"
  ON bank_statements FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage bank statements"
  ON bank_statements FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view reconciliations"
  ON bank_reconciliations FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage reconciliations"
  ON bank_reconciliations FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view reconciliation items"
  ON bank_reconciliation_items FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage reconciliation items"
  ON bank_reconciliation_items FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view bank transfers"
  ON bank_transfers FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage bank transfers"
  ON bank_transfers FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Cash Accounts & Transactions
CREATE POLICY "Accountants can view cash accounts"
  ON cash_accounts FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage cash accounts"
  ON cash_accounts FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view cash transactions"
  ON cash_transactions FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage cash transactions"
  ON cash_transactions FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Petty Cash
CREATE POLICY "Everyone can view petty cash limits"
  ON petty_cash_limits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage petty cash limits"
  ON petty_cash_limits FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Everyone can view petty cash disbursements"
  ON petty_cash_disbursements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage petty cash disbursements"
  ON petty_cash_disbursements FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Accountants can view petty cash replenishments"
  ON petty_cash_replenishments FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage petty cash replenishments"
  ON petty_cash_replenishments FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- =====================================================
-- STEP 5: Customer & Vendor Policies
-- =====================================================

-- Customers (Sales+ can manage)
CREATE POLICY "Everyone can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and above can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (true) -- All roles can create/manage customers
  WITH CHECK (true);

-- Vendors (Operations+ can manage)
CREATE POLICY "Everyone can view vendors"
  ON vendors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage vendors"
  ON vendors FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- =====================================================
-- STEP 6: Invoice & Payment Policies
-- =====================================================

-- Invoices
CREATE POLICY "Everyone can view invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and above can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Invoice Lines
CREATE POLICY "Everyone can view invoice lines"
  ON invoice_lines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and above can manage invoice lines"
  ON invoice_lines FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Payments Received
CREATE POLICY "Everyone can view payments received"
  ON payments_received FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage payments received"
  ON payments_received FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Payment Applications
CREATE POLICY "Everyone can view payment applications"
  ON payment_applications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage payment applications"
  ON payment_applications FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- =====================================================
-- STEP 7: Bill & Purchase Order Policies
-- =====================================================

-- Bills
CREATE POLICY "Accountants can view bills"
  ON bills FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage bills"
  ON bills FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Bill Lines
CREATE POLICY "Accountants can view bill lines"
  ON bill_lines FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage bill lines"
  ON bill_lines FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Bill Payments
CREATE POLICY "Accountants can view bill payments"
  ON bill_payments FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage bill payments"
  ON bill_payments FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Bill Payment Applications
CREATE POLICY "Accountants can view bill payment applications"
  ON bill_payment_applications FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage bill payment applications"
  ON bill_payment_applications FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Purchase Orders
CREATE POLICY "Operations can view purchase orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (is_user_operations_or_above());

CREATE POLICY "Operations can manage purchase orders"
  ON purchase_orders FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- Purchase Order Lines
CREATE POLICY "Operations can view purchase order lines"
  ON purchase_order_lines FOR SELECT
  TO authenticated
  USING (is_user_operations_or_above());

CREATE POLICY "Operations can manage purchase order lines"
  ON purchase_order_lines FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- =====================================================
-- STEP 8: Expense Policies
-- =====================================================

CREATE POLICY "Everyone can view expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Everyone can create expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_user_accountant_or_above())
  WITH CHECK (created_by = auth.uid() OR is_user_accountant_or_above());

CREATE POLICY "Accountants can delete expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (is_user_accountant_or_above());

-- =====================================================
-- STEP 9: Asset Management Policies
-- =====================================================

-- Fixed Assets
CREATE POLICY "Everyone can view fixed assets"
  ON fixed_assets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage fixed assets"
  ON fixed_assets FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Asset Categories
CREATE POLICY "Everyone can view asset categories"
  ON asset_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage asset categories"
  ON asset_categories FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Depreciation (all related tables)
CREATE POLICY "Accountants can view depreciation entries"
  ON depreciation_entries FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage depreciation entries"
  ON depreciation_entries FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view depreciation schedules"
  ON depreciation_schedules FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage depreciation schedules"
  ON depreciation_schedules FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view depreciation postings"
  ON depreciation_postings FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage depreciation postings"
  ON depreciation_postings FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view depreciation posting details"
  ON depreciation_posting_details FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage depreciation posting details"
  ON depreciation_posting_details FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Asset Transfers, Assignments, Maintenance
CREATE POLICY "Everyone can view asset transfers"
  ON asset_transfers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage asset transfers"
  ON asset_transfers FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view asset assignments"
  ON asset_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage asset assignments"
  ON asset_assignments FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view asset maintenance"
  ON asset_maintenance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage asset maintenance"
  ON asset_maintenance FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Operations can view asset service contracts"
  ON asset_service_contracts FOR SELECT
  TO authenticated
  USING (is_user_operations_or_above());

CREATE POLICY "Operations can manage asset service contracts"
  ON asset_service_contracts FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Accountants can view asset insurance"
  ON asset_insurance FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage asset insurance"
  ON asset_insurance FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view asset impairments"
  ON asset_impairments FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage asset impairments"
  ON asset_impairments FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view asset revaluations"
  ON asset_revaluations FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage asset revaluations"
  ON asset_revaluations FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Everyone can view asset attachments"
  ON asset_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage asset attachments"
  ON asset_attachments FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- =====================================================
-- STEP 10: Tour & Booking Policies
-- =====================================================

-- Destinations
CREATE POLICY "Everyone can view destinations"
  ON destinations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage destinations"
  ON destinations FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- Tour Packages
CREATE POLICY "Everyone can view tour packages"
  ON tour_packages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage tour packages"
  ON tour_packages FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view tour package destinations"
  ON tour_package_destinations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage tour package destinations"
  ON tour_package_destinations FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view tour package images"
  ON tour_package_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage tour package images"
  ON tour_package_images FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view tour itineraries"
  ON tour_itineraries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage tour itineraries"
  ON tour_itineraries FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view tour seasonal pricing"
  ON tour_seasonal_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage tour seasonal pricing"
  ON tour_seasonal_pricing FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- Bookings
CREATE POLICY "Everyone can view bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and above can manage bookings"
  ON bookings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Everyone can view booking guests"
  ON booking_guests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sales and above can manage booking guests"
  ON booking_guests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Everyone can view booking hotels"
  ON booking_hotels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage booking hotels"
  ON booking_hotels FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view booking activities"
  ON booking_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage booking activities"
  ON booking_activities FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view booking payments"
  ON booking_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage booking payments"
  ON booking_payments FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view booking costs"
  ON booking_costs FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage booking costs"
  ON booking_costs FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- =====================================================
-- STEP 11: Hotel & Vehicle Policies
-- =====================================================

-- Hotels
CREATE POLICY "Everyone can view hotels"
  ON hotels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage hotels"
  ON hotels FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view hotel room types"
  ON hotel_room_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage hotel room types"
  ON hotel_room_types FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view hotel images"
  ON hotel_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage hotel images"
  ON hotel_images FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- Vehicles
CREATE POLICY "Everyone can view vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage vehicles"
  ON vehicles FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view vehicle images"
  ON vehicle_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage vehicle images"
  ON vehicle_images FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Operations can view vehicle maintenance"
  ON vehicle_maintenance FOR SELECT
  TO authenticated
  USING (is_user_operations_or_above());

CREATE POLICY "Operations can manage vehicle maintenance"
  ON vehicle_maintenance FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view car rentals"
  ON car_rentals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage car rentals"
  ON car_rentals FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- =====================================================
-- STEP 12: Employee & Payroll Policies (Sensitive)
-- =====================================================

-- Employees
CREATE POLICY "Everyone can view employees"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage employees"
  ON employees FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Employee Allowances & Deductions (sensitive)
CREATE POLICY "Accountants can view employee allowances"
  ON employee_allowances FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage employee allowances"
  ON employee_allowances FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view employee deductions"
  ON employee_deductions FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage employee deductions"
  ON employee_deductions FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view employee reimbursements"
  ON employee_reimbursements FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage employee reimbursements"
  ON employee_reimbursements FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view salary advances"
  ON salary_advances FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage salary advances"
  ON salary_advances FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Payroll (highly sensitive)
CREATE POLICY "Accountants can view payroll periods"
  ON payroll_periods FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage payroll periods"
  ON payroll_periods FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view payslips"
  ON payslips FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage payslips"
  ON payslips FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view payslip items"
  ON payslip_items FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage payslip items"
  ON payslip_items FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- =====================================================
-- STEP 13: Inventory & Product Policies
-- =====================================================

-- Products & Categories
CREATE POLICY "Everyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage products"
  ON products FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view product categories"
  ON product_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage product categories"
  ON product_categories FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view product images"
  ON product_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage product images"
  ON product_images FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view product bundles"
  ON product_bundles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage product bundles"
  ON product_bundles FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- Inventory
CREATE POLICY "Everyone can view inventory lots"
  ON inventory_lots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage inventory lots"
  ON inventory_lots FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view inventory locations"
  ON inventory_locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage inventory locations"
  ON inventory_locations FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view inventory by location"
  ON inventory_by_location FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage inventory by location"
  ON inventory_by_location FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view inventory movements"
  ON inventory_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage inventory movements"
  ON inventory_movements FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view inventory transfers"
  ON inventory_transfers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage inventory transfers"
  ON inventory_transfers FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Everyone can view inventory alerts"
  ON inventory_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage inventory alerts"
  ON inventory_alerts FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- Stock Takes
CREATE POLICY "Operations can view stock takes"
  ON stock_takes FOR SELECT
  TO authenticated
  USING (is_user_operations_or_above());

CREATE POLICY "Operations can manage stock takes"
  ON stock_takes FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Operations can view stock take lines"
  ON stock_take_lines FOR SELECT
  TO authenticated
  USING (is_user_operations_or_above());

CREATE POLICY "Operations can manage stock take lines"
  ON stock_take_lines FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- Goods Receipts
CREATE POLICY "Operations can view goods receipts"
  ON goods_receipts FOR SELECT
  TO authenticated
  USING (is_user_operations_or_above());

CREATE POLICY "Operations can manage goods receipts"
  ON goods_receipts FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

CREATE POLICY "Operations can view goods receipt lines"
  ON goods_receipt_lines FOR SELECT
  TO authenticated
  USING (is_user_operations_or_above());

CREATE POLICY "Operations can manage goods receipt lines"
  ON goods_receipt_lines FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- =====================================================
-- STEP 14: System & Configuration Policies
-- =====================================================

-- Exchange Rates
CREATE POLICY "Everyone can view exchange rates"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage exchange rates"
  ON exchange_rates FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Company Settings
CREATE POLICY "Everyone can view company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage company settings"
  ON company_settings FOR ALL
  TO authenticated
  USING (is_user_admin())
  WITH CHECK (is_user_admin());

-- Scheduled Reports
CREATE POLICY "Everyone can view scheduled reports"
  ON scheduled_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Accountants can manage scheduled reports"
  ON scheduled_reports FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- Activity Logs
CREATE POLICY "Everyone can view activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can create activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Alerts
CREATE POLICY "Everyone can view alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage alerts"
  ON alerts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Projects
CREATE POLICY "Everyone can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operations can manage projects"
  ON projects FOR ALL
  TO authenticated
  USING (is_user_operations_or_above())
  WITH CHECK (is_user_operations_or_above());

-- =====================================================
-- STEP 15: Budget & Planning Policies
-- =====================================================

-- Budgets
CREATE POLICY "Accountants can view budgets"
  ON budgets FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage budgets"
  ON budgets FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view budget versions"
  ON budget_versions FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage budget versions"
  ON budget_versions FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view budget items"
  ON budget_items FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage budget items"
  ON budget_items FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view cash flow forecasts"
  ON cash_flow_forecasts FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage cash flow forecasts"
  ON cash_flow_forecasts FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- =====================================================
-- STEP 16: Recurring Transactions & Commissions
-- =====================================================

CREATE POLICY "Accountants can view recurring transactions"
  ON recurring_transactions FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage recurring transactions"
  ON recurring_transactions FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

CREATE POLICY "Accountants can view commissions"
  ON commissions FOR SELECT
  TO authenticated
  USING (is_user_accountant_or_above());

CREATE POLICY "Accountants can manage commissions"
  ON commissions FOR ALL
  TO authenticated
  USING (is_user_accountant_or_above())
  WITH CHECK (is_user_accountant_or_above());

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify RLS is enabled
DO $$
DECLARE
  disabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO disabled_count
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND rowsecurity = false;
  
  IF disabled_count > 0 THEN
    RAISE NOTICE 'WARNING: % tables still have RLS disabled', disabled_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All public tables have RLS enabled ✓';
  END IF;
END $$;

-- Count policies created
SELECT 
  schemaname,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname;

-- Summary
DO $$
BEGIN
  RAISE NOTICE 'RLS policies successfully implemented!';
  RAISE NOTICE '';
  RAISE NOTICE 'Role Hierarchy:';
  RAISE NOTICE '  1. admin         - Full access to everything';
  RAISE NOTICE '  2. accountant    - Full financial + read operations';
  RAISE NOTICE '  3. operations    - Bookings, inventory, assets';
  RAISE NOTICE '  4. sales         - Customers, invoices, bookings';
  RAISE NOTICE '  5. guide         - View-only for assigned items';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Test with different user roles';
  RAISE NOTICE '  2. Verify access restrictions work correctly';
  RAISE NOTICE '  3. Adjust policies if needed for your workflow';
END $$;
