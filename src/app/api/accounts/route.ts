import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/accounts - List accounts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const active = searchParams.get('active');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    let conditions = ['1=1'];
    const params: any[] = [];

    if (type) {
      params.push(type);
      conditions.push(`account_type = $${params.length}`);
    }

    if (active === 'true') {
      conditions.push('is_active = true');
    } else if (active === 'false') {
      conditions.push('is_active = false');
    }

    const where = conditions.join(' AND ');

    // Count total
    const countRows = await sql`
      SELECT COUNT(*) as count FROM accounts WHERE ${sql.unsafe(where)}
    `;
    const count = parseInt(countRows[0].count);

    const rows = await sql`
      SELECT id, code, name, account_type, account_subtype, is_active
      FROM accounts
      WHERE ${sql.unsafe(where)}
      ORDER BY code
      LIMIT ${limit} OFFSET ${offset}
    `;

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

// POST /api/accounts - Create account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.code || !body.name || !body.account_type) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, account_type' },
        { status: 400 }
      );
    }

    // Check if account code already exists
    const existing = await sql`SELECT id FROM accounts WHERE code = ${body.code}`;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An account with this code already exists' },
        { status: 400 }
      );
    }

    const rows = await sql`
      INSERT INTO accounts (
        code, name, description, account_type, account_subtype,
        parent_id, currency, is_active, normal_balance
      ) VALUES (
        ${body.code},
        ${body.name},
        ${body.description || null},
        ${body.account_type},
        ${body.account_subtype || null},
        ${body.parent_id || null},
        ${body.currency || 'USD'},
        ${body.is_active !== false},
        ${body.normal_balance || 'debit'}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
