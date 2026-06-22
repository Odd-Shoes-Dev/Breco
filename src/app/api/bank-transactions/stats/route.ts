import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const type = searchParams.get('type');
    const reconciled = searchParams.get('reconciled');

    const conditions: string[] = ['1=1'];
    if (accountId && accountId !== 'all') {
      conditions.push(`bank_account_id = '${accountId.replace(/'/g, "''")}'`);
    }
    if (type && type !== 'all') {
      conditions.push(`transaction_type = '${type.replace(/'/g, "''")}'`);
    }
    if (reconciled && reconciled !== 'all') {
      conditions.push(`is_reconciled = ${reconciled === 'reconciled' ? 'true' : 'false'}`);
    }
    const where = conditions.join(' AND ');

    const transactions = await sql`
      SELECT amount, currency, transaction_date, transaction_type, is_reconciled
      FROM bank_transactions
      WHERE ${sql.unsafe(where)}
    `;

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let unreconciledCount = 0;

    for (const tx of transactions || []) {
      const amount = Math.abs(parseFloat(tx.amount) || 0);
      let amountUSD = amount;

      // Convert to USD if not already
      if (tx.currency && tx.currency !== 'USD') {
        const converted = await sql`
          SELECT convert_currency(${amount}, ${tx.currency}, 'USD', ${tx.transaction_date}) AS result
        `;
        amountUSD = converted[0]?.result || amount;
      }

      if (tx.transaction_type === 'deposit') {
        totalDeposits += amountUSD;
      } else if (tx.transaction_type === 'withdrawal') {
        totalWithdrawals += amountUSD;
      }

      if (!tx.is_reconciled) {
        unreconciledCount++;
      }
    }

    return NextResponse.json({
      totalDeposits,
      totalWithdrawals,
      unreconciledCount,
    });
  } catch (error) {
    console.error('Error calculating bank transactions stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate bank transactions stats' },
      { status: 500 }
    );
  }
}
