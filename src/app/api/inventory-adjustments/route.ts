import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/inventory-adjustments - List inventory movements (backed by inventory_movements)
export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const esc = (v: string) => v.replace(/'/g, "''");
    if (productId) conditions.push(`im.product_id = '${esc(productId)}'`);
    if (type && type !== 'all') conditions.push(`im.movement_type = '${esc(type)}'`);
    if (search) conditions.push(`(p.name ILIKE '%${esc(search)}%' OR p.sku ILIKE '%${esc(search)}%')`);
    if (startDate) conditions.push(`im.created_at >= '${esc(startDate)}'`);
    if (endDate) conditions.push(`im.created_at <= '${esc(endDate)}'`);
    const where = conditions.join(' AND ');

    const countRows = await sql`
      SELECT COUNT(*) AS count
      FROM inventory_movements im
      LEFT JOIN products p ON p.id = im.product_id
      WHERE ${sql.unsafe(where)}
    `;
    const total = parseInt((countRows as any[])[0]?.count || '0');

    const rows = await sql`
      SELECT im.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit_of_measure) AS products
      FROM inventory_movements im
      LEFT JOIN products p ON p.id = im.product_id
      WHERE ${sql.unsafe(where)}
      ORDER BY im.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({ data: rows, total });
  } catch (error: any) {
    console.error('Error fetching inventory adjustments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/inventory-adjustments - Record a manual adjustment movement
export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      product_id,
      adjustment_date,
      quantity_change,
      reason,
      reference_type,
      reference_id,
      notes,
    } = body;

    // Validate required fields
    if (!product_id || !adjustment_date || quantity_change === undefined || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Record adjustment as an inventory movement (stock is computed from inventory_movements)
    const rows = await sql`
      INSERT INTO inventory_movements (
        product_id, movement_type, quantity,
        reference_type, reference_id, notes, created_by
      ) VALUES (
        ${product_id}, 'adjustment', ${quantity_change},
        ${reference_type || 'manual_adjustment'}, ${reference_id || null},
        ${notes ? `${reason}: ${notes}` : reason}, ${user.id}
      )
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating inventory adjustment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
