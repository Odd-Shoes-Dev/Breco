-- =====================================================
-- FIX BOOKINGS VEHICLE FOREIGN KEY
-- Migration: 031_fix_bookings_vehicle_fk.sql
-- =====================================================

-- Add foreign key constraint for assigned_vehicle_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bookings_assigned_vehicle_id_fkey'
  ) THEN
    ALTER TABLE bookings
    ADD CONSTRAINT bookings_assigned_vehicle_id_fkey 
    FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for the foreign key
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON bookings(assigned_vehicle_id);

COMMENT ON CONSTRAINT bookings_assigned_vehicle_id_fkey ON bookings IS 'Links booking to assigned vehicle';
