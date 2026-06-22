import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/vendors - List vendors
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const active = searchParams.get('active');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let data;
    let countRows;

    if (search && active === 'true') {
      const s = `%${search}%`;
      data = await sql`
        SELECT * FROM vendors
        WHERE (name ILIKE ${s} OR email ILIKE ${s} OR company_name ILIKE ${s})
          AND is_active = true
        ORDER BY name
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) AS count FROM vendors WHERE (name ILIKE ${s} OR email ILIKE ${s} OR company_name ILIKE ${s}) AND is_active = true`;
    } else if (search && active === 'false') {
      const s = `%${search}%`;
      data = await sql`
        SELECT * FROM vendors
        WHERE (name ILIKE ${s} OR email ILIKE ${s} OR company_name ILIKE ${s})
          AND is_active = false
        ORDER BY name
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) AS count FROM vendors WHERE (name ILIKE ${s} OR email ILIKE ${s} OR company_name ILIKE ${s}) AND is_active = false`;
    } else if (search) {
      const s = `%${search}%`;
      data = await sql`
        SELECT * FROM vendors
        WHERE name ILIKE ${s} OR email ILIKE ${s} OR company_name ILIKE ${s}
        ORDER BY name
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) AS count FROM vendors WHERE name ILIKE ${s} OR email ILIKE ${s} OR company_name ILIKE ${s}`;
    } else if (active === 'true') {
      data = await sql`SELECT * FROM vendors WHERE is_active = true ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*) AS count FROM vendors WHERE is_active = true`;
    } else if (active === 'false') {
      data = await sql`SELECT * FROM vendors WHERE is_active = false ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*) AS count FROM vendors WHERE is_active = false`;
    } else {
      data = await sql`SELECT * FROM vendors ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*) AS count FROM vendors`;
    }

    const count = parseInt(countRows[0]?.count || '0');

    return NextResponse.json({
      data,
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

// POST /api/vendors - Create vendor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Vendor name is required' },
        { status: 400 }
      );
    }

    // Generate vendor number using database function
    const numberRows = await sql`SELECT generate_vendor_number() AS vendor_number`;

    if (!numberRows[0]) {
      return NextResponse.json(
        { error: 'Failed to generate vendor number' },
        { status: 500 }
      );
    }

    const vendorNumber = numberRows[0].vendor_number;

    const rows = await sql`
      INSERT INTO vendors (
        vendor_number, name, company_name, email, phone, tax_id,
        address_line1, address_line2, city, state, zip_code, country,
        payment_terms, default_expense_account_id, notes, is_active
      ) VALUES (
        ${vendorNumber}, ${body.name}, ${body.company_name || null},
        ${body.email || null}, ${body.phone || null}, ${body.tax_id || null},
        ${body.address_line1 || null}, ${body.address_line2 || null},
        ${body.city || null}, ${body.state || null}, ${body.postal_code || null},
        ${body.country || 'USA'}, ${body.payment_terms || 30},
        ${body.default_expense_account_id || null}, ${body.notes || null},
        ${body.is_active !== false}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
