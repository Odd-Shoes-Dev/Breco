-- =====================================================
-- Fix User Signup Trigger
-- Changes default role from 'viewer' to 'sales'
-- =====================================================

-- Update the function to use 'sales' instead of 'viewer'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'sales',  -- Default role for new users
    true      -- Activate new users by default
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a user profile when a new user signs up. Default role is sales.';
