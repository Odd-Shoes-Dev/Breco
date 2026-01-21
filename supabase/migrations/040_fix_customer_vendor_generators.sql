-- =====================================================
-- Fix: Add missing customer and vendor number generators
-- This fixes the RLS issue where customer/vendor creation fails
-- =====================================================

-- Customer number generator (was missing from initial schema)
CREATE OR REPLACE FUNCTION generate_customer_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'CUST-' || LPAD(nextval('customer_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vendor number generator (was missing from initial schema)
CREATE OR REPLACE FUNCTION generate_vendor_number() RETURNS VARCHAR AS $$
BEGIN
  RETURN 'VEND-' || LPAD(nextval('vendor_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_customer_number() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_vendor_number() TO authenticated;

-- Also ensure RLS helper functions have proper grants
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_accountant_or_above() TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_operations_or_above() TO authenticated;

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Customer and vendor number generators created successfully!';
  RAISE NOTICE 'You can now create customers and vendors with RLS enabled.';
END $$;
