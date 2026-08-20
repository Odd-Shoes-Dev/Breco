-- Restore stock_takes.type dropped during the Neon rewrite.
-- Original definition: supabase/migrations/032_inventory_assets_enhancements.sql
-- The stock takes UI submits and displays the type (full / cycle / spot).

ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'full';
