import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

// GET /api/reports/profit-loss
export async function GET(request: NextRequest) {
  try {
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    // Get all revenue accounts (4xxx)
    const revenueAccounts = await sql`
      SELECT id, code, name FROM accounts
      WHERE code >= '4000' AND code < '5000'
      ORDER BY code
    `;

    // Get all expense accounts (5xxx-9xxx)
    const expenseAccounts = await sql`
      SELECT id, code, name FROM accounts
      WHERE code >= '5000'
      ORDER BY code
    `;

    // Get invoices for the period (revenue)
    const invoices = await sql`
      SELECT id, total, currency, invoice_date, status FROM invoices
      WHERE invoice_date >= ${startDate} AND invoice_date <= ${endDate}
    `;

    // Get bills for the period (expenses)
    const bills = await sql`
      SELECT id, total, currency, bill_date, status FROM bills
      WHERE bill_date >= ${startDate} AND bill_date <= ${endDate}
    `;

    // Get expenses for the period
    const expenses = await sql`
      SELECT id, amount, currency, date, category FROM expenses
      WHERE date >= ${startDate} AND date <= ${endDate}
    `;

    // Get journal entry lines for the period
    const entries = await sql`
      SELECT jl.account_id, jl.debit, jl.credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE je.status = 'posted'
        AND je.entry_date >= ${startDate}
        AND je.entry_date <= ${endDate}
    `;

    // Calculate totals by account
    const accountTotals: Record<string, { debit: number; credit: number }> = {};

    entries.forEach((entry: any) => {
      if (!accountTotals[entry.account_id]) {
        accountTotals[entry.account_id] = { debit: 0, credit: 0 };
      }
      accountTotals[entry.account_id].debit += entry.debit || 0;
      accountTotals[entry.account_id].credit += entry.credit || 0;
    });

    // Build revenue section
    const revenue: any[] = [];
    let totalRevenue = 0;

    revenueAccounts.forEach((account: any) => {
      const totals = accountTotals[account.id] || { debit: 0, credit: 0 };
      const balance = totals.credit - totals.debit;
      if (balance !== 0) {
        revenue.push({
          code: account.code,
          name: account.name,
          amount: balance,
        });
        totalRevenue += balance;
      }
    });

    // Add invoice revenue (convert to base currency)
    for (const invoice of invoices) {
      let amountInBase = invoice.total;
      const currency = invoice.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${invoice.total}, ${currency}, ${baseCurrency}, ${invoice.invoice_date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }

      totalRevenue += amountInBase;
    }

    if (totalRevenue > 0 && invoices && invoices.length > 0) {
      revenue.push({
        code: '4000',
        name: 'Sales Revenue',
        amount: totalRevenue - revenue.reduce((sum: number, item: any) => sum + item.amount, 0),
      });
    }

    // Build expense sections
    const costOfSales: any[] = [];
    const operatingExpenses: any[] = [];
    const otherExpenses: any[] = [];
    let totalCostOfSales = 0;
    let totalOperatingExpenses = 0;
    let totalOtherExpenses = 0;

    expenseAccounts.forEach((account: any) => {
      const totals = accountTotals[account.id] || { debit: 0, credit: 0 };
      const balance = totals.debit - totals.credit;
      if (balance !== 0) {
        const item = {
          code: account.code,
          name: account.name,
          amount: balance,
        };

        if (account.code.startsWith('51')) {
          costOfSales.push(item);
          totalCostOfSales += balance;
        } else if (account.code.startsWith('5') || account.code.startsWith('6')) {
          operatingExpenses.push(item);
          totalOperatingExpenses += balance;
        } else {
          otherExpenses.push(item);
          totalOtherExpenses += balance;
        }
      }
    });

    // Add bills to operating expenses (convert to base currency)
    for (const bill of bills) {
      let amountInBase = bill.total;
      const currency = bill.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${bill.total}, ${currency}, ${baseCurrency}, ${bill.bill_date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }

      totalOperatingExpenses += amountInBase;
    }

    // Add expenses to operating expenses (convert to base currency)
    for (const expense of expenses) {
      let amountInBase = expense.amount;
      const currency = expense.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${expense.amount}, ${currency}, ${baseCurrency}, ${expense.date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }

      totalOperatingExpenses += amountInBase;
    }

    if (bills && bills.length > 0) {
      const billsTotal = bills.reduce((sum: number, bill: any) => sum + bill.total, 0);
      operatingExpenses.push({
        code: '5000',
        name: 'Vendor Bills',
        amount: billsTotal,
      });
    }

    if (expenses && expenses.length > 0) {
      const expensesTotal = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
      operatingExpenses.push({
        code: '5100',
        name: 'Operating Expenses',
        amount: expensesTotal,
      });
    }

    const grossProfit = totalRevenue - totalCostOfSales;
    const operatingIncome = grossProfit - totalOperatingExpenses;
    const netIncome = operatingIncome - totalOtherExpenses;

    return NextResponse.json({
      data: {
        period: { startDate, endDate },
        currency: baseCurrency,
        revenue: {
          items: revenue,
          total: totalRevenue,
        },
        costOfSales: {
          items: costOfSales,
          total: totalCostOfSales,
        },
        grossProfit,
        operatingExpenses: {
          items: operatingExpenses,
          total: totalOperatingExpenses,
        },
        operatingIncome,
        otherExpenses: {
          items: otherExpenses,
          total: totalOtherExpenses,
        },
        netIncome,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
