import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET /api/assets/[id] - Get single asset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql`SELECT * FROM fixed_assets WHERE id = ${id}`;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/assets/[id] - Update asset
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      description,
      asset_number,
      serial_number,
      purchase_date,
      purchase_price,
      residual_value,
      useful_life_months,
      depreciation_method,
      depreciation_start_date,
      location,
      notes,
    } = body;

    const rows = await sql`
      UPDATE fixed_assets
      SET
        name = ${name},
        description = ${description || null},
        asset_number = ${asset_number},
        serial_number = ${serial_number || null},
        purchase_date = ${purchase_date},
        purchase_price = ${Number(purchase_price)},
        residual_value = ${Number(residual_value)},
        useful_life_months = ${Number(useful_life_months)},
        depreciation_method = ${depreciation_method},
        depreciation_start_date = ${depreciation_start_date},
        location = ${location || null},
        notes = ${notes || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('Error in assets PUT:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE /api/assets/[id] - Delete asset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await sql`DELETE FROM fixed_assets WHERE id = ${id}`;

    return NextResponse.json({ message: 'Asset deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
