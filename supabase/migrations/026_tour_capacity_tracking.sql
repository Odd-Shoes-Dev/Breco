-- Add capacity tracking to tour packages
ALTER TABLE tour_packages
ADD COLUMN max_capacity INTEGER DEFAULT 0,
ADD COLUMN available_slots INTEGER DEFAULT 0,
ADD COLUMN slots_reserved INTEGER DEFAULT 0;

-- Add booking status tracking
ALTER TABLE bookings
ADD COLUMN number_of_people INTEGER DEFAULT 1,
ADD COLUMN booking_confirmed_at TIMESTAMPTZ,
ADD COLUMN cancellation_date TIMESTAMPTZ,
ADD COLUMN cancellation_reason TEXT;

-- Function to update tour package availability when booking is confirmed
CREATE OR REPLACE FUNCTION update_tour_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- When booking is confirmed
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE tour_packages
    SET available_slots = available_slots - COALESCE(NEW.number_of_people, 1),
        slots_reserved = slots_reserved + COALESCE(NEW.number_of_people, 1)
    WHERE id = NEW.tour_package_id;
    
    NEW.booking_confirmed_at = NOW();
  END IF;
  
  -- When booking is cancelled
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE tour_packages
    SET available_slots = available_slots + COALESCE(OLD.number_of_people, 1),
        slots_reserved = slots_reserved - COALESCE(OLD.number_of_people, 1)
    WHERE id = NEW.tour_package_id;
    
    NEW.cancellation_date = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for booking status changes
DROP TRIGGER IF EXISTS booking_availability_trigger ON bookings;
CREATE TRIGGER booking_availability_trigger
BEFORE UPDATE OF status ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_tour_availability();

-- Create trigger for new bookings
DROP TRIGGER IF EXISTS booking_insert_trigger ON bookings;
CREATE TRIGGER booking_insert_trigger
BEFORE INSERT ON bookings
FOR EACH ROW
WHEN (NEW.status = 'confirmed')
EXECUTE FUNCTION update_tour_availability();

-- Add check constraint to prevent overbooking
ALTER TABLE tour_packages
ADD CONSTRAINT check_available_slots
CHECK (available_slots >= 0);

-- Update existing tour packages to set initial availability
UPDATE tour_packages
SET max_capacity = 20,
    available_slots = 20,
    slots_reserved = 0
WHERE max_capacity IS NULL OR max_capacity = 0;

-- Create function to check availability before booking
CREATE OR REPLACE FUNCTION check_tour_availability(
  p_tour_package_id UUID,
  p_number_of_people INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_available INTEGER;
BEGIN
  SELECT available_slots INTO v_available
  FROM tour_packages
  WHERE id = p_tour_package_id;
  
  RETURN v_available >= p_number_of_people;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_tour_availability IS 'Check if tour package has enough available slots for booking';
