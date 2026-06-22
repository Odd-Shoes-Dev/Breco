import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings } from '@/lib/company-settings';

// GET /api/reports/balance-sheet
export async function GET(request: NextRequest) {
  try {
    const settings = await getCompanySettings();
    const baseCurrency = settings.base_currency;

    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get('asOfDate') || searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];

    // Get all accounts
    const accounts = await sql`
      SELECT id, code, name, account_type, normal_balance
      FROM accounts
      ORDER BY code
    `;

    // Get all posted journal entry lines up to the date
    const entries = await sql`
      SELECT jl.account_id, jl.debit, jl.credit
      FROM journal_lines jl
      INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE je.status = 'posted'
        AND je.entry_date <= ${asOfDate}
    `;

    // Calculate balances by account
    const accountBalances: Record<string, number> = {};
    for (const entry of entries) {
      if (!accountBalances[entry.account_id]) {
        accountBalances[entry.account_id] = 0;
      }
      accountBalances[entry.account_id] += (entry.debit || 0) - (entry.credit || 0);
    }

    // Get fixed assets purchased on or before asOfDate
    const assets = await sql`
      SELECT id, name, purchase_price, accumulated_depreciation, status, purchase_date, currency
      FROM fixed_assets
      WHERE purchase_date <= ${asOfDate}
        AND status IN ('active', 'fully_depreciated')
    `;

    // Get inventory as of date
    const inventory = await sql`
      SELECT p.id, p.name, p.purchase_price,
             COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand
      FROM products p
      WHERE p.track_inventory = true
    `;

    // Get bank accounts and their transactions
    const bankAccounts = await sql`
      SELECT id, name, currency, created_at FROM bank_accounts
    `;

    // Get accounts receivable (unpaid invoices)
    const invoices = await sql`
      SELECT id, total, currency, invoice_date
      FROM invoices
      WHERE invoice_date <= ${asOfDate} AND status != 'paid'
    `;

    // Get accounts payable (unpaid bills)
    const bills = await sql`
      SELECT id, total, currency, bill_date
      FROM bills
      WHERE bill_date <= ${asOfDate} AND status != 'paid'
    `;

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

    for (const account of accounts) {
      let balance = accountBalances[account.id] || 0;

      if (account.normal_balance === 'credit') {
        balance = -balance;
      }

      if (balance === 0) continue;

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
    }

    // Add fixed assets from fixed_assets table (convert to base currency)
    for (const asset of assets) {
      const bookValue = asset.purchase_price - (asset.accumulated_depreciation || 0);
      if (bookValue <= 0) continue;

      let bookValueInBase = bookValue;
      const currency = asset.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const convertRows = await sql`
          SELECT convert_currency(${bookValue}, ${currency}, ${baseCurrency}, ${asOfDate}) AS result
        `;
        bookValueInBase = convertRows[0]?.result ?? 0;
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
    for (const item of inventory) {
      if ((item.quantity_on_hand || 0) <= 0) continue;
      const inventoryValue = item.quantity_on_hand * (item.purchase_price || 0);
      inventoryTotal += inventoryValue;
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
    for (const account of bankAccounts) {
      const transactions = await sql`
        SELECT amount, transaction_date
        FROM bank_transactions
        WHERE bank_account_id = ${account.id}
          AND transaction_date <= ${asOfDate}
      `;

      if (!transactions || transactions.length === 0) continue;

      let balance = 0;
      for (const txn of transactions) {
        let amountInBase = txn.amount;
        const currency = account.currency || baseCurrency;

        if (currency !== baseCurrency) {
          const convertRows = await sql`
            SELECT convert_currency(${Math.abs(txn.amount)}, ${currency}, ${baseCurrency}, ${txn.transaction_date}) AS result
          `;
          const convertedValue = convertRows[0]?.result;
          if (convertedValue !== null && convertedValue !== undefined) {
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
    for (const invoice of invoices) {
      let amountInBase = invoice.total;
      const currency = invoice.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const convertRows = await sql`
          SELECT convert_currency(${invoice.total}, ${currency}, ${baseCurrency}, ${invoice.invoice_date}) AS result
        `;
        amountInBase = convertRows[0]?.result ?? 0;
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
    for (const bill of bills) {
      let amountInBase = bill.total;
      const currency = bill.currency || baseCurrency;

      if (currency !== baseCurrency) {
        const convertRows = await sql`
          SELECT convert_currency(${bill.total}, ${currency}, ${baseCurrency}, ${bill.bill_date}) AS result
        `;
        amountInBase = convertRows[0]?.result ?? 0;
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
    const incomeEntries = await sql`
      SELECT jl.account_id, jl.debit, jl.credit, a.code
      FROM journal_lines jl
      INNER JOIN journal_entries je ON je.id = jl.journal_entry_id
      INNER JOIN accounts a ON a.id = jl.account_id
      WHERE je.status = 'posted'
        AND je.entry_date <= ${asOfDate}
        AND a.code >= '4000'
    `;

    let retainedEarnings = 0;
    for (const entry of incomeEntries) {
      const code = entry.code;
      if (code >= '4000' && code < '5000') {
        retainedEarnings += (entry.credit || 0) - (entry.debit || 0);
      } else {
        retainedEarnings -= (entry.debit || 0) - (entry.credit || 0);
      }
    }

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
