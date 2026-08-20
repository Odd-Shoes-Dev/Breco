import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-transfers/[id]/approve - Approve bank transfer
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Check current status
    const existing = await sql`SELECT status FROM bank_transfers WHERE id = ${id}`;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Bank transfer not found' }, { status: 404 });
    }

    if (existing[0].status !== 'pending') {
      return NextResponse.json(
        { error: `Can only approve pending transfers. Current status: ${existing[0].status}` },
        { status: 400 }
      );
    }

    const rows = await sql`
      UPDATE bank_transfers
      SET
        status = 'approved',
        approved_by = ${user.id}
      WHERE id = ${id}
      RETURNING *
    `;

    // Fetch with joins
    const fullRows = await sql`
      SELECT
        bt.*,
        json_build_object('id', fa.id, 'account_name', fa.account_name) AS from_account,
        json_build_object('id', ta.id, 'account_name', ta.account_name) AS to_account
      FROM bank_transfers bt
      LEFT JOIN bank_accounts fa ON fa.id = bt.from_account_id
      LEFT JOIN bank_accounts ta ON ta.id = bt.to_account_id
      WHERE bt.id = ${id}
    `;

    return NextResponse.json(fullRows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
