-- =====================================================
-- BRECO SAFARIS LTD - FINANCIAL & OPERATIONS SYSTEM
-- Migration: Transform Sceneside system to Breco Safaris
-- Company: Breco Safaris Ltd
-- TIN: 1014756280
-- Reg No: 80020001634842
-- Address: Buzzi Close Kajjansi, Entebbe Road, P.O. Box 1440011, Kampala Uganda
-- =====================================================

-- =====================================================
-- STEP 1: UPDATE COMPANY SETTINGS
-- =====================================================

UPDATE company_settings SET
  name = 'Breco Safaris Ltd',
  legal_name = 'Breco Safaris Ltd',
  ein = '1014756280',
  address_line1 = 'Buzzi Close Kajjansi',
  address_line2 = 'Entebbe Road',
  city = 'Kampala',
  state = NULL,
  zip_code = 'P.O. Box 1440011',
  country = 'Uganda',
  phone = '+256 782 884 933',
  email = 'brecosafaris@gmail.com',
  website = 'www.brecosafaris.com',
  logo_url = '/assets/logo.jpg',
  base_currency = 'UGX',
  fiscal_year_start_month = 1,
  sales_tax_rate = 0.18, -- 18% VAT in Uganda
  updated_at = NOW()
WHERE id IS NOT NULL;

-- =====================================================
-- STEP 2: UPDATE ENUMS
-- =====================================================

-- Add petty_cash to payment methods
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'petty_cash';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'mobile_money';

-- Create new user role type for tour company
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_new') THEN
    CREATE TYPE user_role_new AS ENUM ('admin', 'accountant', 'operations', 'guide');
  END IF;
END $$;

-- Create booking status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM (
      'inquiry',
      'quote_sent', 
      'confirmed',
      'deposit_paid',
      'fully_paid',
      'in_progress',
      'completed',
      'cancelled',
      'refunded'
    );
  END IF;
END $$;

-- Create vehicle status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_status') THEN
    CREATE TYPE vehicle_status AS ENUM (
      'available',
      'booked',
      'in_use',
      'maintenance',
      'out_of_service'
    );
  END IF;
END $$;

-- Create payroll frequency enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pay_frequency') THEN
    CREATE TYPE pay_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
  END IF;
END $$;

-- Create payroll status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_status') THEN
    CREATE TYPE payroll_status AS ENUM ('draft', 'pending_approval', 'approved', 'paid', 'void');
  END IF;
END $$;

-- Create asset type enum for tour company
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tour_asset_type') THEN
    CREATE TYPE tour_asset_type AS ENUM (
      'vehicle',
      'equipment',
      'property',
      'furniture',
      'electronics',
      'camping_gear',
      'boat',
      'other'
    );
  END IF;
END $$;

-- =====================================================
-- STEP 3: DESTINATIONS & LOCATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Uganda',
  region VARCHAR(100),
  description TEXT,
  highlights TEXT[], -- Array of highlights
  best_time_to_visit VARCHAR(255),
  typical_duration_days INT,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_destinations_country ON destinations(country);
CREATE INDEX IF NOT EXISTS idx_destinations_active ON destinations(is_active);

-- =====================================================
-- STEP 4: TOUR PACKAGES & ITINERARIES
-- =====================================================

CREATE TABLE IF NOT EXISTS tour_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_days INT NOT NULL,
  duration_nights INT NOT NULL,
  
  -- Pricing (base prices - can vary by season/group size)
  base_price_usd DECIMAL(15,2) NOT NULL DEFAULT 0,
  base_price_eur DECIMAL(15,2) DEFAULT 0,
  base_price_ugx DECIMAL(15,2) DEFAULT 0,
  price_per_person BOOLEAN DEFAULT true, -- false = group price
  min_group_size INT DEFAULT 1,
  max_group_size INT DEFAULT 20,
  
  -- Details
  tour_type VARCHAR(100), -- Safari, Gorilla Trekking, Cultural, Adventure, etc.
  difficulty_level VARCHAR(50) DEFAULT 'moderate', -- easy, moderate, challenging
  inclusions TEXT,
  exclusions TEXT,
  
  -- Destinations visited (primary destination)
  primary_destination_id UUID REFERENCES destinations(id),
  
  image_url VARCHAR(500),
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_packages_code ON tour_packages(package_code);
CREATE INDEX IF NOT EXISTS idx_tour_packages_type ON tour_packages(tour_type);
CREATE INDEX IF NOT EXISTS idx_tour_packages_active ON tour_packages(is_active);

-- Tour package destinations (many-to-many)
CREATE TABLE IF NOT EXISTS tour_package_destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES destinations(id),
  visit_order INT NOT NULL DEFAULT 1,
  nights_stay INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tour_package_id, destination_id)
);

-- Daily itinerary for tour packages
CREATE TABLE IF NOT EXISTS tour_itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  activities TEXT[], -- Array of activities
  meals_included VARCHAR(50), -- 'B,L,D' for Breakfast, Lunch, Dinner
  accommodation VARCHAR(255),
  destination_id UUID REFERENCES destinations(id),
  distance_km DECIMAL(10,2),
  driving_hours DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tour_package_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_tour_itineraries_package ON tour_itineraries(tour_package_id);

-- Seasonal pricing for tours
CREATE TABLE IF NOT EXISTS tour_seasonal_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_package_id UUID NOT NULL REFERENCES tour_packages(id) ON DELETE CASCADE,
  season_name VARCHAR(100) NOT NULL, -- 'High Season', 'Low Season', 'Peak Season'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_adjustment_percent DECIMAL(5,2) DEFAULT 0, -- +20% or -10%
  price_adjustment_fixed_usd DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_season_dates CHECK (end_date >= start_date)
);

-- =====================================================
-- STEP 5: PARTNER HOTELS
-- =====================================================

CREATE TABLE IF NOT EXISTS hotels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  destination_id UUID REFERENCES destinations(id),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  
  -- Classification
  star_rating INT CHECK (star_rating >= 1 AND star_rating <= 5),
  hotel_type VARCHAR(100), -- Lodge, Hotel, Camp, Guesthouse, etc.
  
  -- Rates (rack rates - negotiated rates may differ)
  standard_rate_usd DECIMAL(15,2),
  deluxe_rate_usd DECIMAL(15,2),
  suite_rate_usd DECIMAL(15,2),
  
  -- Contact person
  contact_person VARCHAR(255),
  contact_phone VARCHAR(50),
  
  -- Commission
  commission_rate DECIMAL(5,2) DEFAULT 10, -- 10% commission
  
  notes TEXT,
  is_partner BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotels_destination ON hotels(destination_id);
CREATE INDEX IF NOT EXISTS idx_hotels_active ON hotels(is_active);

-- Room types for hotels
CREATE TABLE IF NOT EXISTS hotel_room_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- Standard, Deluxe, Suite, Family, etc.
  description TEXT,
  max_occupancy INT DEFAULT 2,
  rate_usd DECIMAL(15,2) NOT NULL,
  rate_ugx DECIMAL(15,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 6: BOOKINGS SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  
  -- Booking type
  booking_type VARCHAR(50) NOT NULL DEFAULT 'tour', -- 'tour', 'hotel', 'car_hire', 'custom'
  
  -- Tour package (if applicable)
  tour_package_id UUID REFERENCES tour_packages(id),
  
  -- Dates
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  travel_start_date DATE NOT NULL,
  travel_end_date DATE NOT NULL,
  
  -- Group details
  num_adults INT NOT NULL DEFAULT 1,
  num_children INT DEFAULT 0,
  num_infants INT DEFAULT 0,
  
  -- Pricing
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  balance_due DECIMAL(15,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  
  currency CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(12,6) DEFAULT 1.000000,
  
  -- Status
  status booking_status DEFAULT 'inquiry',
  
  -- Special requests
  special_requests TEXT,
  dietary_requirements TEXT,
  
  -- Assignment
  assigned_guide_id UUID REFERENCES user_profiles(id),
  assigned_vehicle_id UUID,
  
  -- Reference
  invoice_id UUID REFERENCES invoices(id),
  quotation_id UUID REFERENCES invoices(id),
  
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_travel_dates CHECK (travel_end_date >= travel_start_date)
);

CREATE INDEX IF NOT EXISTS idx_bookings_number ON bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(travel_start_date, travel_end_date);

-- Booking guests/travelers
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

CREATE INDEX IF NOT EXISTS idx_booking_guests_booking ON booking_guests(booking_id);

-- Booking hotel reservations
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_hotel_dates CHECK (check_out_date > check_in_date)
);

-- Booking activities/add-ons
CREATE TABLE IF NOT EXISTS booking_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  activity_name VARCHAR(255) NOT NULL,
  description TEXT,
  num_participants INT DEFAULT 1,
  unit_cost DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  permit_number VARCHAR(100), -- e.g., Gorilla permit number
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking payments (links to existing payments_received)
CREATE TABLE IF NOT EXISTS booking_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments_received(id),
  amount DECIMAL(15,2) NOT NULL,
  payment_type VARCHAR(50) DEFAULT 'deposit', -- deposit, balance, refund
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 7: FLEET MANAGEMENT (VEHICLES & CAR HIRE)
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_number VARCHAR(50) NOT NULL UNIQUE,
  registration_number VARCHAR(50) NOT NULL UNIQUE,
  
  -- Vehicle details
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INT,
  color VARCHAR(50),
  vehicle_type VARCHAR(100), -- Safari Vehicle, Minibus, Land Cruiser, etc.
  fuel_type VARCHAR(50) DEFAULT 'diesel',
  transmission VARCHAR(50) DEFAULT 'manual',
  
  -- Capacity
  seating_capacity INT NOT NULL DEFAULT 4,
  luggage_capacity VARCHAR(100), -- Description of luggage space
  
  -- Features
  features TEXT[], -- AC, 4WD, Pop-up roof, Fridge, etc.
  
  -- Financials
  purchase_date DATE,
  purchase_price DECIMAL(15,2),
  current_value DECIMAL(15,2),
  insurance_expiry DATE,
  
  -- Rates
  daily_rate_usd DECIMAL(15,2),
  daily_rate_ugx DECIMAL(15,2),
  weekly_rate_usd DECIMAL(15,2),
  mileage_rate DECIMAL(10,2), -- Per km charge
  
  -- Status
  status vehicle_status DEFAULT 'available',
  current_mileage INT DEFAULT 0,
  last_service_date DATE,
  next_service_mileage INT,
  
  -- Location (for US car hire)
  location VARCHAR(100), -- Uganda, USA-NY, USA-CA, etc.
  
  -- Link to fixed assets
  fixed_asset_id UUID REFERENCES fixed_assets(id),
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_location ON vehicles(location);

-- Vehicle maintenance records
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL,
  maintenance_type VARCHAR(100) NOT NULL, -- Service, Repair, Inspection, etc.
  description TEXT,
  mileage_at_service INT,
  cost DECIMAL(15,2),
  vendor_id UUID REFERENCES vendors(id),
  performed_by VARCHAR(255),
  next_service_date DATE,
  next_service_mileage INT,
  receipt_url VARCHAR(500),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_vehicle ON vehicle_maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_date ON vehicle_maintenance(maintenance_date);

-- Car hire/rentals
CREATE TABLE IF NOT EXISTS car_rentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rental_number VARCHAR(50) NOT NULL UNIQUE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  booking_id UUID REFERENCES bookings(id), -- Link to tour booking if applicable
  
  -- Dates
  pickup_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ NOT NULL,
  actual_return_date TIMESTAMPTZ,
  
  -- Location (especially for US rentals)
  pickup_location VARCHAR(255),
  return_location VARCHAR(255),
  
  -- Driver
  with_driver BOOLEAN DEFAULT true,
  driver_id UUID REFERENCES user_profiles(id),
  
  -- Mileage
  start_mileage INT,
  end_mileage INT,
  mileage_limit INT, -- Included mileage
  extra_mileage_rate DECIMAL(10,2),
  
  -- Pricing
  daily_rate DECIMAL(15,2) NOT NULL,
  num_days INT NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  extras_total DECIMAL(15,2) DEFAULT 0, -- GPS, child seat, etc.
  fuel_charge DECIMAL(15,2) DEFAULT 0,
  damage_charge DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  
  currency CHAR(3) DEFAULT 'USD',
  
  -- Status
  status VARCHAR(50) DEFAULT 'reserved', -- reserved, active, completed, cancelled
  
  -- Insurance
  insurance_option VARCHAR(100),
  insurance_cost DECIMAL(15,2) DEFAULT 0,
  
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_car_rentals_number ON car_rentals(rental_number);
CREATE INDEX IF NOT EXISTS idx_car_rentals_vehicle ON car_rentals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_car_rentals_dates ON car_rentals(pickup_date, return_date);

-- =====================================================
-- STEP 8: PAYROLL SYSTEM
-- =====================================================

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_number VARCHAR(50) NOT NULL UNIQUE,
  user_profile_id UUID REFERENCES user_profiles(id), -- Link to user if they have system access
  
  -- Personal info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  other_names VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(20),
  nationality VARCHAR(100) DEFAULT 'Ugandan',
  national_id VARCHAR(50),
  
  -- Contact
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  
  -- Employment
  job_title VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  employment_type VARCHAR(50) DEFAULT 'full_time', -- full_time, part_time, contract, casual
  hire_date DATE NOT NULL,
  termination_date DATE,
  reporting_to UUID REFERENCES employees(id),
  
  -- Compensation
  basic_salary DECIMAL(15,2) NOT NULL,
  salary_currency CHAR(3) DEFAULT 'UGX',
  pay_frequency pay_frequency DEFAULT 'monthly',
  
  -- Bank details
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  bank_account_number VARCHAR(100),
  bank_account_name VARCHAR(255),
  swift_code VARCHAR(20),
  
  -- Tax info (Uganda)
  tin VARCHAR(50), -- Tax Identification Number
  nssf_number VARCHAR(50), -- NSSF Member Number
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- Employee allowances (recurring)
CREATE TABLE IF NOT EXISTS employee_allowances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  allowance_type VARCHAR(100) NOT NULL, -- Housing, Transport, Meal, Phone, etc.
  amount DECIMAL(15,2) NOT NULL,
  is_taxable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee deductions (recurring)
CREATE TABLE IF NOT EXISTS employee_deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  deduction_type VARCHAR(100) NOT NULL, -- Loan, Salary Advance, Insurance, Union Dues, etc.
  amount DECIMAL(15,2) NOT NULL,
  is_percentage BOOLEAN DEFAULT false, -- If true, amount is percentage of gross
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll periods
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_name VARCHAR(100) NOT NULL, -- 'December 2024', 'Week 50 2024'
  period_type pay_frequency NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_date DATE NOT NULL,
  status payroll_status DEFAULT 'draft',
  
  -- Totals
  total_gross DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  total_net DECIMAL(15,2) DEFAULT 0,
  total_employer_contributions DECIMAL(15,2) DEFAULT 0,
  
  processed_by UUID REFERENCES user_profiles(id),
  processed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_payroll_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON payroll_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payslip_number VARCHAR(50) NOT NULL UNIQUE,
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  
  -- Earnings
  basic_salary DECIMAL(15,2) NOT NULL,
  total_allowances DECIMAL(15,2) DEFAULT 0,
  overtime_hours DECIMAL(10,2) DEFAULT 0,
  overtime_amount DECIMAL(15,2) DEFAULT 0,
  bonus DECIMAL(15,2) DEFAULT 0,
  commission DECIMAL(15,2) DEFAULT 0,
  reimbursements DECIMAL(15,2) DEFAULT 0,
  gross_salary DECIMAL(15,2) NOT NULL,
  
  -- Deductions
  paye DECIMAL(15,2) DEFAULT 0, -- Pay As You Earn (Income Tax)
  nssf_employee DECIMAL(15,2) DEFAULT 0, -- 5% employee contribution
  loan_deduction DECIMAL(15,2) DEFAULT 0,
  salary_advance DECIMAL(15,2) DEFAULT 0,
  other_deductions DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  
  -- Net pay
  net_salary DECIMAL(15,2) NOT NULL,
  
  -- Employer contributions
  nssf_employer DECIMAL(15,2) DEFAULT 0, -- 10% employer contribution
  
  -- Payment info
  payment_method payment_method DEFAULT 'bank_transfer',
  payment_reference VARCHAR(100),
  paid_at TIMESTAMPTZ,
  
  currency CHAR(3) DEFAULT 'UGX',
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payslips_period ON payslips(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

-- Payslip line items (detailed breakdown)
CREATE TABLE IF NOT EXISTS payslip_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payslip_id UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL, -- 'earning' or 'deduction'
  item_name VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  is_taxable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Salary advances
CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15,2) NOT NULL,
  reason TEXT,
  repayment_months INT DEFAULT 1, -- Number of months to deduct
  amount_repaid DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, repaid
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  expense_id UUID REFERENCES expenses(id), -- Links to expense record
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee reimbursements
CREATE TABLE IF NOT EXISTS employee_reimbursements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  reimbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type VARCHAR(100) NOT NULL, -- Travel, Meals, Communication, etc.
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  receipt_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, paid
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  paid_in_payroll_id UUID REFERENCES payroll_periods(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 9: ENHANCED ASSET REGISTER
-- =====================================================

-- Add new columns to fixed_assets if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fixed_assets' AND column_name = 'asset_type') THEN
    ALTER TABLE fixed_assets ADD COLUMN asset_type tour_asset_type DEFAULT 'equipment';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fixed_assets' AND column_name = 'responsible_person_id') THEN
    ALTER TABLE fixed_assets ADD COLUMN responsible_person_id UUID REFERENCES employees(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fixed_assets' AND column_name = 'condition') THEN
    ALTER TABLE fixed_assets ADD COLUMN condition VARCHAR(50) DEFAULT 'good'; -- excellent, good, fair, poor
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fixed_assets' AND column_name = 'warranty_expiry') THEN
    ALTER TABLE fixed_assets ADD COLUMN warranty_expiry DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fixed_assets' AND column_name = 'insurance_policy') THEN
    ALTER TABLE fixed_assets ADD COLUMN insurance_policy VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fixed_assets' AND column_name = 'insurance_expiry') THEN
    ALTER TABLE fixed_assets ADD COLUMN insurance_expiry DATE;
  END IF;
END $$;

-- Asset maintenance/repair history
CREATE TABLE IF NOT EXISTS asset_maintenance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL,
  maintenance_type VARCHAR(100) NOT NULL, -- Routine, Repair, Inspection, Upgrade
  description TEXT,
  cost DECIMAL(15,2) DEFAULT 0,
  vendor_id UUID REFERENCES vendors(id),
  performed_by VARCHAR(255),
  next_maintenance_date DATE,
  receipt_url VARCHAR(500),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset ON asset_maintenance(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_date ON asset_maintenance(maintenance_date);

-- Asset transfers (change of location/responsibility)
CREATE TABLE IF NOT EXISTS asset_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  transfer_date DATE NOT NULL,
  from_location VARCHAR(255),
  to_location VARCHAR(255),
  from_person_id UUID REFERENCES employees(id),
  to_person_id UUID REFERENCES employees(id),
  reason TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 10: BUDGET & FORECASTING ENHANCEMENTS
-- =====================================================

-- Budget versions (for different scenarios)
CREATE TABLE IF NOT EXISTS budget_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  fiscal_year INT NOT NULL,
  version_type VARCHAR(50) DEFAULT 'budget', -- budget, forecast, revised
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget items linked to versions
CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_version_id UUID NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id),
  department VARCHAR(100),
  category VARCHAR(100), -- Tours, Hotels, Fleet, Admin, etc.
  
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_items_version ON budget_items(budget_version_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_account ON budget_items(account_id);

-- Cash flow forecasting
CREATE TABLE IF NOT EXISTS cash_flow_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forecast_date DATE NOT NULL,
  account_id UUID REFERENCES accounts(id), -- Bank or cash account
  
  -- Expected inflows
  expected_collections DECIMAL(15,2) DEFAULT 0, -- From receivables
  expected_tour_income DECIMAL(15,2) DEFAULT 0,
  expected_other_income DECIMAL(15,2) DEFAULT 0,
  total_inflows DECIMAL(15,2) DEFAULT 0,
  
  -- Expected outflows
  expected_payables DECIMAL(15,2) DEFAULT 0,
  expected_payroll DECIMAL(15,2) DEFAULT 0,
  expected_expenses DECIMAL(15,2) DEFAULT 0,
  expected_taxes DECIMAL(15,2) DEFAULT 0,
  total_outflows DECIMAL(15,2) DEFAULT 0,
  
  net_cash_flow DECIMAL(15,2) GENERATED ALWAYS AS (total_inflows - total_outflows) STORED,
  
  -- Running balance
  opening_balance DECIMAL(15,2) DEFAULT 0,
  closing_balance DECIMAL(15,2) DEFAULT 0,
  
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_forecasts_date ON cash_flow_forecasts(forecast_date);

-- =====================================================
-- STEP 11: PETTY CASH ENHANCEMENTS
-- =====================================================

-- Add approval workflow to cash_transactions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_transactions' AND column_name = 'approved_by') THEN
    ALTER TABLE cash_transactions ADD COLUMN approved_by UUID REFERENCES user_profiles(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_transactions' AND column_name = 'status') THEN
    ALTER TABLE cash_transactions ADD COLUMN status VARCHAR(50) DEFAULT 'approved';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_transactions' AND column_name = 'category') THEN
    ALTER TABLE cash_transactions ADD COLUMN category VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_transactions' AND column_name = 'receipt_url') THEN
    ALTER TABLE cash_transactions ADD COLUMN receipt_url VARCHAR(500);
  END IF;
END $$;

-- Petty cash limits
CREATE TABLE IF NOT EXISTS petty_cash_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_account_id UUID NOT NULL REFERENCES cash_accounts(id),
  max_single_disbursement DECIMAL(15,2) NOT NULL DEFAULT 100000, -- Max per transaction (UGX)
  max_daily_disbursement DECIMAL(15,2) NOT NULL DEFAULT 500000,
  requires_approval_above DECIMAL(15,2) DEFAULT 50000, -- Needs approval above this
  approver_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 12: SEQUENCE GENERATORS FOR NEW TABLES
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS booking_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS vehicle_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS rental_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS employee_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS payslip_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS tour_package_seq START 1;

-- Functions to generate formatted numbers
CREATE OR REPLACE FUNCTION generate_booking_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'BK-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || LPAD(nextval('booking_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_vehicle_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'VH-' || LPAD(nextval('vehicle_number_seq')::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_rental_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'CR-' || TO_CHAR(CURRENT_DATE, 'YYMM') || '-' || LPAD(nextval('rental_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_employee_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'EMP-' || LPAD(nextval('employee_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_payslip_number(period_name VARCHAR) RETURNS VARCHAR AS $$
BEGIN
  RETURN 'PS-' || REPLACE(period_name, ' ', '-') || '-' || LPAD(nextval('payslip_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_tour_package_code() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'PKG-' || LPAD(nextval('tour_package_seq')::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 13: UPDATE TRIGGERS
-- =====================================================

CREATE TRIGGER update_tour_packages_updated_at BEFORE UPDATE ON tour_packages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotels_updated_at BEFORE UPDATE ON hotels 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_car_rentals_updated_at BEFORE UPDATE ON car_rentals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_periods_updated_at BEFORE UPDATE ON payroll_periods 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_destinations_updated_at BEFORE UPDATE ON destinations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 14: PAYE TAX CALCULATION FUNCTION (UGANDA)
-- =====================================================

-- Uganda PAYE rates (2024)
-- 0 - 235,000: 0%
-- 235,001 - 335,000: 10%
-- 335,001 - 410,000: 20%
-- 410,001 - 10,000,000: 30%
-- Above 10,000,000: 40%

CREATE OR REPLACE FUNCTION calculate_paye_uganda(gross_income DECIMAL(15,2))
RETURNS DECIMAL(15,2) AS $$
DECLARE
  paye DECIMAL(15,2) := 0;
  taxable DECIMAL(15,2);
BEGIN
  -- First bracket: 0 - 235,000 (0%)
  IF gross_income <= 235000 THEN
    RETURN 0;
  END IF;
  
  -- Second bracket: 235,001 - 335,000 (10%)
  IF gross_income <= 335000 THEN
    RETURN (gross_income - 235000) * 0.10;
  ELSE
    paye := (335000 - 235000) * 0.10;
  END IF;
  
  -- Third bracket: 335,001 - 410,000 (20%)
  IF gross_income <= 410000 THEN
    RETURN paye + (gross_income - 335000) * 0.20;
  ELSE
    paye := paye + (410000 - 335000) * 0.20;
  END IF;
  
  -- Fourth bracket: 410,001 - 10,000,000 (30%)
  IF gross_income <= 10000000 THEN
    RETURN paye + (gross_income - 410000) * 0.30;
  ELSE
    paye := paye + (10000000 - 410000) * 0.30;
  END IF;
  
  -- Fifth bracket: Above 10,000,000 (40%)
  paye := paye + (gross_income - 10000000) * 0.40;
  
  RETURN ROUND(paye, 0);
END;
$$ LANGUAGE plpgsql;

-- NSSF calculation (5% employee, 10% employer)
CREATE OR REPLACE FUNCTION calculate_nssf_employee(gross_income DECIMAL(15,2))
RETURNS DECIMAL(15,2) AS $$
BEGIN
  RETURN ROUND(gross_income * 0.05, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_nssf_employer(gross_income DECIMAL(15,2))
RETURNS DECIMAL(15,2) AS $$
BEGIN
  RETURN ROUND(gross_income * 0.10, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 15: INSERT DEFAULT DATA
-- =====================================================

-- Insert default tour-related product categories
INSERT INTO product_categories (name, description) VALUES
  ('Safari Equipment', 'Binoculars, camping gear, tents, sleeping bags'),
  ('Vehicle Parts & Supplies', 'Spare parts, tires, oils, filters'),
  ('Branded Merchandise', 'T-shirts, caps, souvenirs with Breco branding'),
  ('Office Supplies', 'Stationery, printing materials'),
  ('Food & Beverage', 'Snacks, water, drinks for tours'),
  ('Communication Equipment', 'Radios, satellite phones, GPS devices'),
  ('Safety Equipment', 'First aid kits, fire extinguishers, safety vests'),
  ('Photography Equipment', 'Cameras, tripods, equipment for hire')
ON CONFLICT DO NOTHING;

-- Insert default asset categories for tour company
INSERT INTO asset_categories (name, description, default_useful_life_months, default_depreciation_method) VALUES
  ('Safari Vehicles', 'Land Cruisers, 4WD vehicles for safaris', 120, 'straight_line'),
  ('Mini Buses', 'Passenger mini buses and vans', 96, 'straight_line'),
  ('Office Equipment', 'Computers, printers, office furniture', 48, 'straight_line'),
  ('Camping Equipment', 'Tents, camping gear, outdoor equipment', 60, 'straight_line'),
  ('Communication Equipment', 'Radios, satellite phones, GPS', 36, 'straight_line'),
  ('Office Furniture', 'Desks, chairs, cabinets', 84, 'straight_line'),
  ('Property', 'Buildings and land', 360, 'straight_line'),
  ('Boats', 'Boats for water activities', 120, 'straight_line')
ON CONFLICT DO NOTHING;

-- Insert popular Uganda destinations
INSERT INTO destinations (name, country, region, description, highlights, best_time_to_visit, typical_duration_days) VALUES
  ('Bwindi Impenetrable National Park', 'Uganda', 'Western', 'Home to half of the world''s mountain gorillas', ARRAY['Gorilla Trekking', 'Bird Watching', 'Nature Walks'], 'June-September, December-February', 3),
  ('Queen Elizabeth National Park', 'Uganda', 'Western', 'Uganda''s most popular safari destination', ARRAY['Game Drives', 'Boat Safari', 'Tree-Climbing Lions'], 'June-September, December-February', 2),
  ('Murchison Falls National Park', 'Uganda', 'Northern', 'Uganda''s largest national park', ARRAY['Murchison Falls', 'Nile Cruise', 'Game Drives'], 'January-February, June-September', 2),
  ('Kibale National Park', 'Uganda', 'Western', 'Primate capital of the world', ARRAY['Chimpanzee Tracking', 'Bird Watching', 'Nature Walks'], 'Year-round', 1),
  ('Lake Mburo National Park', 'Uganda', 'Western', 'Closest park to Kampala', ARRAY['Zebras', 'Boat Safari', 'Horseback Safari'], 'Year-round', 1),
  ('Jinja', 'Uganda', 'Eastern', 'Adventure capital of East Africa', ARRAY['White Water Rafting', 'Bungee Jumping', 'Source of the Nile'], 'Year-round', 2),
  ('Entebbe', 'Uganda', 'Central', 'Gateway to Uganda', ARRAY['Botanical Gardens', 'Wildlife Education Centre', 'Beaches'], 'Year-round', 1),
  ('Kampala', 'Uganda', 'Central', 'Capital city of Uganda', ARRAY['Cultural Sites', 'Markets', 'Nightlife'], 'Year-round', 1),
  ('Ssese Islands', 'Uganda', 'Central', 'Islands on Lake Victoria', ARRAY['Beach Relaxation', 'Forest Walks', 'Fishing'], 'Year-round', 2),
  ('Kidepo Valley National Park', 'Uganda', 'Northern', 'Africa''s most pristine wilderness', ARRAY['Game Drives', 'Cultural Encounters', 'Remote Wilderness'], 'December-March', 3)
ON CONFLICT DO NOTHING;

-- Insert Breco bank accounts (from the invoice)
INSERT INTO bank_accounts (name, bank_name, routing_number, account_type, currency, is_primary) VALUES
  ('DFCU Bank USD', 'DFCU Bank', 'DFCUUGKA', 'checking', 'USD', true),
  ('DFCU Bank UGX', 'DFCU Bank', 'DFCUUGKA', 'checking', 'UGX', false),
  ('Centenary Bank USD', 'Centenary Bank', 'CERBUGKA', 'checking', 'USD', false),
  ('Centenary Bank EUR', 'Centenary Bank', 'CERBUGKA', 'checking', 'EUR', false),
  ('Centenary Bank UGX', 'Centenary Bank', 'CERBUGKA', 'checking', 'UGX', false)
ON CONFLICT DO NOTHING;

-- Insert default exchange rates (approximate)
INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date, source) VALUES
  ('USD', 'UGX', 3750.00, CURRENT_DATE, 'manual'),
  ('EUR', 'UGX', 4100.00, CURRENT_DATE, 'manual'),
  ('GBP', 'UGX', 4750.00, CURRENT_DATE, 'manual'),
  ('EUR', 'USD', 1.09, CURRENT_DATE, 'manual'),
  ('GBP', 'USD', 1.27, CURRENT_DATE, 'manual')
ON CONFLICT DO NOTHING;

COMMIT;
