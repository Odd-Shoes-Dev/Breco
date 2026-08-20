import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get all bills for this vendor
    const bills = await sql`
      SELECT total, amount_paid, currency, bill_date, status
      FROM bills
      WHERE vendor_id = ${id}
    `;

    let totalOutstanding = 0;

    for (const bill of bills) {
      if (bill.status === 'paid' || bill.status === 'void') continue;

      const total = parseFloat(bill.total) || 0;
      const paid = parseFloat(bill.amount_paid) || 0;
      const remaining = total - paid;

      if (remaining <= 0) continue;

      let remainingInUSD = remaining;

      if (bill.currency && bill.currency !== 'USD') {
        const res = await sql`SELECT convert_currency(${remaining}, ${bill.currency}, 'USD', ${bill.bill_date}) AS val`;
        remainingInUSD = res[0]?.val ?? remaining;
      }

      totalOutstanding += remainingInUSD;
    }

    return NextResponse.json({
      outstandingBalance: totalOutstanding,
      currency: 'USD',
    });
  } catch (error) {
    console.error('Error calculating vendor balance:', error);
    return NextResponse.json(
      { error: 'Failed to calculate vendor balance' },
      { status: 500 }
    );
  }
}
