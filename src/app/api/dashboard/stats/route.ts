import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

export async function GET() {
  try {
    const supabase = await createClient();
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    // Fetch all financial data
    const [
      { data: invoices },
      { data: bills },
      { data: expenses },
      { data: bankTransactions },
    ] = await Promise.all([
      supabase.from('invoices').select('total, amount_paid, status, currency, invoice_date'),
      supabase.from('bills').select('total, amount_paid, status, currency, bill_date'),
      supabase.from('expenses').select('total, currency, expense_date'),
      supabase.from('bank_transactions').select('amount, transaction_type, transaction_date, bank_accounts(currency)'),
    ]);

    let totalRevenue = 0;
    let totalExpenses = 0;
    let accountsReceivable = 0;
    let accountsPayable = 0;
    let cashBalance = 0;

    // Process invoices
    if (invoices) {
      for (const invoice of invoices) {
        let amountInBase = invoice.total;
        let remainingInBase = invoice.total - (invoice.amount_paid || 0);

        if (invoice.currency !== baseCurrency) {
          const { data: convertedTotal } = await supabase.rpc('convert_currency', {
            p_amount: invoice.total,
            p_from_currency: invoice.currency,
            p_to_currency: baseCurrency,
            p_date: invoice.invoice_date,
          });

          const { data: convertedRemaining } = await supabase.rpc('convert_currency', {
            p_amount: invoice.total - (invoice.amount_paid || 0),
            p_from_currency: invoice.currency,
            p_to_currency: baseCurrency,
            p_date: invoice.invoice_date,
          });

          amountInBase = convertedTotal ?? 0;
          remainingInBase = convertedRemaining ?? 0;
        }

        if (invoice.status === 'paid') {
          totalRevenue += amountInBase;
        }

        if (invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'cancelled') {
          accountsReceivable += remainingInBase;
        }
      }
    }

    // Process bills
    if (bills) {
      for (const bill of bills) {
        let remainingInBase = bill.total - (bill.amount_paid || 0);

        if (bill.currency !== baseCurrency) {
          const { data: convertedRemaining } = await supabase.rpc('convert_currency', {
            p_amount: bill.total - (bill.amount_paid || 0),
            p_from_currency: bill.currency,
            p_to_currency: baseCurrency,
            p_date: bill.bill_date,
          });

          remainingInBase = convertedRemaining ?? 0;
        }

        if (bill.status !== 'paid' && bill.status !== 'void') {
          accountsPayable += remainingInBase;
        }
      }
    }

    // Process expenses
    if (expenses) {
      for (const expense of expenses) {
        let amountInBase = expense.total;

        if (expense.currency !== baseCurrency) {
          const { data: converted } = await supabase.rpc('convert_currency', {
            p_amount: expense.total,
            p_from_currency: expense.currency,
            p_to_currency: baseCurrency,
            p_date: expense.expense_date,
          });

          amountInBase = converted ?? 0;
        }

        totalExpenses += amountInBase;
      }
    }

    // Process bank transactions for cash balance
    if (bankTransactions) {
      for (const transaction of bankTransactions) {
        const bankAccount = Array.isArray(transaction.bank_accounts)
          ? transaction.bank_accounts[0]
          : transaction.bank_accounts;
        const currency = bankAccount?.currency || baseCurrency;

        let amountInBase = transaction.amount || 0;

        if (currency !== baseCurrency) {
          const { data: converted } = await supabase.rpc('convert_currency', {
            p_amount: Math.abs(transaction.amount),
            p_from_currency: currency,
            p_to_currency: baseCurrency,
            p_date: transaction.transaction_date,
          });

          if (converted !== null) {
            amountInBase = transaction.amount < 0 ? -converted : converted;
          } else {
            amountInBase = 0;
          }
        }

        cashBalance += amountInBase;
      }
    }

    // Calculate inventory value
    let inventoryValue = 0;
    const { data: inventoryItems } = await supabase
      .from('products')
      .select('quantity_on_hand, cost_price, currency')
      .eq('track_inventory', true);

    if (inventoryItems) {
      for (const item of inventoryItems) {
        const quantity = item.quantity_on_hand || 0;
        const cost = item.cost_price || 0;
        const itemValue = quantity * cost;

        if (itemValue > 0) {
          let valueInBase = itemValue;

          if (item.currency && item.currency !== baseCurrency) {
            const { data: converted } = await supabase.rpc('convert_currency', {
              p_amount: itemValue,
              p_from_currency: item.currency,
              p_to_currency: baseCurrency,
              p_date: new Date().toISOString().split('T')[0],
            });

            valueInBase = converted ?? 0;
          }

          inventoryValue += valueInBase;
        }
      }
    }

    const netIncome = totalRevenue - totalExpenses;

    return NextResponse.json({
      totalRevenue,
      totalExpenses,
      netIncome,
      accountsReceivable,
      accountsPayable,
      cashBalance,
      inventoryValue,
      currency: baseCurrency,
    });
  } catch (error: any) {
    console.error('Failed to calculate dashboard stats:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
