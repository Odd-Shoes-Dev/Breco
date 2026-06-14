import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

// GET /api/reports/profit-loss
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    // Get all revenue accounts (4xxx)
    const { data: revenueAccounts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .gte('code', '4000')
      .lt('code', '5000')
      .order('code');

    // Get all expense accounts (5xxx-9xxx)
    const { data: expenseAccounts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .gte('code', '5000')
      .order('code');

    // Get invoices for the period (revenue)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, total, currency, invoice_date, status')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate);

    // Get bills for the period (expenses)
    const { data: bills } = await supabase
      .from('bills')
      .select('id, total, currency, bill_date, status')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    // Get expenses for the period
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, amount, currency, date, category')
      .gte('date', startDate)
      .lte('date', endDate);

    // Get journal entry lines for the period
    const { data: entries } = await supabase
      .from('journal_lines')
      .select(`
        account_id,
        debit,
        credit,
        journal_entry:journal_entries!inner (entry_date, status)
      `)
      .eq('journal_entry.status', 'posted')
      .gte('journal_entry.entry_date', startDate)
      .lte('journal_entries.entry_date', endDate);

    // Calculate totals by account
    const accountTotals: Record<string, { debit: number; credit: number }> = {};

    entries?.forEach((entry: any) => {
      if (!accountTotals[entry.account_id]) {
        accountTotals[entry.account_id] = { debit: 0, credit: 0 };
      }
      accountTotals[entry.account_id].debit += entry.debit || 0;
      accountTotals[entry.account_id].credit += entry.credit || 0;
    });

    // Build revenue section
    const revenue: any[] = [];
    let totalRevenue = 0;

    revenueAccounts?.forEach((account) => {
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
    for (const invoice of invoices || []) {
      let amountInBase = invoice.total;
      const currency = invoice.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: invoice.total,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: invoice.invoice_date,
        });
        amountInBase = convertedValue ?? 0;
      }

      totalRevenue += amountInBase;
    }

    if (totalRevenue > 0 && invoices && invoices.length > 0) {
      revenue.push({
        code: '4000',
        name: 'Sales Revenue',
        amount: totalRevenue - revenue.reduce((sum, item) => sum + item.amount, 0),
      });
    }

    // Build expense sections
    const costOfSales: any[] = [];
    const operatingExpenses: any[] = [];
    const otherExpenses: any[] = [];
    let totalCostOfSales = 0;
    let totalOperatingExpenses = 0;
    let totalOtherExpenses = 0;

    expenseAccounts?.forEach((account) => {
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
    for (const bill of bills || []) {
      let amountInBase = bill.total;
      const currency = bill.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: bill.total,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: bill.bill_date,
        });
        amountInBase = convertedValue ?? 0;
      }

      totalOperatingExpenses += amountInBase;
    }

    // Add expenses to operating expenses (convert to base currency)
    for (const expense of expenses || []) {
      let amountInBase = expense.amount;
      const currency = expense.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: expense.amount,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: expense.date,
        });
        amountInBase = convertedValue ?? 0;
      }

      totalOperatingExpenses += amountInBase;
    }

    if (bills && bills.length > 0) {
      const billsTotal = bills.reduce((sum, bill) => sum + bill.total, 0);
      operatingExpenses.push({
        code: '5000',
        name: 'Vendor Bills',
        amount: billsTotal,
      });
    }

    if (expenses && expenses.length > 0) {
      const expensesTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);
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
