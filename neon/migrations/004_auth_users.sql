-- =====================================================
-- BRECO SAFARIS LTD - AUTH USERS SETUP
-- Neon Migration 004
-- Run after 003_seed_data.sql
--
-- PURPOSE:
--   Seeds the initial admin users. Passwords are hashed
--   with bcrypt (cost factor 10) by the application before
--   being stored here. This migration uses placeholder hashes.
--
-- HOW TO CREATE ADMIN USERS:
--   Option A (recommended): Use the app's /setup or admin UI
--   after first deploy to create users with proper bcrypt hashes.
--
--   Option B: Generate the hash in Node.js and run manually:
--     const bcrypt = require('bcryptjs');
--     const hash = await bcrypt.hash('YourPassword123', 10);
--     -- Then UPDATE users SET password_hash = '<hash>' WHERE email = '...';
--
-- DO NOT store plain-text passwords in this file.
-- =====================================================

-- Insert admin users with placeholder hashes.
-- IMPORTANT: Replace these hashes before going live.
-- Generate real hashes with: bcrypt.hash(password, 10)

INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES
  -- Replace password_hash values below with real bcrypt hashes
  ('admin@gmail.com',  '$2a$10$PLACEHOLDER_REPLACE_WITH_REAL_HASH_admin',  'Admin',  'admin', true),
  ('benon@gmail.com', '$2a$10$PLACEHOLDER_REPLACE_WITH_REAL_HASH_benon', 'Benon', 'admin', true),
  ('paul@gmail.com', '$2a$10$PLACEHOLDER_REPLACE_WITH_REAL_HASH_paul', 'Paul', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- HOW THE AUTH LAYER WORKS (no Supabase)
--
-- Login flow (src/lib/auth/provider.ts):
--   1. User submits email + password
--   2. App queries: SELECT * FROM users WHERE email = $1 AND is_active = true
--   3. bcrypt.compare(submittedPassword, user.password_hash)
--   4. If match: sign JWT with { userId, email, role }, set httpOnly cookie
--   5. Middleware verifies JWT on every request
--
-- Session:
--   - JWT stored as httpOnly cookie (not localStorage)
--   - Expiry: 7 days (configurable via JWT_EXPIRES_IN env var)
--   - Refresh: sliding window — reissued on each request if < 1 day remaining
--
-- Password reset:
--   - Generate a signed time-limited token (not stored in DB)
--   - Send link via email provider (src/lib/email/provider.ts)
--   - On reset: bcrypt.hash(newPassword, 10), UPDATE users SET password_hash = $1
-- =====================================================
