import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/customers - List customers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const active = searchParams.get('active');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const rows = await sql`SELECT * FROM customers ORDER BY name`;
    let data = rows as any[];

    if (search) {
      const s = search.toLowerCase();
      data = data.filter((c: any) =>
        c.name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.company?.toLowerCase().includes(s)
      );
    }

    if (active === 'true') {
      data = data.filter((c: any) => c.is_active === true);
    } else if (active === 'false') {
      data = data.filter((c: any) => c.is_active === false);
    }

    const total = data.length;
    const paged = data.slice(offset, offset + limit);

    return NextResponse.json({
      data: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/customers - Create customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    // Check for duplicate email
    if (body.email) {
      const existingRows = await sql`SELECT id FROM customers WHERE email = ${body.email} LIMIT 1`;
      if ((existingRows as any[]).length > 0) {
        return NextResponse.json(
          { error: 'A customer with this email already exists' },
          { status: 400 }
        );
      }
    }

    // Generate customer number using database function
    const numberRows = await sql`SELECT generate_customer_number() AS customer_number`;
    const numberData = (numberRows as any[])[0]?.customer_number;

    if (!numberData) {
      return NextResponse.json({ error: 'Failed to generate customer number' }, { status: 500 });
    }

    const insertedRows = await sql`
      INSERT INTO customers (
        customer_number, name, email, phone,
        address, city, state, zip_code, country,
        payment_terms, credit_limit, notes, is_active
      ) VALUES (
        ${numberData}, ${body.name}, ${body.email ?? null},
        ${body.phone ?? null},
        ${body.address ?? null},
        ${body.city ?? null}, ${body.state ?? null}, ${body.postal_code ?? null},
        ${body.country || 'USA'},
        ${body.payment_terms || 30}, ${body.credit_limit || 0},
        ${body.notes ?? null}, ${body.is_active !== false}
      )
      RETURNING *
    `;
    const data = (insertedRows as any[])[0];

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
