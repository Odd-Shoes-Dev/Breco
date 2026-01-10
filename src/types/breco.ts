// =====================================================
// Breco Safaris Ltd - Financial & Operations System
// Extended Database Types for Tour Operations
// =====================================================

import type {
  PaymentMethod,
  DepreciationMethod,
  AssetStatus,
  InvoiceStatus,
} from './database';

// =====================================================
// TOUR OPERATIONS ENUMS
// =====================================================

export type BookingStatus =
  | 'inquiry'
  | 'confirmed'
  | 'deposit_paid'
  | 'fully_paid'
  | 'completed'
  | 'cancelled';

export type VehicleStatus =
  | 'available'
  | 'booked'
  | 'in_use'
  | 'maintenance'
  | 'out_of_service';

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';

export type PayrollStatus = 'draft' | 'pending_approval' | 'approved' | 'paid' | 'void';

export type TourAssetType =
  | 'vehicle'
  | 'equipment'
  | 'property'
  | 'furniture'
  | 'electronics'
  | 'camping_gear'
  | 'boat'
  | 'other';

// Extended payment method with petty_cash and mobile_money
export type ExtendedPaymentMethod = PaymentMethod | 'petty_cash' | 'mobile_money';

// =====================================================
// DESTINATIONS & LOCATIONS
// =====================================================

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: string | null;
  description: string | null;
  highlights: string[] | null;
  best_time_to_visit: string | null;
  typical_duration_days: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// TOUR PACKAGES & ITINERARIES
// =====================================================

export interface TourPackage {
  id: string;
  package_code: string;
  name: string;
  description: string | null;
  duration_days: number;
  duration_nights: number;
  base_price_usd: number;
  base_price_eur: number | null;
  base_price_ugx: number | null;
  price_per_person: boolean;
  min_group_size: number;
  max_group_size: number;
  max_capacity: number;
  available_slots: number;
  slots_reserved: number;
  tour_type: string | null;
  difficulty_level: string;
  inclusions: string | null;
  exclusions: string | null;
  primary_destination_id: string | null;
  image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TourPackageDestination {
  id: string;
  tour_package_id: string;
  destination_id: string;
  visit_order: number;
  nights_stay: number;
  created_at: string;
  destination?: Destination;
}

export interface TourItinerary {
  id: string;
  tour_package_id: string;
  day_number: number;
  title: string;
  description: string | null;
  activities: string[] | null;
  meals_included: string | null;
  accommodation: string | null;
  destination_id: string | null;
  distance_km: number | null;
  driving_hours: number | null;
  created_at: string;
}

export interface TourSeasonalPricing {
  id: string;
  tour_package_id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  price_adjustment_percent: number;
  price_adjustment_fixed_usd: number;
  notes: string | null;
  created_at: string;
}

export interface TourPackageImage {
  id: string;
  tour_package_id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface TourPackageWithDetails extends TourPackage {
  destinations?: TourPackageDestination[];
  itineraries?: TourItinerary[];
  seasonal_pricing?: TourSeasonalPricing[];
  primary_destination?: Destination;
  images?: TourPackageImage[];
}

// =====================================================
// PARTNER HOTELS
// =====================================================

export interface Hotel {
  id: string;
  name: string;
  destination_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  star_rating: number | null;
  hotel_type: string | null;
  standard_rate_usd: number | null;
  deluxe_rate_usd: number | null;
  suite_rate_usd: number | null;
  contact_person: string | null;
  contact_phone: string | null;
  commission_rate: number;
  notes: string | null;
  is_partner: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  destination?: Destination;
}

export interface HotelRoomType {
  id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  max_occupancy: number;
  rate_usd: number;
  rate_ugx: number | null;
  is_active: boolean;
  created_at: string;
}

// =====================================================
// BOOKINGS SYSTEM
// =====================================================

export interface Booking {
  id: string;
  booking_number: string;
  customer_id: string;
  booking_type: 'tour' | 'hotel' | 'car_hire' | 'custom';
  tour_package_id: string | null;
  hotel_id: string | null;
  room_type: string | null;
  num_rooms: number | null;
  rental_type: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  booking_date: string;
  travel_start_date: string;
  travel_end_date: string;
  num_adults: number;
  num_children: number;
  num_infants: number;
  number_of_people: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  currency: string;
  exchange_rate: number;
  status: BookingStatus;
  booking_confirmed_at: string | null;
  cancellation_date: string | null;
  cancellation_reason: string | null;
  special_requests: string | null;
  dietary_requirements: string | null;
  assigned_guide_id: string | null;
  assigned_vehicle_id: string | null;
  invoice_id: string | null;
  quotation_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingGuest {
  id: string;
  booking_id: string;
  full_name: string;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  date_of_birth: string | null;
  is_lead_guest: boolean;
  special_requirements: string | null;
  created_at: string;
}

export interface BookingHotel {
  id: string;
  booking_id: string;
  hotel_id: string;
  room_type_id: string | null;
  check_in_date: string;
  check_out_date: string;
  num_rooms: number;
  room_rate: number | null;
  total_cost: number | null;
  confirmation_number: string | null;
  notes: string | null;
  created_at: string;
  hotel?: Hotel;
}

export interface BookingActivity {
  id: string;
  booking_id: string;
  activity_date: string;
  activity_name: string;
  description: string | null;
  num_participants: number;
  unit_cost: number | null;
  total_cost: number | null;
  permit_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface BookingPayment {
  id: string;
  booking_id: string;
  payment_id: string | null;
  amount: number;
  payment_type: 'deposit' | 'balance' | 'refund';
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface BookingWithDetails extends Booking {
  customer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    country: string;
  };
  tour_package?: TourPackage;
  guests?: BookingGuest[];
  hotels?: BookingHotel[];
  activities?: BookingActivity[];
  payments?: BookingPayment[];
  assigned_guide?: {
    id: string;
    full_name: string;
  };
}

// =====================================================
// FLEET MANAGEMENT
// =====================================================

export interface Vehicle {
  id: string;
  vehicle_number: string;
  registration_number: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  vehicle_type: string | null;
  fuel_type: string;
  transmission: string;
  seating_capacity: number;
  luggage_capacity: string | null;
  features: string[] | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  insurance_expiry: string | null;
  inspection_expiry: string | null;
  daily_rate_usd: number | null;
  daily_rate_ugx: number | null;
  weekly_rate_usd: number | null;
  mileage_rate: number | null;
  status: VehicleStatus;
  current_mileage: number;
  last_service_date: string | null;
  next_service_mileage: number | null;
  location: string | null;
  fixed_asset_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VehicleMaintenance {
  id: string;
  vehicle_id: string;
  maintenance_date: string;
  maintenance_type: string;
  description: string | null;
  mileage_at_service: number | null;
  cost: number | null;
  vendor_id: string | null;
  performed_by: string | null;
  next_service_date: string | null;
  next_service_mileage: number | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CarRental {
  id: string;
  rental_number: string;
  vehicle_id: string;
  customer_id: string;
  booking_id: string | null;
  pickup_date: string;
  return_date: string;
  actual_return_date: string | null;
  pickup_location: string | null;
  return_location: string | null;
  with_driver: boolean;
  driver_id: string | null;
  start_mileage: number | null;
  end_mileage: number | null;
  mileage_limit: number | null;
  extra_mileage_rate: number | null;
  daily_rate: number;
  num_days: number;
  subtotal: number;
  extras_total: number;
  fuel_charge: number;
  damage_charge: number;
  total: number;
  currency: string;
  status: 'reserved' | 'active' | 'completed' | 'cancelled';
  insurance_option: string | null;
  insurance_cost: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleWithMaintenance extends Vehicle {
  maintenance_history?: VehicleMaintenance[];
  upcoming_rentals?: CarRental[];
}

// =====================================================
// PAYROLL SYSTEM
// =====================================================

export interface Employee {
  id: string;
  employee_number: string;
  user_profile_id: string | null;
  first_name: string;
  last_name: string;
  other_names: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string;
  national_id: string | null;
  nssf_number: string | null;
  tin_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  job_title: string | null;
  department: string | null;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'casual';
  employment_status: 'active' | 'on_leave' | 'terminated' | 'probation';
  hire_date: string | null;
  termination_date: string | null;
  reporting_to: string | null;
  base_salary: number;
  basic_salary: number;
  salary_currency: string;
  pay_frequency: PayFrequency;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  swift_code: string | null;
  tin: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAllowance {
  id: string;
  employee_id: string;
  allowance_type: string;
  amount: number;
  is_taxable: boolean;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

export interface EmployeeDeduction {
  id: string;
  employee_id: string;
  deduction_type: string;
  amount: number;
  is_percentage: boolean;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
}

export interface PayrollPeriod {
  id: string;
  period_name: string;
  period_type: PayFrequency;
  start_date: string;
  end_date: string;
  payment_date: string;
  status: PayrollStatus;
  employee_count: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_paye: number;
  total_nssf: number;
  total_employer_contributions: number;
  journal_entry_id: string | null;
  processed_by: string | null;
  processed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payslip {
  id: string;
  payslip_number: string;
  payroll_period_id: string;
  employee_id: string;
  basic_salary: number;
  total_allowances: number;
  overtime_hours: number;
  overtime_amount: number;
  bonus: number;
  commission: number;
  reimbursements: number;
  gross_salary: number;
  paye: number;
  nssf_employee: number;
  loan_deduction: number;
  salary_advance: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  nssf_employer: number;
  payment_method: ExtendedPaymentMethod;
  payment_reference: string | null;
  payment_journal_entry_id: string | null;
  paid_at: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
}

export interface PayslipItem {
  id: string;
  payslip_id: string;
  item_type: 'earning' | 'deduction';
  item_name: string;
  amount: number;
  is_taxable: boolean;
  created_at: string;
}

export interface SalaryAdvance {
  id: string;
  employee_id: string;
  advance_date: string;
  amount: number;
  reason: string | null;
  repayment_months: number;
  amount_repaid: number;
  status: 'pending' | 'approved' | 'rejected' | 'repaid';
  approved_by: string | null;
  approved_at: string | null;
  expense_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EmployeeReimbursement {
  id: string;
  employee_id: string;
  reimbursement_date: string;
  expense_type: string;
  description: string | null;
  amount: number;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  approved_by: string | null;
  approved_at: string | null;
  paid_in_payroll_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EmployeeWithPayroll extends Employee {
  allowances?: EmployeeAllowance[];
  deductions?: EmployeeDeduction[];
  recent_payslips?: Payslip[];
  pending_advances?: SalaryAdvance[];
  pending_reimbursements?: EmployeeReimbursement[];
}

export interface PayrollPeriodWithPayslips extends PayrollPeriod {
  payslips?: (Payslip & { employee?: Employee })[];
}

// =====================================================
// ENHANCED ASSET REGISTER
// =====================================================

export interface AssetMaintenance {
  id: string;
  asset_id: string;
  maintenance_date: string;
  maintenance_type: string;
  description: string | null;
  cost: number;
  vendor_id: string | null;
  performed_by: string | null;
  next_maintenance_date: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AssetTransfer {
  id: string;
  asset_id: string;
  transfer_date: string;
  from_location: string | null;
  to_location: string | null;
  from_person_id: string | null;
  to_person_id: string | null;
  reason: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface ExtendedFixedAsset {
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
  // Extended fields
  asset_type: TourAssetType;
  responsible_person_id: string | null;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  warranty_expiry: string | null;
  insurance_policy: string | null;
  insurance_expiry: string | null;
  // Related
  responsible_person?: Employee;
  maintenance_history?: AssetMaintenance[];
  transfer_history?: AssetTransfer[];
}

// =====================================================
// BUDGET & FORECASTING
// =====================================================

export interface BudgetVersion {
  id: string;
  name: string;
  fiscal_year: number;
  version_type: 'budget' | 'forecast' | 'revised';
  description: string | null;
  is_active: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BudgetItem {
  id: string;
  budget_version_id: string;
  account_id: string;
  department: string | null;
  category: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface CashFlowForecast {
  id: string;
  forecast_date: string;
  account_id: string | null;
  expected_collections: number;
  expected_tour_income: number;
  expected_other_income: number;
  total_inflows: number;
  expected_payables: number;
  expected_payroll: number;
  expected_expenses: number;
  expected_taxes: number;
  total_outflows: number;
  net_cash_flow: number;
  opening_balance: number;
  closing_balance: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BudgetVsActual {
  account_id: string;
  account_name: string;
  budget_amount: number;
  actual_amount: number;
  variance: number;
  variance_percent: number;
  is_favorable: boolean;
}

// =====================================================
// PETTY CASH
// =====================================================

export interface PettyCashLimit {
  id: string;
  cash_account_id: string;
  max_single_disbursement: number;
  max_daily_disbursement: number;
  requires_approval_above: number;
  approver_id: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// REPORT TYPES
// =====================================================

export interface TourPerformanceReport {
  tour_package_id: string;
  tour_name: string;
  total_bookings: number;
  total_guests: number;
  total_revenue: number;
  average_booking_value: number;
  completion_rate: number;
  most_popular_month: string;
}

export interface GuideUtilizationReport {
  guide_id: string;
  guide_name: string;
  total_tours: number;
  total_days: number;
  total_revenue_generated: number;
  average_rating: number;
  utilization_rate: number;
}

export interface VehicleUtilizationReport {
  vehicle_id: string;
  vehicle_number: string;
  total_rentals: number;
  total_days_rented: number;
  total_revenue: number;
  maintenance_cost: number;
  net_contribution: number;
  utilization_rate: number;
}

export interface SeasonalBookingTrend {
  month: number;
  year: number;
  total_bookings: number;
  total_revenue: number;
  avg_group_size: number;
  top_destination: string;
  yoy_growth: number;
}

// =====================================================
// EXTENDED DATABASE TYPE
// =====================================================

export interface BrecoDatabaseExtensions {
  public: {
    Tables: {
      destinations: { Row: Destination; Insert: Partial<Destination>; Update: Partial<Destination> };
      tour_packages: { Row: TourPackage; Insert: Partial<TourPackage>; Update: Partial<TourPackage> };
      tour_package_destinations: { Row: TourPackageDestination; Insert: Partial<TourPackageDestination>; Update: Partial<TourPackageDestination> };
      tour_itineraries: { Row: TourItinerary; Insert: Partial<TourItinerary>; Update: Partial<TourItinerary> };
      tour_seasonal_pricing: { Row: TourSeasonalPricing; Insert: Partial<TourSeasonalPricing>; Update: Partial<TourSeasonalPricing> };
      hotels: { Row: Hotel; Insert: Partial<Hotel>; Update: Partial<Hotel> };
      hotel_room_types: { Row: HotelRoomType; Insert: Partial<HotelRoomType>; Update: Partial<HotelRoomType> };
      bookings: { Row: Booking; Insert: Partial<Booking>; Update: Partial<Booking> };
      booking_guests: { Row: BookingGuest; Insert: Partial<BookingGuest>; Update: Partial<BookingGuest> };
      booking_hotels: { Row: BookingHotel; Insert: Partial<BookingHotel>; Update: Partial<BookingHotel> };
      booking_activities: { Row: BookingActivity; Insert: Partial<BookingActivity>; Update: Partial<BookingActivity> };
      booking_payments: { Row: BookingPayment; Insert: Partial<BookingPayment>; Update: Partial<BookingPayment> };
      vehicles: { Row: Vehicle; Insert: Partial<Vehicle>; Update: Partial<Vehicle> };
      vehicle_maintenance: { Row: VehicleMaintenance; Insert: Partial<VehicleMaintenance>; Update: Partial<VehicleMaintenance> };
      car_rentals: { Row: CarRental; Insert: Partial<CarRental>; Update: Partial<CarRental> };
      employees: { Row: Employee; Insert: Partial<Employee>; Update: Partial<Employee> };
      employee_allowances: { Row: EmployeeAllowance; Insert: Partial<EmployeeAllowance>; Update: Partial<EmployeeAllowance> };
      employee_deductions: { Row: EmployeeDeduction; Insert: Partial<EmployeeDeduction>; Update: Partial<EmployeeDeduction> };
      payroll_periods: { Row: PayrollPeriod; Insert: Partial<PayrollPeriod>; Update: Partial<PayrollPeriod> };
      payslips: { Row: Payslip; Insert: Partial<Payslip>; Update: Partial<Payslip> };
      payslip_items: { Row: PayslipItem; Insert: Partial<PayslipItem>; Update: Partial<PayslipItem> };
      salary_advances: { Row: SalaryAdvance; Insert: Partial<SalaryAdvance>; Update: Partial<SalaryAdvance> };
      employee_reimbursements: { Row: EmployeeReimbursement; Insert: Partial<EmployeeReimbursement>; Update: Partial<EmployeeReimbursement> };
      asset_maintenance: { Row: AssetMaintenance; Insert: Partial<AssetMaintenance>; Update: Partial<AssetMaintenance> };
      asset_transfers: { Row: AssetTransfer; Insert: Partial<AssetTransfer>; Update: Partial<AssetTransfer> };
      budget_versions: { Row: BudgetVersion; Insert: Partial<BudgetVersion>; Update: Partial<BudgetVersion> };
      budget_items: { Row: BudgetItem; Insert: Partial<BudgetItem>; Update: Partial<BudgetItem> };
      cash_flow_forecasts: { Row: CashFlowForecast; Insert: Partial<CashFlowForecast>; Update: Partial<CashFlowForecast> };
      petty_cash_limits: { Row: PettyCashLimit; Insert: Partial<PettyCashLimit>; Update: Partial<PettyCashLimit> };
    };
  };
}
