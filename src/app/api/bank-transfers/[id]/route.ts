import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-transfers/[id] - Get bank transfer details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const rows = await sql`
      SELECT
        bt.*,
        json_build_object('id', fa.id, 'account_name', fa.account_name, 'account_number', fa.account_number) AS from_account,
        json_build_object('id', ta.id, 'account_name', ta.account_name, 'account_number', ta.account_number) AS to_account,
        json_build_object('id', up.id, 'full_name', up.full_name) AS approved_by_user
      FROM bank_transfers bt
      LEFT JOIN bank_accounts fa ON fa.id = bt.from_account_id
      LEFT JOIN bank_accounts ta ON ta.id = bt.to_account_id
      LEFT JOIN users up ON up.id = bt.approved_by
      WHERE bt.id = ${id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Bank transfer not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-transfers/[id] - Cancel bank transfer
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Check current status
    const existing = await sql`SELECT status FROM bank_transfers WHERE id = ${id}`;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Bank transfer not found' }, { status: 404 });
    }

    if (existing[0].status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot cancel completed bank transfer' },
        { status: 400 }
      );
    }

    // Soft delete - change status to cancelled
    await sql`UPDATE bank_transfers SET status = 'cancelled' WHERE id = ${id}`;

    return NextResponse.json({ message: 'Bank transfer cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
