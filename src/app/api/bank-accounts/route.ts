import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-accounts - List bank accounts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');

    let rows;
    if (active === 'true') {
      rows = await sql`SELECT * FROM bank_accounts WHERE is_active = true ORDER BY account_name`;
    } else if (active === 'false') {
      rows = await sql`SELECT * FROM bank_accounts WHERE is_active = false ORDER BY account_name`;
    } else {
      rows = await sql`SELECT * FROM bank_accounts ORDER BY account_name`;
    }

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bank-accounts - Create bank account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.account_name || !body.bank_name) {
      return NextResponse.json(
        { error: 'Account name and bank name are required' },
        { status: 400 }
      );
    }

    const rows = await sql`
      INSERT INTO bank_accounts (
        account_name, bank_name, account_number, bank_branch,
        swift_code, currency, gl_account_id, is_active
      ) VALUES (
        ${body.account_name},
        ${body.bank_name},
        ${body.account_number || null},
        ${body.bank_branch || null},
        ${body.swift_code || null},
        ${body.currency || 'USD'},
        ${body.gl_account_id || null},
        ${body.is_active !== false}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
