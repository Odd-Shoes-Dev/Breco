import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-accounts/[id] - Get single bank account
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;

    const rows = await sql`SELECT * FROM bank_accounts WHERE id = ${params.id}`;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bank-accounts/[id] - Update bank account
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();

    // Check if bank account exists
    const existing = await sql`SELECT id FROM bank_accounts WHERE id = ${params.id}`;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // If this is being set as primary, unset other primary accounts
    if (body.is_primary) {
      await sql`
        UPDATE bank_accounts SET is_primary = false WHERE is_primary = true AND id != ${params.id}
      `;
    }

    const rows = await sql`
      UPDATE bank_accounts
      SET
        name = ${body.name},
        bank_name = ${body.bank_name},
        account_number_encrypted = ${null},
        routing_number = ${body.routing_number || null},
        account_type = ${body.account_type},
        currency = ${body.currency},
        is_primary = ${body.is_primary},
        is_active = ${body.is_active}
      WHERE id = ${params.id}
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-accounts/[id] - Delete or deactivate bank account
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;

    // Check if account has transactions
    const transactions = await sql`
      SELECT id FROM bank_transactions WHERE bank_account_id = ${params.id} LIMIT 1
    `;

    // If has transactions, soft delete (deactivate)
    if (transactions.length > 0) {
      const rows = await sql`
        UPDATE bank_accounts SET is_active = false WHERE id = ${params.id} RETURNING *
      `;

      return NextResponse.json({
        data: rows[0],
        message: 'Bank account deactivated (has transactions)',
      });
    }

    // Otherwise, hard delete
    await sql`DELETE FROM bank_accounts WHERE id = ${params.id}`;

    return NextResponse.json({
      message: 'Bank account deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
