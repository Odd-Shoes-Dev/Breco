import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let rows;
    if (status) {
      rows = await sql`SELECT * FROM fixed_assets WHERE status = ${status} ORDER BY created_at DESC`;
    } else {
      rows = await sql`SELECT * FROM fixed_assets ORDER BY created_at DESC`;
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error in assets GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      description,
      category_id,
      asset_number,
      serial_number,
      purchase_date,
      purchase_price,
      residual_value,
      useful_life_months,
      depreciation_start_date,
      depreciation_method,
      location,
      notes,
      vendor_id,
    } = body;

    const generatedNumber = asset_number || `ASSET-${Date.now().toString().slice(-6)}`;
    const purchasePrice = Number(purchase_price) || 0;
    const salvageValue = Number(residual_value) || 0;

    const rows = await sql`
      INSERT INTO fixed_assets (
        name, description, category_id, asset_number, serial_number,
        purchase_date, purchase_price, residual_value, depreciation_start_date,
        useful_life_months, depreciation_method, accumulated_depreciation,
        location, vendor_id, notes, status
      ) VALUES (
        ${name},
        ${description},
        ${category_id || null},
        ${generatedNumber},
        ${serial_number},
        ${purchase_date},
        ${purchasePrice},
        ${salvageValue},
        ${depreciation_start_date || purchase_date},
        ${useful_life_months},
        ${depreciation_method},
        0,
        ${location},
        ${vendor_id || null},
        ${notes},
        'active'
      )
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Error in assets POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
