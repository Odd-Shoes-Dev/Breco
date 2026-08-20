import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

async function convertCurrencyDB(amount: number, from: string, to: string, date: string): Promise<number> {
  if (from === to) return amount;
  try {
    const rows = await sql`SELECT convert_currency(${amount}, ${from}, ${to}, ${date}) AS result`;
    return Number(rows[0]?.result ?? amount);
  } catch {
    return amount;
  }
}

// GET /api/bookings/stats - Get booking statistics (money totals in base currency)
export async function GET(request: NextRequest) {
  try {
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;
    const today = new Date().toISOString().split('T')[0];

    const rows = await sql`SELECT status, total, amount_paid, balance_due, currency, booking_date FROM bookings`;
    const bookings = rows as any[];

    let totalRevenue = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let paidRevenue = 0; // amount_paid for non-cancelled/refunded bookings

    for (const b of bookings) {
      const bookingCurrency = b.currency || baseCurrency;
      const date = b.booking_date || today;
      const totalInBase = await convertCurrencyDB(Number(b.total) || 0, bookingCurrency, baseCurrency, date);
      const paidInBase = await convertCurrencyDB(Number(b.amount_paid) || 0, bookingCurrency, baseCurrency, date);
      const dueInBase = await convertCurrencyDB(Number(b.balance_due) || 0, bookingCurrency, baseCurrency, date);

      totalRevenue += totalInBase;
      totalPaid += paidInBase;
      totalOutstanding += dueInBase;
      if (!['cancelled', 'refunded'].includes(b.status)) {
        paidRevenue += paidInBase;
      }
    }

    const stats = {
      totalBookings: bookings.length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      pending: bookings.filter(b => b.status === 'pending').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      totalRevenue,
      totalPaid,
      totalOutstanding,
      paidRevenue,
      currency: baseCurrency,
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
