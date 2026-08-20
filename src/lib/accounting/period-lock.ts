import { sql } from '@/lib/db';

/**
 * Check if a given date falls within a closed or locked fiscal period
 * @param transactionDate - The date to check
 * @returns Object with isClosed boolean and error message if applicable
 */
export async function isPeriodClosed(
  transactionDate: string | Date
): Promise<{ isClosed: boolean; message?: string; period?: any }> {
  try {
    const date = typeof transactionDate === 'string'
      ? new Date(transactionDate)
      : transactionDate;

    const dateStr = date.toISOString().split('T')[0];

    // Query fiscal periods that contain this date and are closed/locked
    const periods = await sql`
      SELECT * FROM fiscal_periods
      WHERE start_date <= ${dateStr}
        AND end_date >= ${dateStr}
        AND status IN ('closed', 'locked')
      ORDER BY level DESC
      LIMIT 1
    `;

    if (periods && periods.length > 0) {
      const period = periods[0];
      return {
        isClosed: true,
        message: `Cannot modify transaction: The ${period.level} period "${period.name}" (${period.start_date} to ${period.end_date}) is ${period.status}.`,
        period,
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
 * @param userId - The user's ID to check
 * @returns true if user is admin
 */
export async function canOverridePeriodLock(
  userId: string
): Promise<boolean> {
  try {
    if (!userId) return false;

    const rows = await sql`
      SELECT role FROM users WHERE id = ${userId} LIMIT 1
    `;

    return rows[0]?.role === 'admin';
  } catch (error) {
    console.error('Error checking period lock override permission:', error);
    return false;
  }
}

/**
 * Validate transaction date against period locks
 * Use this in API routes before creating/updating transactions
 * @param transactionDate - The date to validate
 * @param allowAdminOverride - Whether to allow admins to override (default: false)
 * @param userId - User ID for admin check (required if allowAdminOverride is true)
 * @returns Error message if period is closed, null if allowed
 */
export async function validatePeriodLock(
  transactionDate: string | Date,
  allowAdminOverride: boolean = false,
  userId?: string
): Promise<string | null> {
  const lockCheck = await isPeriodClosed(transactionDate);

  if (!lockCheck.isClosed) {
    return null; // Period is open, allow transaction
  }

  // If admin override is allowed, check if user is admin
  if (allowAdminOverride && userId) {
    const isAdmin = await canOverridePeriodLock(userId);
    if (isAdmin) {
      return null; // Admin can override
    }
  }

  return lockCheck.message || 'Cannot modify transaction in a closed period.';
}
