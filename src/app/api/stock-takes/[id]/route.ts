import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/stock-takes/[id] - Get stock take with lines
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const stockTakeRows = await sql`
      SELECT st.*,
        row_to_json(il.*) AS inventory_locations,
        json_build_object('full_name', up.full_name) AS users
      FROM stock_takes st
      LEFT JOIN inventory_locations il ON il.id = st.location_id
      LEFT JOIN users up ON up.id = st.created_by
      WHERE st.id = ${id}
    `;
    const stockTake = (stockTakeRows as any[])[0];

    if (!stockTake) {
      return NextResponse.json({ error: 'Stock take not found' }, { status: 404 });
    }

    const lines = await sql`
      SELECT sti.*,
        json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit_of_measure) AS products
      FROM stock_take_items sti
      LEFT JOIN products p ON p.id = sti.product_id
      WHERE sti.stock_take_id = ${id}
      ORDER BY p.name
    `;

    return NextResponse.json({ stockTake, lines });
  } catch (error: any) {
    console.error('Error fetching stock take:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/stock-takes/[id] - Update stock take (status/notes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await sql`SELECT id, status FROM stock_takes WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Stock take not found' }, { status: 404 });
    }

    const rows = await sql`
      UPDATE stock_takes SET
        status = COALESCE(${body.status ?? null}, status),
        notes = CASE WHEN ${body.notes !== undefined} THEN ${body.notes ?? null} ELSE notes END,
        completed_at = CASE WHEN ${body.status === 'completed'} THEN NOW() ELSE completed_at END,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('Error updating stock take:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
