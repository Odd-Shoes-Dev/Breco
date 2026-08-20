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

export async function GET() {
  try {
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const [invoiceRows, billRows, expenseRows, bankTxRows] = await Promise.all([
      sql`SELECT total, amount_paid, status, currency, invoice_date FROM invoices`,
      sql`SELECT total, amount_paid, status, currency, bill_date FROM bills`,
      sql`SELECT amount, currency, expense_date FROM expenses`,
      sql`
        SELECT bt.amount, bt.transaction_type, bt.transaction_date, ba.currency AS bank_currency
        FROM bank_transactions bt
        LEFT JOIN bank_accounts ba ON ba.id = bt.bank_account_id
      `,
    ]);

    let totalRevenue = 0;
    let totalExpenses = 0;
    let accountsReceivable = 0;
    let accountsPayable = 0;
    let cashBalance = 0;

    for (const invoice of invoiceRows as any[]) {
      const total = Number(invoice.total);
      const remaining = total - (Number(invoice.amount_paid) || 0);
      const amountInBase = await convertCurrencyDB(total, invoice.currency, baseCurrency, invoice.invoice_date);
      const remainingInBase = await convertCurrencyDB(remaining, invoice.currency, baseCurrency, invoice.invoice_date);

      if (invoice.status === 'paid') totalRevenue += amountInBase;
      if (invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'cancelled') {
        accountsReceivable += remainingInBase;
      }
    }

    for (const bill of billRows as any[]) {
      const remaining = Number(bill.total) - (Number(bill.amount_paid) || 0);
      const remainingInBase = await convertCurrencyDB(remaining, bill.currency, baseCurrency, bill.bill_date);
      if (bill.status !== 'paid' && bill.status !== 'void') {
        accountsPayable += remainingInBase;
      }
    }

    for (const expense of expenseRows as any[]) {
      const amountInBase = await convertCurrencyDB(Number(expense.amount), expense.currency, baseCurrency, expense.expense_date);
      totalExpenses += amountInBase;
    }

    for (const transaction of bankTxRows as any[]) {
      const currency = transaction.bank_currency || baseCurrency;
      const raw = Number(transaction.amount) || 0;
      if (currency !== baseCurrency) {
        const converted = await convertCurrencyDB(Math.abs(raw), currency, baseCurrency, transaction.transaction_date);
        cashBalance += raw < 0 ? -converted : converted;
      } else {
        cashBalance += raw;
      }
    }

    let inventoryValue = 0;
    // products table does not have quantity_on_hand or currency columns;
    // inventory value should be derived from stock_movements or the inventory account balance
    // For now, set to 0 until proper inventory tracking is implemented

    return NextResponse.json({
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      accountsReceivable,
      accountsPayable,
      cashBalance,
      inventoryValue,
      currency: baseCurrency,
    });
  } catch (error: any) {
    console.error('Failed to calculate dashboard stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
