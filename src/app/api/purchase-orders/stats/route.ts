import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
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

// GET /api/purchase-orders/stats - Purchase order statistics (totals in base currency)
export async function GET() {
  try {
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;
    const today = new Date().toISOString().split('T')[0];

    const rows = await sql`SELECT status, total, currency, order_date FROM purchase_orders`;
    const orders = rows as any[];

    let totalValue = 0;
    for (const order of orders) {
      const amount = Number(order.total) || 0;
      const orderCurrency = order.currency || baseCurrency;
      totalValue += await convertCurrencyDB(amount, orderCurrency, baseCurrency, order.order_date || today);
    }

    return NextResponse.json({
      draft: orders.filter((o) => o.status === 'draft').length,
      sent: orders.filter((o) => o.status === 'sent').length,
      partial: orders.filter((o) => o.status === 'partial').length,
      received: orders.filter((o) => o.status === 'received').length,
      totalValue,
      currency: baseCurrency,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
