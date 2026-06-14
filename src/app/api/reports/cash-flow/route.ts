import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCompanySettings } from '@/lib/company-settings';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    // Get bank transactions for the period to calculate cash flow
    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('id, name, currency');

    // Get beginning cash balance (transactions before start date)
    let beginningCash = 0;
    for (const account of bankAccounts || []) {
      const { data: beginningTransactions } = await supabase
        .from('bank_transactions')
        .select('amount, transaction_date')
        .eq('bank_account_id', account.id)
        .lt('transaction_date', startDate);

      const accountBeginningBalance = beginningTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

      let balanceInBase = accountBeginningBalance;
      const currency = account.currency || baseCurrency;
      if (currency !== baseCurrency && accountBeginningBalance !== 0) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: Math.abs(accountBeginningBalance),
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: startDate,
        });
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
    for (const account of bankAccounts || []) {
      const { data: periodTransactions } = await supabase
        .from('bank_transactions')
        .select('amount, transaction_date')
        .eq('bank_account_id', account.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      const accountPeriodChange = periodTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

      let changeInBase = accountPeriodChange;
      const currency = account.currency || baseCurrency;
      if (currency !== baseCurrency && accountPeriodChange !== 0) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: Math.abs(accountPeriodChange),
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: endDate,
        });
        if (convertedValue !== null) {
          changeInBase = accountPeriodChange < 0 ? -convertedValue : convertedValue;
        } else {
          changeInBase = 0;
        }
      }
      netChangeInCash += changeInBase;
    }

    // Get revenue for period (from invoices)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total, currency, invoice_date')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate);

    let totalRevenue = 0;
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

    // Get expenses for period (from bills and expenses)
    const { data: bills } = await supabase
      .from('bills')
      .select('total, currency, bill_date')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, currency, date')
      .gte('date', startDate)
      .lte('date', endDate);

    let totalExpenses = 0;
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
      totalExpenses += amountInBase;
    }

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
      totalExpenses += amountInBase;
    }

    const netIncome = totalRevenue - totalExpenses;

    // Get depreciation from fixed assets
    const { data: assets } = await supabase
      .from('fixed_assets')
      .select('accumulated_depreciation, depreciation_start_date, useful_life_months, purchase_price, residual_value')
      .eq('status', 'active')
      .lte('depreciation_start_date', endDate);

    let depreciation = 0;
    for (const asset of assets || []) {
      const monthlyDepreciation = (asset.purchase_price - asset.residual_value) / asset.useful_life_months;
      const startMonth = new Date(Math.max(new Date(startDate).getTime(), new Date(asset.depreciation_start_date).getTime()));
      const endMonth = new Date(endDate);
      const monthsInPeriod = Math.max(0, Math.floor((endMonth.getTime() - startMonth.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      depreciation += monthlyDepreciation * Math.min(monthsInPeriod, asset.useful_life_months);
    }

    // Get changes in AR (from invoices)
    const { data: beginningInvoices } = await supabase
      .from('invoices')
      .select('total, currency, invoice_date')
      .lt('invoice_date', startDate)
      .neq('status', 'paid');

    let beginningAR = 0;
    for (const invoice of beginningInvoices || []) {
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
      beginningAR += amountInBase;
    }

    const { data: endingInvoices } = await supabase
      .from('invoices')
      .select('total, currency, invoice_date')
      .lte('invoice_date', endDate)
      .neq('status', 'paid');

    let endingAR = 0;
    for (const invoice of endingInvoices || []) {
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
      endingAR += amountInBase;
    }

    const arChange = endingAR - beginningAR;

    // Get changes in AP (from bills)
    const { data: beginningBills } = await supabase
      .from('bills')
      .select('total, currency, bill_date')
      .lt('bill_date', startDate)
      .neq('status', 'paid');

    let beginningAP = 0;
    for (const bill of beginningBills || []) {
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
      beginningAP += amountInBase;
    }

    const { data: endingBills } = await supabase
      .from('bills')
      .select('total, currency, bill_date')
      .lte('bill_date', endDate)
      .neq('status', 'paid');

    let endingAP = 0;
    for (const bill of endingBills || []) {
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
      endingAP += amountInBase;
    }

    const apChange = endingAP - beginningAP;

    // Get fixed asset purchases (convert to base currency)
    const { data: assetPurchases } = await supabase
      .from('fixed_assets')
      .select('purchase_price, currency, purchase_date')
      .gte('purchase_date', startDate)
      .lte('purchase_date', endDate);

    let assetPurchaseTotal = 0;
    for (const asset of assetPurchases || []) {
      let amountInBase = asset.purchase_price;
      const currency = asset.currency || baseCurrency;
      if (currency !== baseCurrency) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: asset.purchase_price,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: asset.purchase_date,
        });
        amountInBase = convertedValue ?? 0;
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
