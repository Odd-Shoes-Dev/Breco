import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const stockTakeId = searchParams.get('stock_take_id');

    let data;
    if (status && stockTakeId) {
      data = await sql`
        SELECT st.*,
          row_to_json(il.*) AS inventory_locations,
          row_to_json(up.*) AS users
        FROM stock_takes st
        LEFT JOIN inventory_locations il ON il.id = st.location_id
        LEFT JOIN users up ON up.id = st.counted_by
        WHERE st.status = ${status} AND st.id = ${stockTakeId}
        ORDER BY st.stock_take_date DESC
      `;
    } else if (status) {
      data = await sql`
        SELECT st.*,
          row_to_json(il.*) AS inventory_locations,
          row_to_json(up.*) AS users
        FROM stock_takes st
        LEFT JOIN inventory_locations il ON il.id = st.location_id
        LEFT JOIN users up ON up.id = st.counted_by
        WHERE st.status = ${status}
        ORDER BY st.stock_take_date DESC
      `;
    } else if (stockTakeId) {
      data = await sql`
        SELECT st.*,
          row_to_json(il.*) AS inventory_locations,
          row_to_json(up.*) AS users
        FROM stock_takes st
        LEFT JOIN inventory_locations il ON il.id = st.location_id
        LEFT JOIN users up ON up.id = st.counted_by
        WHERE st.id = ${stockTakeId}
        ORDER BY st.stock_take_date DESC
      `;
    } else {
      data = await sql`
        SELECT st.*,
          row_to_json(il.*) AS inventory_locations,
          row_to_json(up.*) AS users
        FROM stock_takes st
        LEFT JOIN inventory_locations il ON il.id = st.location_id
        LEFT JOIN users up ON up.id = st.counted_by
        ORDER BY st.stock_take_date DESC
      `;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching stock takes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      reference_number,
      stock_take_date,
      location_id,
      type,
      notes,
      lines,
    } = body;

    if (!reference_number || !stock_take_date || !location_id || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create stock take
    const stockTakeRows = await sql`
      INSERT INTO stock_takes (reference_number, stock_take_date, location_id, type, status, counted_by, notes)
      VALUES (${reference_number}, ${stock_take_date}, ${location_id}, ${type}, 'draft', ${user.id}, ${notes || null})
      RETURNING *
    `;
    const stockTake = stockTakeRows[0];

    if (!stockTake) {
      return NextResponse.json({ error: 'Failed to create stock take' }, { status: 500 });
    }

    // Create lines if provided
    if (lines && lines.length > 0) {
      for (const line of lines) {
        await sql`
          INSERT INTO stock_take_lines (stock_take_id, product_id, expected_quantity, counted_quantity, variance, notes)
          VALUES (
            ${stockTake.id}, ${line.product_id}, ${line.expected_quantity},
            ${line.counted_quantity}, ${line.counted_quantity - line.expected_quantity},
            ${line.notes || null}
          )
        `;
      }
    }

    return NextResponse.json(stockTake, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock take:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
