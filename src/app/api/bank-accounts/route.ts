import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-accounts - List bank accounts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');

    let rows;
    if (active === 'true') {
      rows = await sql`SELECT * FROM bank_accounts WHERE is_active = true ORDER BY name`;
    } else if (active === 'false') {
      rows = await sql`SELECT * FROM bank_accounts WHERE is_active = false ORDER BY name`;
    } else {
      rows = await sql`SELECT * FROM bank_accounts ORDER BY name`;
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
    if (!body.name || !body.bank_name) {
      return NextResponse.json(
        { error: 'Account name and bank name are required' },
        { status: 400 }
      );
    }

    // If this is marked as primary, unset other primary accounts
    if (body.is_primary) {
      await sql`UPDATE bank_accounts SET is_primary = false WHERE is_primary = true`;
    }

    const rows = await sql`
      INSERT INTO bank_accounts (
        name, bank_name, account_number_encrypted, routing_number,
        account_type, currency, is_primary, is_active
      ) VALUES (
        ${body.name},
        ${body.bank_name},
        ${null},
        ${body.routing_number || null},
        ${body.account_type || 'checking'},
        ${body.currency || 'USD'},
        ${body.is_primary || false},
        ${body.is_active !== false}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
