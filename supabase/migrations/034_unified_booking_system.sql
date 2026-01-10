-- ================================================================
-- Unified Booking System Enhancement
-- ================================================================
-- This migration enhances the bookings table to handle:
-- 1. Tour Package Bookings (existing)
-- 2. Hotel-Only Bookings
-- 3. Fleet/Car Hire Bookings
-- 4. Combined Bookings

-- Add hotel reference to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES hotels(id);

-- Note: Foreign key for assigned_vehicle_id already exists from migration 031

-- Add room details for hotel bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS room_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS num_rooms INT DEFAULT 1;

-- Add vehicle rental details
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS rental_type VARCHAR(50), -- 'self_drive', 'with_driver', 'airport_transfer'
ADD COLUMN IF NOT EXISTS pickup_location VARCHAR(200),
ADD COLUMN IF NOT EXISTS dropoff_location VARCHAR(200);

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_bookings_hotel ON bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON bookings(assigned_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings(booking_type);

-- Update booking_type check constraint to include all types
-- First, drop the old constraint if it exists
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS check_booking_type;

-- Add new constraint with all booking types
ALTER TABLE bookings
ADD CONSTRAINT check_booking_type 
CHECK (booking_type IN ('tour', 'hotel', 'car_hire', 'custom', 'tour_package'));

-- Ensure at least one booking item is selected
ALTER TABLE bookings
ADD CONSTRAINT check_booking_has_item
CHECK (
  tour_package_id IS NOT NULL OR 
  hotel_id IS NOT NULL OR 
  assigned_vehicle_id IS NOT NULL
);

-- Add comment explaining the unified booking system
COMMENT ON TABLE bookings IS 'Unified booking system that handles tour packages, hotels, and fleet rentals';
COMMENT ON COLUMN bookings.booking_type IS 'Type of booking: tour/tour_package (tour package), hotel (hotel only), car_hire (vehicle rental), custom (combination)';
COMMENT ON COLUMN bookings.tour_package_id IS 'Reference to tour package (if booking includes a tour)';
COMMENT ON COLUMN bookings.hotel_id IS 'Reference to hotel (if booking includes accommodation)';
COMMENT ON COLUMN bookings.assigned_vehicle_id IS 'Reference to vehicle (if booking includes car hire/transport)';
COMMENT ON COLUMN bookings.room_type IS 'Type of room for hotel bookings (e.g., Single, Double, Suite)';
COMMENT ON COLUMN bookings.num_rooms IS 'Number of rooms for hotel bookings';
COMMENT ON COLUMN bookings.rental_type IS 'Type of vehicle rental: self_drive, with_driver, airport_transfer';
COMMENT ON COLUMN bookings.pickup_location IS 'Pickup location for vehicle rentals';
COMMENT ON COLUMN bookings.dropoff_location IS 'Drop-off location for vehicle rentals';

-- Update the bookings view if it exists to include new fields
CREATE OR REPLACE VIEW booking_details AS
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
