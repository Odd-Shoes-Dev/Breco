import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

// GET /api/reports/balance-sheet
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const { searchParams } = new URL(request.url);

    const asOfDate = searchParams.get('asOfDate') || searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];

    // Get all accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name, account_type, normal_balance')
      .order('code');

    // Get all posted journal entry lines up to the date
    const { data: entries, error: entriesError } = await supabase
      .from('journal_lines')
      .select(`
        account_id,
        debit,
        credit,
        journal_entries!inner (entry_date, status)
      `)
      .eq('journal_entries.status', 'posted')
      .lte('journal_entries.entry_date', asOfDate);

    if (entriesError) {
      console.error('Error fetching journal entries:', entriesError);
    }

    // Calculate balances by account
    const accountBalances: Record<string, number> = {};

    entries?.forEach((entry: any) => {
      if (!accountBalances[entry.account_id]) {
        accountBalances[entry.account_id] = 0;
      }
      accountBalances[entry.account_id] += (entry.debit || 0) - (entry.credit || 0);
    });

    // Get fixed assets purchased on or before asOfDate
    const { data: assets } = await supabase
      .from('fixed_assets')
      .select('id, name, purchase_price, accumulated_depreciation, status, purchase_date, currency')
      .lte('purchase_date', asOfDate)
      .in('status', ['active', 'fully_depreciated']);

    // Get inventory as of date
    const { data: inventory } = await supabase
      .from('products')
      .select('id, name, quantity_on_hand, cost, currency')
      .gt('quantity_on_hand', 0);

    // Get bank accounts and their transactions
    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('id, name, currency, created_at');

    // Get accounts receivable (unpaid invoices)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, total, currency, invoice_date')
      .lte('invoice_date', asOfDate)
      .neq('status', 'paid');

    // Get accounts payable (unpaid bills)
    const { data: bills } = await supabase
      .from('bills')
      .select('id, total, currency, bill_date')
      .lte('bill_date', asOfDate)
      .neq('status', 'paid');

    // Build sections
    const currentAssets: any[] = [];
    const fixedAssets: any[] = [];
    const otherAssets: any[] = [];
    const currentLiabilities: any[] = [];
    const longTermLiabilities: any[] = [];
    const equity: any[] = [];

    let totalCurrentAssets = 0;
    let totalFixedAssets = 0;
    let totalOtherAssets = 0;
    let totalCurrentLiabilities = 0;
    let totalLongTermLiabilities = 0;
    let totalEquity = 0;

    accounts?.forEach((account) => {
      let balance = accountBalances[account.id] || 0;

      if (account.normal_balance === 'credit') {
        balance = -balance;
      }

      if (balance === 0) return;

      const item = {
        code: account.code,
        name: account.name,
        amount: Math.abs(balance),
      };

      const code = account.code;

      if (code.startsWith('1')) {
        if (code < '1500') {
          currentAssets.push(item);
          totalCurrentAssets += balance;
        } else if (code < '1800') {
          fixedAssets.push(item);
          totalFixedAssets += balance;
        } else {
          otherAssets.push(item);
          totalOtherAssets += balance;
        }
      } else if (code.startsWith('2')) {
        if (code < '2500') {
          currentLiabilities.push(item);
          totalCurrentLiabilities += balance;
        } else {
          longTermLiabilities.push(item);
          totalLongTermLiabilities += balance;
        }
      } else if (code.startsWith('3')) {
        equity.push(item);
        totalEquity += balance;
      }
    });

    // Add fixed assets from fixed_assets table (convert to base currency)
    for (const asset of assets || []) {
      const bookValue = asset.purchase_price - (asset.accumulated_depreciation || 0);
      if (bookValue <= 0) continue;

      let bookValueInBase = bookValue;
      const currency = asset.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: bookValue,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: asOfDate,
        });
        bookValueInBase = convertedValue ?? 0;
      }

      fixedAssets.push({
        code: '',
        name: asset.name,
        amount: bookValueInBase,
      });
      totalFixedAssets += bookValueInBase;
    }

    // Add inventory (convert to base currency)
    let inventoryTotal = 0;
    for (const item of inventory || []) {
      const inventoryValue = item.quantity_on_hand * item.cost;
      let valueInBase = inventoryValue;
      const currency = item.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const { data: convertedValue } = await supabase.rpc('convert_currency', {
          p_amount: inventoryValue,
          p_from_currency: currency,
          p_to_currency: baseCurrency,
          p_date: asOfDate,
        });
        valueInBase = convertedValue ?? 0;
      }

      inventoryTotal += valueInBase;
    }

    if (inventoryTotal > 0) {
      currentAssets.push({
        code: '1300',
        name: 'Inventory',
        amount: inventoryTotal,
      });
      totalCurrentAssets += inventoryTotal;
    }

    // Add bank account balances from transactions (convert to base currency)
    for (const account of bankAccounts || []) {
      const { data: transactions } = await supabase
        .from('bank_transactions')
        .select('amount, transaction_date')
        .eq('bank_account_id', account.id)
        .lte('transaction_date', asOfDate);

      if (!transactions || transactions.length === 0) continue;

      let balance = 0;
      for (const txn of transactions) {
        let amountInBase = txn.amount;
        const currency = account.currency || baseCurrency;

        if (currency !== baseCurrency) {
          const { data: convertedValue } = await supabase.rpc('convert_currency', {
            p_amount: Math.abs(txn.amount),
            p_from_currency: currency,
            p_to_currency: baseCurrency,
            p_date: txn.transaction_date,
          });
          if (convertedValue !== null) {
            amountInBase = txn.amount < 0 ? -convertedValue : convertedValue;
          } else {
            amountInBase = 0;
          }
        }
        balance += amountInBase;
      }

      if (balance === 0) continue;

      currentAssets.push({
        code: '1100',
        name: account.name,
        amount: Math.abs(balance),
      });
      totalCurrentAssets += balance;
    }

    // Add accounts receivable (convert to base currency)
    let totalAR = 0;
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

      totalAR += amountInBase;
    }

    if (totalAR > 0) {
      currentAssets.push({
        code: '1200',
        name: 'Accounts Receivable',
        amount: totalAR,
      });
      totalCurrentAssets += totalAR;
    }

    // Add accounts payable (convert to base currency)
    let totalAP = 0;
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

      totalAP += amountInBase;
    }

    if (totalAP > 0) {
      currentLiabilities.push({
        code: '2100',
        name: 'Accounts Payable',
        amount: totalAP,
      });
      totalCurrentLiabilities += totalAP;
    }

    // Calculate retained earnings (net income for all time)
    const { data: incomeEntries } = await supabase
      .from('journal_lines')
      .select(`
        account_id,
        debit,
        credit,
        accounts!inner (code),
        journal_entries!inner (entry_date, status)
      `)
      .eq('journal_entries.status', 'posted')
      .lte('journal_entries.entry_date', asOfDate)
      .gte('accounts.code', '4000');

    let retainedEarnings = 0;
    incomeEntries?.forEach((entry: any) => {
      const code = entry.accounts.code;
      if (code >= '4000' && code < '5000') {
        retainedEarnings += (entry.credit || 0) - (entry.debit || 0);
      } else {
        retainedEarnings -= (entry.debit || 0) - (entry.credit || 0);
      }
    });

    if (retainedEarnings !== 0) {
      equity.push({
        code: '3900',
        name: 'Retained Earnings',
        amount: Math.abs(retainedEarnings),
      });
      totalEquity += retainedEarnings;
    }

    const totalAssets = totalCurrentAssets + totalFixedAssets + totalOtherAssets;
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return NextResponse.json({
      data: {
        asOfDate,
        currency: baseCurrency,
        assets: {
          current: currentAssets.map(item => ({ account: item.name, balance: item.amount })),
          fixed: fixedAssets.map(item => ({ account: item.name, balance: item.amount })),
          totalCurrent: totalCurrentAssets,
          totalFixed: totalFixedAssets,
          totalAssets: totalAssets,
        },
        liabilities: {
          current: currentLiabilities.map(item => ({ account: item.name, balance: item.amount })),
          longTerm: longTermLiabilities.map(item => ({ account: item.name, balance: item.amount })),
          totalCurrent: totalCurrentLiabilities,
          totalLongTerm: totalLongTermLiabilities,
          totalLiabilities: totalLiabilities,
        },
        equity: {
          items: equity.map(item => ({ account: item.name, balance: item.amount })),
          totalEquity: totalEquity,
        },
        totalLiabilitiesAndEquity,
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
