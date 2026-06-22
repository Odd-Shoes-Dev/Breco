import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let rows: any[];
    if (type) {
      rows = await sql`SELECT * FROM locations WHERE type = ${type} ORDER BY name`;
    } else {
      rows = await sql`SELECT * FROM locations ORDER BY name`;
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      code,
      type,
      address,
      city,
      state,
      postal_code,
      country,
      phone,
      email,
      manager_name,
      is_active
    } = body;

    if (!name || !code || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const rows = await sql`
      INSERT INTO locations (
        name, code, type, address, city, state, postal_code,
        country, phone, email, manager_name, is_active
      ) VALUES (
        ${name}, ${code}, ${type}, ${address ?? null}, ${city ?? null},
        ${state ?? null}, ${postal_code ?? null}, ${country ?? null},
        ${phone ?? null}, ${email ?? null}, ${manager_name ?? null},
        ${is_active ?? true}
      )
      RETURNING *
    `;

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('Error creating location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
