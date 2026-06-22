import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-reconciliation/session/[id]/match - Match/unmatch transaction
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate transaction_id
    if (!body.transaction_id) {
      return NextResponse.json(
        { error: 'Missing required field: transaction_id' },
        { status: 400 }
      );
    }

    // Get reconciliation
    const reconRows = await sql`
      SELECT status, bank_account_id FROM bank_reconciliations WHERE id = ${params.id}
    `;

    if (reconRows.length === 0) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    const reconciliation = reconRows[0];

    if (reconciliation.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Can only match transactions in in_progress reconciliations' },
        { status: 400 }
      );
    }

    // Verify transaction belongs to the bank account
    const txRows = await sql`
      SELECT bank_account_id, is_reconciled FROM bank_transactions WHERE id = ${body.transaction_id}
    `;

    if (txRows.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const transaction = txRows[0];

    if (transaction.bank_account_id !== reconciliation.bank_account_id) {
      return NextResponse.json(
        { error: 'Transaction does not belong to this bank account' },
        { status: 400 }
      );
    }

    if (transaction.is_reconciled) {
      return NextResponse.json(
        { error: 'Transaction is already reconciled in a completed reconciliation' },
        { status: 400 }
      );
    }

    const action = body.action || 'match';

    if (action === 'match') {
      try {
        const rows = await sql`
          INSERT INTO bank_reconciliation_items (reconciliation_id, transaction_id, cleared_date, matched_by)
          VALUES (
            ${params.id},
            ${body.transaction_id},
            ${body.cleared_date || new Date().toISOString().split('T')[0]},
            ${user.id}
          )
          RETURNING *
        `;
        return NextResponse.json({ data: rows[0], message: 'Transaction matched successfully' });
      } catch (error: any) {
        if (error.message && error.message.includes('unique') || error.code === '23505') {
          return NextResponse.json(
            { error: 'Transaction is already matched in this reconciliation' },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else if (action === 'unmatch') {
      await sql`
        DELETE FROM bank_reconciliation_items
        WHERE reconciliation_id = ${params.id} AND transaction_id = ${body.transaction_id}
      `;
      return NextResponse.json({ message: 'Transaction unmatched successfully' });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "match" or "unmatch"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
