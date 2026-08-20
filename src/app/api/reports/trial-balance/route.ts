import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/reports/trial-balance
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const asOfDate = searchParams.get('as_of_date') || new Date().toISOString().split('T')[0];

    // Get all active accounts
    const accounts = await sql`
      SELECT id, code, name, account_type, normal_balance FROM accounts
      WHERE is_active = true
      ORDER BY code
    `;

    // Get all posted journal entry lines up to the date
    const entries = await sql`
      SELECT jl.account_id, jl.debit, jl.credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE je.status = 'posted'
        AND je.entry_date <= ${asOfDate}
    `;

    // Calculate balances by account
    const accountTotals: Record<string, { debit: number; credit: number }> = {};

    entries.forEach((entry: any) => {
      if (!accountTotals[entry.account_id]) {
        accountTotals[entry.account_id] = { debit: 0, credit: 0 };
      }
      accountTotals[entry.account_id].debit += entry.debit || 0;
      accountTotals[entry.account_id].credit += entry.credit || 0;
    });

    // Build trial balance
    const trialBalance: any[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    accounts.forEach((account: any) => {
      const totals = accountTotals[account.id] || { debit: 0, credit: 0 };
      const netDebit = totals.debit - totals.credit;

      if (totals.debit === 0 && totals.credit === 0) return;

      let debitBalance = 0;
      let creditBalance = 0;

      if (netDebit > 0) {
        debitBalance = netDebit;
        totalDebits += netDebit;
      } else if (netDebit < 0) {
        creditBalance = -netDebit;
        totalCredits += -netDebit;
      }

      trialBalance.push({
        code: account.code,
        name: account.name,
        type: account.account_type,
        debit: debitBalance,
        credit: creditBalance,
      });
    });

    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return NextResponse.json({
      data: {
        asOfDate,
        accounts: trialBalance,
        totals: {
          debit: totalDebits,
          credit: totalCredits,
        },
        isBalanced,
        difference: totalDebits - totalCredits,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
