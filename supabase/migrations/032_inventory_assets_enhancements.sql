-- =====================================================
-- INVENTORY & FIXED ASSETS COMPREHENSIVE ENHANCEMENTS
-- Migration 032
-- =====================================================

-- =====================================================
-- 1. MULTI-LOCATION INVENTORY SUPPORT
-- =====================================================

-- Create inventory_locations table
CREATE TABLE IF NOT EXISTS inventory_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'warehouse', -- warehouse, store, office, vehicle
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Uganda',
  phone VARCHAR(50),
  manager_id UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_code ON inventory_locations(location_code);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_active ON inventory_locations(is_active);

-- Inventory by location
CREATE TABLE IF NOT EXISTS inventory_by_location (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  quantity_on_hand DECIMAL(15,4) DEFAULT 0,
  quantity_reserved DECIMAL(15,4) DEFAULT 0,
  quantity_available DECIMAL(15,4) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  min_quantity DECIMAL(15,4), -- Location-specific minimum
  max_quantity DECIMAL(15,4), -- Location-specific maximum
  bin_location VARCHAR(100), -- Warehouse bin/shelf location
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_location_product ON inventory_by_location(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location_location ON inventory_by_location(location_id);

-- Inventory transfers between locations
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number VARCHAR(50) NOT NULL UNIQUE,
  product_id UUID NOT NULL REFERENCES products(id),
  from_location_id UUID NOT NULL REFERENCES inventory_locations(id),
  to_location_id UUID NOT NULL REFERENCES inventory_locations(id),
  quantity DECIMAL(15,4) NOT NULL,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'pending',
  requested_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  completed_by UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_transfer_status CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_transfers_from ON inventory_transfers(from_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON inventory_transfers(to_location_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON inventory_transfers(status);

-- =====================================================
-- 2. PRODUCT BUNDLING / KITS
-- =====================================================

CREATE TABLE IF NOT EXISTS product_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bundle_product_id, component_product_id)
);

CREATE INDEX IF NOT EXISTS idx_bundles_bundle ON product_bundles(bundle_product_id);
CREATE INDEX IF NOT EXISTS idx_bundles_component ON product_bundles(component_product_id);

COMMENT ON TABLE product_bundles IS 'Product kits/bundles - define which components make up a bundle product';

-- =====================================================
-- 3. REORDER ALERTS & NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES inventory_locations(id),
  alert_type VARCHAR(50) NOT NULL, -- low_stock, out_of_stock, overstock, expiring
  alert_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quantity_on_hand DECIMAL(15,4),
  reorder_point DECIMAL(15,4),
  message TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_product ON inventory_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON inventory_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_date ON inventory_alerts(alert_date);

-- =====================================================
-- 4. STOCK TAKES / CYCLE COUNTS
-- =====================================================

-- Drop and recreate stock_takes with correct schema
DROP TABLE IF EXISTS stock_take_lines CASCADE;
DROP TABLE IF EXISTS stock_takes CASCADE;

CREATE TABLE stock_takes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number VARCHAR(50) NOT NULL UNIQUE,
  location_id UUID REFERENCES inventory_locations(id),
  stock_take_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'draft',
  type VARCHAR(20) DEFAULT 'full',
  counted_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_stock_take_status CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT chk_stock_take_type CHECK (type IN ('full', 'cycle', 'spot'))
);

CREATE INDEX idx_stock_takes_location ON stock_takes(location_id);
CREATE INDEX idx_stock_takes_status ON stock_takes(status);

CREATE TABLE stock_take_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  expected_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  counted_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  variance DECIMAL(15,4) GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_take_lines_take ON stock_take_lines(stock_take_id);
CREATE INDEX idx_stock_take_lines_product ON stock_take_lines(product_id);

-- =====================================================
-- 5. ASSET ASSIGNMENTS / CUSTODY
-- =====================================================

-- Drop and recreate asset_assignments with correct schema
DROP TABLE IF EXISTS asset_assignments CASCADE;

CREATE TABLE asset_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  return_date DATE,
  status VARCHAR(20) DEFAULT 'assigned',
  condition_at_assignment VARCHAR(50),
  condition_at_return VARCHAR(50),
  notes TEXT,
  return_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_assignment_status CHECK (status IN ('assigned', 'returned'))
);

CREATE INDEX idx_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX idx_assignments_employee ON asset_assignments(employee_id);
CREATE INDEX idx_assignments_status ON asset_assignments(status);

-- =====================================================
-- 6. ASSET MAINTENANCE TRACKING
-- =====================================================

-- Drop and recreate asset_maintenance table with correct schema
DROP TABLE IF EXISTS asset_maintenance CASCADE;

CREATE TABLE asset_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(50) NOT NULL,
  scheduled_date DATE NOT NULL,
  performed_date DATE,
  performed_by_employee_id UUID REFERENCES employees(id),
  performed_by_vendor VARCHAR(255),
  cost DECIMAL(15,2),
  description TEXT NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'scheduled',
  next_maintenance_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_maintenance_status CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT chk_maintenance_type CHECK (maintenance_type IN ('preventive', 'corrective', 'inspection', 'calibration'))
);

CREATE INDEX idx_maintenance_asset ON asset_maintenance(asset_id);
CREATE INDEX idx_maintenance_date ON asset_maintenance(scheduled_date);
CREATE INDEX idx_maintenance_status ON asset_maintenance(status);

-- Service contracts for assets
CREATE TABLE IF NOT EXISTS asset_service_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_number VARCHAR(50) NOT NULL UNIQUE,
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  contract_type VARCHAR(50) DEFAULT 'maintenance', -- maintenance, warranty, insurance
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  annual_cost DECIMAL(15,2),
  currency CHAR(3) DEFAULT 'USD',
  payment_frequency VARCHAR(20), -- monthly, quarterly, annually
  coverage_details TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_asset ON asset_service_contracts(asset_id);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON asset_service_contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_active ON asset_service_contracts(is_active);

-- =====================================================
-- 7. ASSET INSURANCE TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_insurance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_number VARCHAR(100) NOT NULL UNIQUE,
  asset_id UUID REFERENCES fixed_assets(id) ON DELETE SET NULL,
  asset_category_id UUID REFERENCES asset_categories(id), -- Can insure by category
  insurance_provider VARCHAR(255) NOT NULL,
  policy_type VARCHAR(50) DEFAULT 'comprehensive', -- comprehensive, fire, theft, etc
  coverage_amount DECIMAL(15,2) NOT NULL,
  premium_amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_frequency VARCHAR(20) DEFAULT 'annually',
  deductible DECIMAL(15,2),
  beneficiary VARCHAR(255),
  agent_name VARCHAR(255),
  agent_contact VARCHAR(100),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_asset ON asset_insurance(asset_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policy ON asset_insurance(policy_number);
CREATE INDEX IF NOT EXISTS idx_insurance_active ON asset_insurance(is_active);

-- =====================================================
-- 8. ASSET IMPAIRMENT TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_impairments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  impairment_date DATE NOT NULL,
  carrying_amount DECIMAL(15,2) NOT NULL,
  recoverable_amount DECIMAL(15,2) NOT NULL,
  impairment_loss DECIMAL(15,2) GENERATED ALWAYS AS (carrying_amount - recoverable_amount) STORED,
  reason TEXT NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  is_reversal BOOLEAN DEFAULT false,
  reversal_of_id UUID REFERENCES asset_impairments(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impairments_asset ON asset_impairments(asset_id);
CREATE INDEX IF NOT EXISTS idx_impairments_date ON asset_impairments(impairment_date);

-- =====================================================
-- 9. ASSET REVALUATION
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_revaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  revaluation_date DATE NOT NULL,
  carrying_amount DECIMAL(15,2) NOT NULL,
  fair_value DECIMAL(15,2) NOT NULL,
  revaluation_surplus DECIMAL(15,2) GENERATED ALWAYS AS (fair_value - carrying_amount) STORED,
  valuer_name VARCHAR(255),
  valuation_method VARCHAR(100), -- market, income, cost approach
  notes TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revaluations_asset ON asset_revaluations(asset_id);
CREATE INDEX IF NOT EXISTS idx_revaluations_date ON asset_revaluations(revaluation_date);

-- =====================================================
-- 10. PRODUCT IMAGES & ATTACHMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_name VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

CREATE TABLE IF NOT EXISTS asset_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50), -- invoice, warranty, manual, photo, certificate
  file_size BIGINT,
  uploaded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_attachments_asset ON asset_attachments(asset_id);

-- =====================================================
-- 11. BARCODE GENERATION
-- =====================================================

-- Add barcode field to products if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'barcode') THEN
    ALTER TABLE products ADD COLUMN barcode VARCHAR(100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Add barcode field to fixed assets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'barcode') THEN
    ALTER TABLE fixed_assets ADD COLUMN barcode VARCHAR(100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assets_barcode ON fixed_assets(barcode);

-- =====================================================
-- 12. ENHANCED PRODUCT FIELDS
-- =====================================================

DO $$
BEGIN
  -- Add weight/dimensions for shipping
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'weight') THEN
    ALTER TABLE products ADD COLUMN weight DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'weight_unit') THEN
    ALTER TABLE products ADD COLUMN weight_unit VARCHAR(10) DEFAULT 'kg';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'length') THEN
    ALTER TABLE products ADD COLUMN length DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'width') THEN
    ALTER TABLE products ADD COLUMN width DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'height') THEN
    ALTER TABLE products ADD COLUMN height DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'dimension_unit') THEN
    ALTER TABLE products ADD COLUMN dimension_unit VARCHAR(10) DEFAULT 'cm';
  END IF;
  
  -- Add manufacturer/brand fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'manufacturer') THEN
    ALTER TABLE products ADD COLUMN manufacturer VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'brand') THEN
    ALTER TABLE products ADD COLUMN brand VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'model_number') THEN
    ALTER TABLE products ADD COLUMN model_number VARCHAR(100);
  END IF;
END $$;

-- =====================================================
-- 13. ENHANCED ASSET FIELDS
-- =====================================================

DO $$
BEGIN
  -- Add warranty fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'warranty_expiry_date') THEN
    ALTER TABLE fixed_assets ADD COLUMN warranty_expiry_date DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'warranty_provider') THEN
    ALTER TABLE fixed_assets ADD COLUMN warranty_provider VARCHAR(255);
  END IF;
  
  -- Add manufacturer fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'manufacturer') THEN
    ALTER TABLE fixed_assets ADD COLUMN manufacturer VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'model') THEN
    ALTER TABLE fixed_assets ADD COLUMN model VARCHAR(100);
  END IF;
  
  -- Add current location field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fixed_assets' AND column_name = 'current_location_id') THEN
    ALTER TABLE fixed_assets ADD COLUMN current_location_id UUID REFERENCES inventory_locations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assets_location ON fixed_assets(current_location_id);

-- =====================================================
-- 14. DEPRECIATION SCHEDULES
-- =====================================================

CREATE TABLE IF NOT EXISTS depreciation_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  depreciation_amount DECIMAL(15,2) NOT NULL,
  accumulated_depreciation DECIMAL(15,2) NOT NULL,
  book_value DECIMAL(15,2) NOT NULL,
  is_posted BOOLEAN DEFAULT false,
  posted_at TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, period_date)
);

CREATE INDEX IF NOT EXISTS idx_depreciation_schedules_asset ON depreciation_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_schedules_date ON depreciation_schedules(period_date);
CREATE INDEX IF NOT EXISTS idx_depreciation_schedules_posted ON depreciation_schedules(is_posted);

-- =====================================================
-- 15. SEED DEFAULT LOCATION
-- =====================================================

INSERT INTO inventory_locations (location_code, name, type, city, country)
VALUES ('MAIN', 'Main Warehouse', 'warehouse', 'Kampala', 'Uganda')
ON CONFLICT (location_code) DO NOTHING;

-- =====================================================
-- 16. UPDATE INVENTORY MOVEMENTS FOR LOCATIONS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'inventory_movements' AND column_name = 'from_location_id') THEN
    ALTER TABLE inventory_movements ADD COLUMN from_location_id UUID REFERENCES inventory_locations(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'inventory_movements' AND column_name = 'to_location_id') THEN
    ALTER TABLE inventory_movements ADD COLUMN to_location_id UUID REFERENCES inventory_locations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_movements_from_location ON inventory_movements(from_location_id);
CREATE INDEX IF NOT EXISTS idx_movements_to_location ON inventory_movements(to_location_id);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE inventory_locations IS 'Physical locations for inventory tracking (warehouses, stores, offices)';
COMMENT ON TABLE inventory_by_location IS 'Track inventory quantities at each location';
COMMENT ON TABLE inventory_transfers IS 'Track movement of inventory between locations';
COMMENT ON TABLE product_bundles IS 'Product kits - define components that make up bundle products';
COMMENT ON TABLE inventory_alerts IS 'Automatic alerts for low stock, out of stock, overstock conditions';
COMMENT ON TABLE stock_takes IS 'Physical inventory counts and cycle counts';
COMMENT ON TABLE stock_take_lines IS 'Individual product counts in stock takes with variance tracking';
COMMENT ON TABLE asset_assignments IS 'Track which employee or department has custody of an asset';
COMMENT ON TABLE asset_maintenance IS 'Scheduled and corrective maintenance records for assets';
COMMENT ON TABLE asset_service_contracts IS 'Maintenance contracts, warranties, and service agreements';
COMMENT ON TABLE asset_insurance IS 'Insurance policies covering fixed assets';
COMMENT ON TABLE asset_impairments IS 'Record asset impairment losses and reversals';
COMMENT ON TABLE asset_revaluations IS 'Track asset revaluations to fair value';
COMMENT ON TABLE depreciation_schedules IS 'Pre-calculated depreciation schedule for each asset';
