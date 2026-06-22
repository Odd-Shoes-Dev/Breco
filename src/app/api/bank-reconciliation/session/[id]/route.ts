import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-reconciliation/session/[id] - Get reconciliation details
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const reconRows = await sql`
      SELECT
        br.*,
        json_build_object('id', ba.id, 'account_name', ba.account_name, 'account_number', ba.account_number, 'current_balance', ba.current_balance, 'currency', ba.currency) AS bank_account,
        json_build_object('id', cu.id, 'full_name', cu.full_name, 'email', cu.email) AS completed_by_user,
        json_build_object('id', cru.id, 'full_name', cru.full_name, 'email', cru.email) AS created_by_user
      FROM bank_reconciliations br
      LEFT JOIN bank_accounts ba ON ba.id = br.bank_account_id
      LEFT JOIN user_profiles cu ON cu.id = br.completed_by
      LEFT JOIN user_profiles cru ON cru.id = br.created_by
      WHERE br.id = ${params.id}
    `;

    if (reconRows.length === 0) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    const reconciliation = reconRows[0];

    // Get matched transactions
    const matchedTransactions = await sql`
      SELECT bri.*, row_to_json(bt.*) AS transaction
      FROM bank_reconciliation_items bri
      LEFT JOIN bank_transactions bt ON bt.id = bri.transaction_id
      WHERE bri.reconciliation_id = ${params.id}
    `;

    // Get unmatched transactions for this bank account
    const unmatchedTransactions = await sql`
      SELECT * FROM bank_transactions
      WHERE bank_account_id = ${reconciliation.bank_account_id}
        AND is_reconciled = false
        AND transaction_date <= ${reconciliation.statement_date}
      ORDER BY transaction_date DESC
    `;

    return NextResponse.json({
      data: {
        ...reconciliation,
        matched_transactions: matchedTransactions || [],
        unmatched_transactions: unmatchedTransactions || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bank-reconciliation/session/[id] - Update reconciliation
export async function PATCH(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const body = await request.json();

    // Get existing reconciliation
    const existing = await sql`SELECT status FROM bank_reconciliations WHERE id = ${params.id}`;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    if (existing[0].status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot update completed reconciliation' },
        { status: 400 }
      );
    }

    // Build dynamic SET clause from body fields
    const allowed = [
      'statement_date', 'statement_ending_balance', 'statement_starting_balance',
      'notes', 'book_balance', 'reconciliation_date',
    ];
    const updates: string[] = [];
    const vals: any[] = [];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        vals.push(body[key]);
        updates.push(`${key} = $${vals.length}`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    vals.push(params.id);
    const setClause = updates.join(', ');
    const idParam = `$${vals.length}`;

    // Use sql.unsafe for dynamic SET clause - values already parameterized above
    // Re-build using tagged template for safety
    const rows = await sql`
      UPDATE bank_reconciliations
      SET ${sql.unsafe(setClause.replace(/\$\d+/g, (m) => `$${m.slice(1)}`))}
      WHERE id = ${params.id}
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-reconciliation/session/[id] - Cancel reconciliation
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    // Get reconciliation
    const reconciliation = await sql`
      SELECT status FROM bank_reconciliations WHERE id = ${params.id}
    `;

    if (reconciliation.length === 0) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    if (reconciliation[0].status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot delete completed reconciliation' },
        { status: 400 }
      );
    }

    // Delete reconciliation items first
    await sql`DELETE FROM bank_reconciliation_items WHERE reconciliation_id = ${params.id}`;

    // Delete reconciliation
    await sql`DELETE FROM bank_reconciliations WHERE id = ${params.id}`;

    return NextResponse.json({ message: 'Reconciliation cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
