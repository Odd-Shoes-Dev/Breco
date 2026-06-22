import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { updateExchangeRates } from '@/lib/currency';

// GET /api/exchange-rates - Fetch latest exchange rates
export async function GET(request: NextRequest) {
  try {
    const rows = await sql`
      SELECT * FROM exchange_rates ORDER BY effective_date DESC LIMIT 100
    `;

    return NextResponse.json({ data: rows as any[] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/exchange-rates - Update exchange rates from API
export async function POST(request: NextRequest) {
  try {
    const success = await updateExchangeRates();

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update exchange rates' },
        { status: 500 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const rows = await sql`
      SELECT * FROM exchange_rates WHERE effective_date = ${today} ORDER BY from_currency
    `;

    return NextResponse.json({
      success: true,
      message: 'Exchange rates updated successfully',
      data: rows as any[],
    });
  } catch (error: any) {
    console.error('Error updating exchange rates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
