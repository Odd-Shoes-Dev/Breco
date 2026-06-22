import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getCompanySettings } from '@/lib/company-settings';

export async function GET(request: NextRequest) {
  try {
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    // Get bank accounts
    const bankAccounts = await sql`SELECT id, name, currency FROM bank_accounts`;

    // Get beginning cash balance (transactions before start date)
    let beginningCash = 0;
    for (const account of bankAccounts) {
      const beginningTransactions = await sql`
        SELECT amount, transaction_date FROM bank_transactions
        WHERE bank_account_id = ${account.id} AND transaction_date < ${startDate}
      `;

      const accountBeginningBalance = beginningTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);

      let balanceInBase = accountBeginningBalance;
      const currency = account.currency || baseCurrency;
      if (currency !== baseCurrency && accountBeginningBalance !== 0) {
        const converted = await sql`SELECT convert_currency(${Math.abs(accountBeginningBalance)}, ${currency}, ${baseCurrency}, ${startDate}) AS val`;
        const convertedValue = converted[0]?.val ?? null;
        if (convertedValue !== null) {
          balanceInBase = accountBeginningBalance < 0 ? -convertedValue : convertedValue;
        } else {
          balanceInBase = 0;
        }
      }
      beginningCash += balanceInBase;
    }

    // Get period transactions for cash flow calculation
    let netChangeInCash = 0;
    for (const account of bankAccounts) {
      const periodTransactions = await sql`
        SELECT amount, transaction_date FROM bank_transactions
        WHERE bank_account_id = ${account.id}
          AND transaction_date >= ${startDate}
          AND transaction_date <= ${endDate}
      `;

      const accountPeriodChange = periodTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);

      let changeInBase = accountPeriodChange;
      const currency = account.currency || baseCurrency;
      if (currency !== baseCurrency && accountPeriodChange !== 0) {
        const converted = await sql`SELECT convert_currency(${Math.abs(accountPeriodChange)}, ${currency}, ${baseCurrency}, ${endDate}) AS val`;
        const convertedValue = converted[0]?.val ?? null;
        if (convertedValue !== null) {
          changeInBase = accountPeriodChange < 0 ? -convertedValue : convertedValue;
        } else {
          changeInBase = 0;
        }
      }
      netChangeInCash += changeInBase;
    }

    // Get revenue for period (from invoices)
    const invoices = await sql`
      SELECT total, currency, invoice_date FROM invoices
      WHERE invoice_date >= ${startDate} AND invoice_date <= ${endDate}
    `;

    let totalRevenue = 0;
    for (const invoice of invoices) {
      let amountInBase = invoice.total;
      const currency = invoice.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${invoice.total}, ${currency}, ${baseCurrency}, ${invoice.invoice_date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }
      totalRevenue += amountInBase;
    }

    // Get expenses for period (from bills and expenses)
    const bills = await sql`
      SELECT total, currency, bill_date FROM bills
      WHERE bill_date >= ${startDate} AND bill_date <= ${endDate}
    `;

    const expenses = await sql`
      SELECT amount, currency, date FROM expenses
      WHERE date >= ${startDate} AND date <= ${endDate}
    `;

    let totalExpenses = 0;
    for (const bill of bills) {
      let amountInBase = bill.total;
      const currency = bill.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${bill.total}, ${currency}, ${baseCurrency}, ${bill.bill_date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }
      totalExpenses += amountInBase;
    }

    for (const expense of expenses) {
      let amountInBase = expense.amount;
      const currency = expense.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${expense.amount}, ${currency}, ${baseCurrency}, ${expense.date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }
      totalExpenses += amountInBase;
    }

    const netIncome = totalRevenue - totalExpenses;

    // Get depreciation from fixed assets
    const assets = await sql`
      SELECT accumulated_depreciation, purchase_date, useful_life_months, purchase_price, salvage_value
      FROM fixed_assets
      WHERE status = 'active' AND purchase_date <= ${endDate}
    `;

    let depreciation = 0;
    for (const asset of assets) {
      const monthlyDepreciation = (asset.purchase_price - asset.salvage_value) / asset.useful_life_months;
      const startMonth = new Date(Math.max(new Date(startDate).getTime(), new Date(asset.purchase_date).getTime()));
      const endMonth = new Date(endDate);
      const monthsInPeriod = Math.max(0, Math.floor((endMonth.getTime() - startMonth.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      depreciation += monthlyDepreciation * Math.min(monthsInPeriod, asset.useful_life_months);
    }

    // Get changes in AR (from invoices)
    const beginningInvoices = await sql`
      SELECT total, currency, invoice_date FROM invoices
      WHERE invoice_date < ${startDate} AND status != 'paid'
    `;

    let beginningAR = 0;
    for (const invoice of beginningInvoices) {
      let amountInBase = invoice.total;
      const currency = invoice.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${invoice.total}, ${currency}, ${baseCurrency}, ${invoice.invoice_date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }
      beginningAR += amountInBase;
    }

    const endingInvoices = await sql`
      SELECT total, currency, invoice_date FROM invoices
      WHERE invoice_date <= ${endDate} AND status != 'paid'
    `;

    let endingAR = 0;
    for (const invoice of endingInvoices) {
      let amountInBase = invoice.total;
      const currency = invoice.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${invoice.total}, ${currency}, ${baseCurrency}, ${invoice.invoice_date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }
      endingAR += amountInBase;
    }

    const arChange = endingAR - beginningAR;

    // Get changes in AP (from bills)
    const beginningBills = await sql`
      SELECT total, currency, bill_date FROM bills
      WHERE bill_date < ${startDate} AND status != 'paid'
    `;

    let beginningAP = 0;
    for (const bill of beginningBills) {
      let amountInBase = bill.total;
      const currency = bill.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${bill.total}, ${currency}, ${baseCurrency}, ${bill.bill_date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }
      beginningAP += amountInBase;
    }

    const endingBills = await sql`
      SELECT total, currency, bill_date FROM bills
      WHERE bill_date <= ${endDate} AND status != 'paid'
    `;

    let endingAP = 0;
    for (const bill of endingBills) {
      let amountInBase = bill.total;
      const currency = bill.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${bill.total}, ${currency}, ${baseCurrency}, ${bill.bill_date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }
      endingAP += amountInBase;
    }

    const apChange = endingAP - beginningAP;

    // Get fixed asset purchases (convert to base currency)
    const assetPurchases = await sql`
      SELECT purchase_price, currency, purchase_date FROM fixed_assets
      WHERE purchase_date >= ${startDate} AND purchase_date <= ${endDate}
    `;

    let assetPurchaseTotal = 0;
    for (const asset of assetPurchases) {
      let amountInBase = asset.purchase_price;
      const currency = asset.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const converted = await sql`SELECT convert_currency(${asset.purchase_price}, ${currency}, ${baseCurrency}, ${asset.purchase_date}) AS val`;
        amountInBase = converted[0]?.val ?? 0;
      }
      assetPurchaseTotal += amountInBase;
    }

    const cashFlowStatement = {
      period: {
        startDate,
        endDate,
      },
      currency: baseCurrency,
      operatingActivities: {
        netIncome,
        adjustments: [
          { label: 'Depreciation', amount: depreciation },
        ],
        changesInWorkingCapital: [
          { label: 'Increase in Accounts Receivable', amount: -arChange },
          { label: 'Increase in Accounts Payable', amount: apChange },
        ],
        netCashFromOperating: netIncome + depreciation - arChange + apChange,
      },
      investingActivities: {
        items: [
          { label: 'Purchase of Fixed Assets', amount: -assetPurchaseTotal },
        ],
        netCashFromInvesting: -assetPurchaseTotal,
      },
      financingActivities: {
        items: [
          { label: 'Owner Contributions', amount: 0 },
          { label: 'Owner Distributions', amount: 0 },
        ],
        netCashFromFinancing: 0,
      },
      netChangeInCash,
      beginningCash,
      endingCash: beginningCash + netChangeInCash,
    };

    return NextResponse.json(cashFlowStatement);
  } catch (error) {
    console.error('Error generating cash flow report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
