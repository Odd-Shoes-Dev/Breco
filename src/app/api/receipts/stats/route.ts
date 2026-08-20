import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');

    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    let receipts;
    if (customerId) {
      receipts = await sql`
        SELECT total, amount_paid, currency, invoice_date, status, document_type
        FROM invoices
        WHERE customer_id = ${customerId} AND status != 'void'
      `;
    } else {
      receipts = await sql`
        SELECT total, amount_paid, currency, invoice_date, status, document_type
        FROM invoices
        WHERE status != 'void'
      `;
    }

    let totalAmount = 0;
    let thisMonthCount = 0;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const receipt of receipts) {
      if (receipt.document_type !== 'receipt') continue;

      const amountPaid = parseFloat(receipt.amount_paid) || parseFloat(receipt.total) || 0;
      let amountInBase = amountPaid;

      if (receipt.currency && receipt.currency !== baseCurrency) {
        try {
          const res = await sql`SELECT convert_currency(${amountPaid}, ${receipt.currency}, ${baseCurrency}, ${receipt.invoice_date}) AS val`;
          amountInBase = Number(res[0]?.val ?? amountPaid);
        } catch {
          amountInBase = amountPaid;
        }
      }

      totalAmount += amountInBase;

      const receiptDate = new Date(receipt.invoice_date);
      if (receiptDate >= firstDayOfMonth) {
        thisMonthCount++;
      }
    }

    return NextResponse.json({
      totalAmount,
      totalCount: receipts.filter((r: any) => r.document_type === 'receipt').length,
      thisMonthCount,
      currency: baseCurrency,
    });
  } catch (error) {
    console.error('Error calculating receipts stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate receipts stats' },
      { status: 500 }
    );
  }
}
