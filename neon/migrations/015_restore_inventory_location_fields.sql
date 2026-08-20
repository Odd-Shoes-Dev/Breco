-- Restore inventory_locations columns dropped during the Neon rewrite.
-- Original definition: supabase/migrations/032_inventory_assets_enhancements.sql
-- The locations UI submits state and postal_code (stored as zip_code).

ALTER TABLE inventory_locations ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255);
ALTER TABLE inventory_locations ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE inventory_locations ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20);
