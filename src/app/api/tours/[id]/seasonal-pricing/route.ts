import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/tours/[id]/seasonal-pricing - Get seasonal pricing
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const data = await sql`
      SELECT * FROM tour_seasonal_pricing
      WHERE tour_package_id = ${id}
      ORDER BY start_date
    `;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/tours/[id]/seasonal-pricing - Create seasonal pricing
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await sql`
      INSERT INTO tour_seasonal_pricing (
        tour_package_id, season_name, start_date, end_date, price_per_person, price_modifier
      ) VALUES (
        ${id}, ${body.season_name || null}, ${body.start_date || null}, ${body.end_date || null},
        ${body.price_per_person || null}, ${body.price_modifier || null}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
