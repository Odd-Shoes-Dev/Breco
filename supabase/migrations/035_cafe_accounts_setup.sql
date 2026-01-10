-- =====================================================
-- CAFE ACCOUNTS SETUP
-- Add cafe-specific revenue and expense accounts
-- =====================================================

-- Cafe Revenue Accounts (4200 range)
INSERT INTO accounts (code, name, account_type, account_subtype, normal_balance, is_system) VALUES
('4200', 'Cafe Revenue', 'revenue', 'sales', 'credit', false),
('4210', 'Cafe - Food Sales', 'revenue', 'sales', 'credit', false),
('4220', 'Cafe - Beverage Sales', 'revenue', 'sales', 'credit', false),
('4230', 'Cafe - Desserts & Snacks', 'revenue', 'sales', 'credit', false)
ON CONFLICT (code) DO NOTHING;

-- Cafe Cost of Goods Sold (5250 range)
INSERT INTO accounts (code, name, account_type, account_subtype, normal_balance, is_system) VALUES
('5250', 'Cafe Cost of Goods Sold', 'expense', 'cost_of_goods', 'debit', false),
('5251', 'Cafe - Food Costs', 'expense', 'cost_of_goods', 'debit', false),
('5252', 'Cafe - Beverage Costs', 'expense', 'cost_of_goods', 'debit', false),
('5253', 'Cafe - Packaging & Supplies', 'expense', 'cost_of_goods', 'debit', false)
ON CONFLICT (code) DO NOTHING;

-- Cafe Operating Expenses (6350 range)
INSERT INTO accounts (code, name, account_type, account_subtype, normal_balance, is_system) VALUES
('6350', 'Cafe Operating Expenses', 'expense', 'operating', 'debit', false),
('6351', 'Cafe - Rent & Utilities', 'expense', 'operating', 'debit', false),
('6352', 'Cafe - Equipment Maintenance', 'expense', 'operating', 'debit', false),
('6353', 'Cafe - Cleaning Supplies', 'expense', 'operating', 'debit', false),
('6354', 'Cafe - Licenses & Permits', 'expense', 'operating', 'debit', false)
ON CONFLICT (code) DO NOTHING;

-- Create a generic "Cafe Daily Sales" customer if not exists
INSERT INTO customers (name, company_name, email, phone, payment_terms, notes)
SELECT 
  'Cafe Daily Sales',
  'Breco Cafe',
  'cafe@brecosafaris.com',
  '+256 700 000000',
  0,
  'Generic customer for recording daily cafe sales revenue'
WHERE NOT EXISTS (
  SELECT 1 FROM customers WHERE name = 'Cafe Daily Sales'
);

-- Add comment explaining cafe setup
COMMENT ON TABLE accounts IS 'Chart of Accounts - Cafe accounts added in range 4200-4299 for revenue, 5250-5259 for COGS, and 6350-6359 for operating expenses';
