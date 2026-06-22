import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

export async function GET() {
  try {
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const rows = await sql`SELECT amount, currency, expense_date, status FROM expenses`;

    let thisMonthTotal = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let paidCount = 0;

    for (const expense of rows as any[]) {
      const amount = parseFloat(expense.amount) || 0;
      let amountInBase = amount;

      if (expense.currency && expense.currency !== baseCurrency) {
        try {
          const convRows = await sql`
            SELECT convert_currency(${amount}, ${expense.currency}, ${baseCurrency}, ${expense.expense_date}) AS result
          `;
          amountInBase = Number(convRows[0]?.result ?? amount);
        } catch {
          // fallback to unconverted
        }
      }

      if (expense.expense_date >= firstDayOfMonth && expense.expense_date <= lastDayOfMonth) {
        thisMonthTotal += amountInBase;
      }

      const status = expense.status?.toLowerCase() || 'pending';
      if (status === 'pending' || status === 'pending_approval') {
        pendingCount++;
      } else if (status === 'approved') {
        approvedCount++;
      } else if (status === 'paid') {
        paidCount++;
      }
    }

    return NextResponse.json({
      thisMonth: thisMonthTotal,
      pendingApproval: pendingCount,
      approved: approvedCount,
      paid: paidCount,
      currency: baseCurrency,
    });
  } catch (error) {
    console.error('Error calculating expense stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate expense stats' },
      { status: 500 }
    );
  }
}
