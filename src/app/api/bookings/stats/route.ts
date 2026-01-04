import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bookings/stats - Get booking statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get all bookings for statistics
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('status, total, amount_paid, balance_due');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const stats = {
      totalBookings: bookings.length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      pending: bookings.filter(b => b.status === 'pending').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      totalRevenue: bookings.reduce((sum, b) => sum + (b.total || 0), 0),
      totalPaid: bookings.reduce((sum, b) => sum + (b.amount_paid || 0), 0),
      totalOutstanding: bookings.reduce((sum, b) => sum + (b.balance_due || 0), 0),
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
