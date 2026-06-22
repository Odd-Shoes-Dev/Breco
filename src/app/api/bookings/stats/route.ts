import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bookings/stats - Get booking statistics
export async function GET(request: NextRequest) {
  try {
    const rows = await sql`SELECT status, total, amount_paid, balance_due FROM bookings`;
    const bookings = rows as any[];

    const stats = {
      totalBookings: bookings.length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      pending: bookings.filter(b => b.status === 'pending').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      totalRevenue: bookings.reduce((sum, b) => sum + (Number(b.total) || 0), 0),
      totalPaid: bookings.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0),
      totalOutstanding: bookings.reduce((sum, b) => sum + (Number(b.balance_due) || 0), 0),
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
