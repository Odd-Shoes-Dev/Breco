-- Migration 038: Create two additional admin users
-- Creates Paul and Benon with admin privileges

-- Note: For Supabase, user creation is typically done via the Auth API
-- This migration creates the user_profiles entries
-- You'll need to create the actual auth users via Supabase Dashboard or API

-- First, we'll assume the auth users will be created via Dashboard
-- and we'll prepare the user_profiles for when they sign up

-- Alternatively, if you have direct database access to auth schema:
-- You can uncomment and run these after getting the UUIDs from auth.users

-- INSERT INTO auth.users (
--   id,
--   email,
--   encrypted_password,
--   email_confirmed_at,
--   created_at,
--   updated_at,
--   raw_app_meta_data,
--   raw_user_meta_data,
--   is_super_admin,
--   role
-- )
-- VALUES
--   (gen_random_uuid(), 'paul@gmail.com', crypt('Paul@Breco2025', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Paul"}', false, 'authenticated'),
--   (gen_random_uuid(), 'benon@gmail.com', crypt('Benon@Breco2025', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Benon"}', false, 'authenticated')
-- ON CONFLICT (email) DO NOTHING;

-- For now, add a comment explaining manual steps needed
COMMENT ON TABLE user_profiles IS 'To add Paul and Benon as admins: 1) Create users in Supabase Dashboard Auth with emails paul@gmail.com and benon@gmail.com, 2) Set their passwords, 3) Update their user_profiles role to admin';

-- Create a helper function to set user as admin (to be run after user creation)
CREATE OR REPLACE FUNCTION set_user_as_admin(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET role = 'admin',
      is_active = true,
      updated_at = now()
  WHERE email = user_email;
END;
$$;

COMMENT ON FUNCTION set_user_as_admin IS 'Helper function to set a user as admin. Usage: SELECT set_user_as_admin(''paul@gmail.com'');';
