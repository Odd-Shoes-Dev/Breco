import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoiceRows = await sql`
      SELECT total, amount_paid, currency, invoice_date, status
      FROM invoices
      WHERE customer_id = ${id}
    `;

    let totalOutstanding = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const invoice of invoiceRows as any[]) {
      if (['paid', 'void', 'cancelled'].includes(invoice.status)) continue;

      const remaining = (parseFloat(invoice.total) || 0) - (parseFloat(invoice.amount_paid) || 0);
      if (remaining <= 0) continue;

      let remainingInUSD = remaining;
      if (invoice.currency && invoice.currency !== 'USD') {
        try {
          const convRows = await sql`
            SELECT convert_currency(${remaining}, ${invoice.currency}, 'USD', ${invoice.invoice_date || today}) AS result
          `;
          remainingInUSD = Number(convRows[0]?.result ?? remaining);
        } catch {
          // fallback to unconverted
        }
      }

      totalOutstanding += remainingInUSD;
    }

    return NextResponse.json({
      outstandingBalance: totalOutstanding,
      currency: 'USD',
    });
  } catch (error) {
    console.error('Error calculating customer balance:', error);
    return NextResponse.json(
      { error: 'Failed to calculate customer balance' },
      { status: 500 }
    );
  }
}
