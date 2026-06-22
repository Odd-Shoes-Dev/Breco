import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/petty-cash/disbursements - List petty cash disbursements
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const cash_account_id = searchParams.get('cash_account_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let rows: any[];
    let countRows: any[];

    if (cash_account_id && status) {
      rows = await sql`
        SELECT pcd.*,
          json_build_object('id', ba.id, 'account_name', ba.account_name) AS cash_account,
          json_build_object('id', u.id, 'full_name', u.full_name) AS approved_by_user
        FROM petty_cash_disbursements pcd
        LEFT JOIN bank_accounts ba ON ba.id = pcd.cash_account_id
        LEFT JOIN user_profiles u ON u.id = pcd.approved_by
        WHERE pcd.cash_account_id = ${cash_account_id} AND pcd.status = ${status}
        ORDER BY pcd.disbursement_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) FROM petty_cash_disbursements
        WHERE cash_account_id = ${cash_account_id} AND status = ${status}
      `;
    } else if (cash_account_id) {
      rows = await sql`
        SELECT pcd.*,
          json_build_object('id', ba.id, 'account_name', ba.account_name) AS cash_account,
          json_build_object('id', u.id, 'full_name', u.full_name) AS approved_by_user
        FROM petty_cash_disbursements pcd
        LEFT JOIN bank_accounts ba ON ba.id = pcd.cash_account_id
        LEFT JOIN user_profiles u ON u.id = pcd.approved_by
        WHERE pcd.cash_account_id = ${cash_account_id}
        ORDER BY pcd.disbursement_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM petty_cash_disbursements WHERE cash_account_id = ${cash_account_id}`;
    } else if (status) {
      rows = await sql`
        SELECT pcd.*,
          json_build_object('id', ba.id, 'account_name', ba.account_name) AS cash_account,
          json_build_object('id', u.id, 'full_name', u.full_name) AS approved_by_user
        FROM petty_cash_disbursements pcd
        LEFT JOIN bank_accounts ba ON ba.id = pcd.cash_account_id
        LEFT JOIN user_profiles u ON u.id = pcd.approved_by
        WHERE pcd.status = ${status}
        ORDER BY pcd.disbursement_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM petty_cash_disbursements WHERE status = ${status}`;
    } else {
      rows = await sql`
        SELECT pcd.*,
          json_build_object('id', ba.id, 'account_name', ba.account_name) AS cash_account,
          json_build_object('id', u.id, 'full_name', u.full_name) AS approved_by_user
        FROM petty_cash_disbursements pcd
        LEFT JOIN bank_accounts ba ON ba.id = pcd.cash_account_id
        LEFT JOIN user_profiles u ON u.id = pcd.approved_by
        ORDER BY pcd.disbursement_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM petty_cash_disbursements`;
    }

    const count = parseInt(countRows[0]?.count || '0');

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/petty-cash/disbursements - Create petty cash disbursement
export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.cash_account_id || !body.amount || !body.category || !body.recipient || !body.disbursement_date) {
      return NextResponse.json(
        { error: 'Missing required fields: cash_account_id, amount, category, recipient, disbursement_date' },
        { status: 400 }
      );
    }

    // Generate disbursement number
    const lastRows = await sql`
      SELECT disbursement_number FROM petty_cash_disbursements
      ORDER BY created_at DESC LIMIT 1
    `;
    const lastDisbursement = lastRows[0];

    let nextNumber = 1;
    if (lastDisbursement?.disbursement_number) {
      const match = lastDisbursement.disbursement_number.match(/PC-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const disbursement_number = `PC-${String(nextNumber).padStart(6, '0')}`;

    const rows = await sql`
      INSERT INTO petty_cash_disbursements (
        disbursement_number, cash_account_id, disbursement_date, amount,
        category, description, recipient, receipt_number, status, notes, created_by
      ) VALUES (
        ${disbursement_number}, ${body.cash_account_id}, ${body.disbursement_date},
        ${body.amount}, ${body.category}, ${body.description ?? null},
        ${body.recipient}, ${body.receipt_number ?? null},
        ${body.status || 'pending'}, ${body.notes ?? null}, ${user.id}
      )
      RETURNING *
    `;

    const inserted = rows[0];

    // Fetch with joined data
    const fullRows = await sql`
      SELECT pcd.*,
        json_build_object('id', ba.id, 'account_name', ba.account_name) AS cash_account
      FROM petty_cash_disbursements pcd
      LEFT JOIN bank_accounts ba ON ba.id = pcd.cash_account_id
      WHERE pcd.id = ${inserted.id}
    `;

    return NextResponse.json(fullRows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
