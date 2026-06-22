import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-reconciliation/session/[id]/complete - Complete reconciliation
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get reconciliation with current totals
    const reconRows = await sql`
      SELECT br.*, json_build_object('account_name', ba.account_name) AS bank_account
      FROM bank_reconciliations br
      LEFT JOIN bank_accounts ba ON ba.id = br.bank_account_id
      WHERE br.id = ${params.id}
    `;

    if (reconRows.length === 0) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    const reconciliation = reconRows[0];

    if (reconciliation.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Reconciliation is not in progress' },
        { status: 400 }
      );
    }

    // Check if reconciliation balances
    const tolerance = body.tolerance || 0.01;
    if (Math.abs(reconciliation.difference) > tolerance) {
      return NextResponse.json(
        {
          error: 'Reconciliation does not balance',
          difference: reconciliation.difference,
          book_balance: reconciliation.book_balance,
          adjusted_bank_balance: reconciliation.adjusted_bank_balance,
        },
        { status: 400 }
      );
    }

    // Complete the reconciliation
    const updatedRows = await sql`
      UPDATE bank_reconciliations
      SET
        status = 'completed',
        completed_by = ${user.id},
        completed_at = NOW()
      WHERE id = ${params.id}
      RETURNING *
    `;

    // Fetch with joins
    const fullRows = await sql`
      SELECT
        br.*,
        json_build_object('id', ba.id, 'account_name', ba.account_name, 'account_number', ba.account_number) AS bank_account,
        json_build_object('id', cu.id, 'full_name', cu.full_name, 'email', cu.email) AS completed_by_user
      FROM bank_reconciliations br
      LEFT JOIN bank_accounts ba ON ba.id = br.bank_account_id
      LEFT JOIN users cu ON cu.id = br.completed_by
      WHERE br.id = ${params.id}
    `;

    // Get count of reconciled transactions
    const countRows = await sql`
      SELECT COUNT(*) as count FROM bank_reconciliation_items WHERE reconciliation_id = ${params.id}
    `;
    const count = parseInt(countRows[0].count);

    return NextResponse.json({
      data: fullRows[0],
      message: `Reconciliation completed successfully. ${count} transactions reconciled.`,
      reconciled_count: count,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
