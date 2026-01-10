import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check if a given date falls within a closed or locked fiscal period
 * @param supabase - Supabase client
 * @param transactionDate - The date to check
 * @returns Object with isClosed boolean and error message if applicable
 */
export async function isPeriodClosed(
  supabase: SupabaseClient,
  transactionDate: string | Date
): Promise<{ isClosed: boolean; message?: string; period?: any }> {
  try {
    const date = typeof transactionDate === 'string' 
      ? new Date(transactionDate) 
      : transactionDate;

    // Query fiscal periods that contain this date and are closed/locked
    const { data: periods, error } = await supabase
      .from('fiscal_periods')
      .select('*')
      .lte('start_date', date.toISOString().split('T')[0])
      .gte('end_date', date.toISOString().split('T')[0])
      .in('status', ['closed', 'locked'])
      .order('level', { ascending: false }) // Check smallest period first (month before quarter before year)
      .limit(1);

    if (error) {
      console.error('Error checking period lock:', error);
      return { isClosed: false };
    }

    if (periods && periods.length > 0) {
      const period = periods[0];
      return {
        isClosed: true,
        message: `Cannot modify transaction: The ${period.level} period "${period.name}" (${period.start_date} to ${period.end_date}) is ${period.status}.`,
        period: period
      };
    }

    return { isClosed: false };
  } catch (error) {
    console.error('Error in isPeriodClosed:', error);
    return { isClosed: false };
  }
}

/**
 * Check if user has permission to override period locks (admin only)
 * @param supabase - Supabase client
 * @returns true if user is admin
 */
export async function canOverridePeriodLock(
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return profile?.role === 'admin';
  } catch (error) {
    console.error('Error checking period lock override permission:', error);
    return false;
  }
}

/**
 * Validate transaction date against period locks
 * Use this in API routes before creating/updating transactions
 * @param supabase - Supabase client
 * @param transactionDate - The date to validate
 * @param allowAdminOverride - Whether to allow admins to override (default: false)
 * @returns Error message if period is closed, null if allowed
 */
export async function validatePeriodLock(
  supabase: SupabaseClient,
  transactionDate: string | Date,
  allowAdminOverride: boolean = false
): Promise<string | null> {
  const lockCheck = await isPeriodClosed(supabase, transactionDate);
  
  if (!lockCheck.isClosed) {
    return null; // Period is open, allow transaction
  }

  // If admin override is allowed, check if user is admin
  if (allowAdminOverride) {
    const isAdmin = await canOverridePeriodLock(supabase);
    if (isAdmin) {
      return null; // Admin can override
    }
  }

  return lockCheck.message || 'Cannot modify transaction in a closed period.';
}
