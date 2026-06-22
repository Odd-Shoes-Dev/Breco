import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-reconciliation/[bank_account_id] - Get reconciliations for bank account
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let rows;
    if (status) {
      rows = await sql`
        SELECT
          br.*,
          json_build_object('id', ba.id, 'account_name', ba.account_name, 'account_number', ba.account_number, 'current_balance', ba.current_balance) AS bank_account,
          json_build_object('id', cu.id, 'full_name', cu.full_name, 'email', cu.email) AS completed_by_user,
          json_build_object('id', cru.id, 'full_name', cru.full_name, 'email', cru.email) AS created_by_user
        FROM bank_reconciliations br
        LEFT JOIN bank_accounts ba ON ba.id = br.bank_account_id
        LEFT JOIN user_profiles cu ON cu.id = br.completed_by
        LEFT JOIN user_profiles cru ON cru.id = br.created_by
        WHERE br.bank_account_id = ${params.bank_account_id} AND br.status = ${status}
        ORDER BY br.reconciliation_date DESC
      `;
    } else {
      rows = await sql`
        SELECT
          br.*,
          json_build_object('id', ba.id, 'account_name', ba.account_name, 'account_number', ba.account_number, 'current_balance', ba.current_balance) AS bank_account,
          json_build_object('id', cu.id, 'full_name', cu.full_name, 'email', cu.email) AS completed_by_user,
          json_build_object('id', cru.id, 'full_name', cru.full_name, 'email', cru.email) AS created_by_user
        FROM bank_reconciliations br
        LEFT JOIN bank_accounts ba ON ba.id = br.bank_account_id
        LEFT JOIN user_profiles cu ON cu.id = br.completed_by
        LEFT JOIN user_profiles cru ON cru.id = br.created_by
        WHERE br.bank_account_id = ${params.bank_account_id}
        ORDER BY br.reconciliation_date DESC
      `;
    }

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bank-reconciliation/[bank_account_id] - Start new reconciliation
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.statement_date || !body.statement_ending_balance) {
      return NextResponse.json(
        { error: 'Missing required fields: statement_date, statement_ending_balance' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if bank account exists
    const bankAccounts = await sql`
      SELECT id, current_balance, account_name FROM bank_accounts WHERE id = ${params.bank_account_id}
    `;

    if (bankAccounts.length === 0) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const bankAccount = bankAccounts[0];

    // Check for existing in_progress reconciliation
    const existing = await sql`
      SELECT id FROM bank_reconciliations
      WHERE bank_account_id = ${params.bank_account_id} AND status = 'in_progress'
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'There is already an in-progress reconciliation for this account' },
        { status: 400 }
      );
    }

    // Get last reconciliation to get starting balance
    const lastRecon = await sql`
      SELECT statement_ending_balance FROM bank_reconciliations
      WHERE bank_account_id = ${params.bank_account_id} AND status = 'completed'
      ORDER BY reconciliation_date DESC
      LIMIT 1
    `;

    const startingBalance = lastRecon.length > 0 ? lastRecon[0].statement_ending_balance : 0;

    // Create reconciliation
    const reconRows = await sql`
      INSERT INTO bank_reconciliations (
        bank_account_id, reconciliation_date, statement_starting_balance,
        statement_ending_balance, statement_date, book_balance, notes, created_by
      ) VALUES (
        ${params.bank_account_id},
        ${body.reconciliation_date || new Date().toISOString().split('T')[0]},
        ${startingBalance},
        ${body.statement_ending_balance},
        ${body.statement_date},
        ${bankAccount.current_balance},
        ${body.notes || null},
        ${user.id}
      )
      RETURNING *
    `;

    const reconciliation = reconRows[0];

    // Fetch with bank account join
    const fullRows = await sql`
      SELECT
        br.*,
        json_build_object('id', ba.id, 'account_name', ba.account_name, 'account_number', ba.account_number, 'current_balance', ba.current_balance) AS bank_account
      FROM bank_reconciliations br
      LEFT JOIN bank_accounts ba ON ba.id = br.bank_account_id
      WHERE br.id = ${reconciliation.id}
    `;

    return NextResponse.json({ data: fullRows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
