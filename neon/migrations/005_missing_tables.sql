-- =====================================================
-- BRECO SAFARIS LTD - MISSING TABLES
-- Neon Migration 005
-- Creates asset_maintenance, asset_assignments, and commissions tables
-- =====================================================

-- Asset Maintenance
CREATE TABLE IF NOT EXISTS asset_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id),
  maintenance_type VARCHAR(100) NOT NULL,
  scheduled_date DATE NOT NULL,
  performed_date DATE,
  performed_by_employee_id UUID REFERENCES employees(id),
  performed_by_vendor VARCHAR(255),
  description TEXT,
  cost DECIMAL(15,2),
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT,
  next_maintenance_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asset_maintenance_asset ON asset_maintenance(asset_id);
CREATE INDEX idx_asset_maintenance_status ON asset_maintenance(status);

-- Asset Assignments
CREATE TABLE IF NOT EXISTS asset_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id),
  assigned_to_employee_id UUID NOT NULL REFERENCES employees(id),
  assigned_date DATE NOT NULL,
  return_date DATE,
  condition_on_assignment VARCHAR(100),
  condition_on_return VARCHAR(100),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'assigned',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asset_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX idx_asset_assignments_employee ON asset_assignments(assigned_to_employee_id);
CREATE INDEX idx_asset_assignments_status ON asset_assignments(status);

-- Commissions
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  booking_id UUID REFERENCES bookings(id),
  commission_type VARCHAR(100),
  amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commissions_employee ON commissions(employee_id);
CREATE INDEX idx_commissions_booking ON commissions(booking_id);
CREATE INDEX idx_commissions_status ON commissions(status);
