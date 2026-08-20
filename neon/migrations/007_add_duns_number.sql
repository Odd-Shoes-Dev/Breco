-- Migration 007: Add DUNS number to company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS duns_number VARCHAR(50);
