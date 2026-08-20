import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/petty-cash/disbursements/[id]/approve - Approve disbursement
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check current status
    const existingRows = await sql`
      SELECT status, amount, cash_account_id FROM petty_cash_disbursements WHERE id = ${id}
    `;
    const existing = existingRows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Disbursement not found' }, { status: 404 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Can only approve pending disbursements. Current status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Get petty cash expense account
    const expenseRows = await sql`SELECT id FROM accounts WHERE code = '5300' LIMIT 1`;
    const expenseAccount = expenseRows[0];

    if (!expenseAccount) {
      return NextResponse.json(
        { error: 'Petty cash expense account (5300) not found' },
        { status: 400 }
      );
    }

    // Create journal entry: DR Petty Cash Expense, CR Cash Account
    const jeRows = await sql`
      INSERT INTO journal_entries (
        entry_date, description, reference_type, reference_id, created_by
      ) VALUES (
        ${new Date().toISOString().split('T')[0]},
        ${`Petty cash disbursement - ${existing.amount}`},
        'petty_cash_disbursement',
        ${id},
        ${user.id}
      )
      RETURNING *
    `;
    const journalEntry = jeRows[0];

    if (!journalEntry) {
      return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 400 });
    }

    // Create journal lines
    try {
      await sql`
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
        VALUES (${journalEntry.id}, ${expenseAccount.id}, ${existing.amount}, 0)
      `;
      await sql`
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit)
        VALUES (${journalEntry.id}, ${existing.cash_account_id}, 0, ${existing.amount})
      `;
    } catch (linesError: any) {
      // Rollback journal entry
      await sql`DELETE FROM journal_entries WHERE id = ${journalEntry.id}`;
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Update disbursement status
    const rows = await sql`
      UPDATE petty_cash_disbursements
      SET status = 'approved',
          approved_by = ${user.id},
          approved_at = ${new Date().toISOString()},
          journal_entry_id = ${journalEntry.id}
      WHERE id = ${id}
      RETURNING *
    `;

    // Fetch with joined data
    const fullRows = await sql`
      SELECT pcd.*,
        json_build_object('id', ba.id, 'account_name', ba.account_name) AS cash_account
      FROM petty_cash_disbursements pcd
      LEFT JOIN bank_accounts ba ON ba.id = pcd.cash_account_id
      WHERE pcd.id = ${id}
    `;

    return NextResponse.json(fullRows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
