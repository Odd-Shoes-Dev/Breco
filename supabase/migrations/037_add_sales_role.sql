-- Migration 037: Add 'sales' role to user_role enum
-- Fixes the mismatch between enum values and default role

-- Add 'sales' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales';

-- Update the comment to reflect all available roles
COMMENT ON TYPE user_role IS 'User roles: admin, accountant, operations, sales, guide';
