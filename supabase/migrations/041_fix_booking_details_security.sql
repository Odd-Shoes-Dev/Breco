-- =====================================================
-- Fix: Set booking_details view to use SECURITY INVOKER
-- This ensures the view uses the querying user's permissions
-- and properly enforces RLS policies from base tables
-- =====================================================

-- Recreate view with SECURITY INVOKER (default, but explicit)
CREATE OR REPLACE VIEW booking_details 
WITH (security_invoker = true)
AS
SELECT 
  b.*,
  c.name as customer_name,
  c.email as customer_email,
  c.phone as customer_phone,
  tp.name as tour_package_name,
  tp.package_code,
  h.name as hotel_name,
  h.address as hotel_address,
  h.star_rating as hotel_rating,
  d.name as hotel_destination,
  v.registration_number as vehicle_registration,
  v.vehicle_type as vehicle_type,
  v.seating_capacity as vehicle_capacity,
  up.full_name as guide_name
FROM bookings b
LEFT JOIN customers c ON b.customer_id = c.id
LEFT JOIN tour_packages tp ON b.tour_package_id = tp.id
LEFT JOIN hotels h ON b.hotel_id = h.id
LEFT JOIN destinations d ON h.destination_id = d.id
LEFT JOIN vehicles v ON b.assigned_vehicle_id = v.id
LEFT JOIN user_profiles up ON b.assigned_guide_id = up.id;

-- Grant permissions
GRANT SELECT ON booking_details TO authenticated;

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'booking_details view now uses SECURITY INVOKER';
  RAISE NOTICE 'RLS policies from base tables will be properly enforced';
END $$;
