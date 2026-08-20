-- Restore hotels columns dropped during the Neon rewrite.
-- Original definition: supabase/migrations/020_breco_safaris_transform.sql
-- The hotels form submits hotel_type, standard_rate_usd, and deluxe_rate_usd.

ALTER TABLE hotels ADD COLUMN IF NOT EXISTS hotel_type VARCHAR(100);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS standard_rate_usd DECIMAL(15,2);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS deluxe_rate_usd DECIMAL(15,2);
