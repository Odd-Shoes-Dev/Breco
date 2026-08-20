import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/inventory-transfers - List transfers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let rows: any[];
    if (status && status !== 'all') {
      rows = await sql`
        SELECT it.*,
          json_build_object('name', fl.name, 'code', fl.location_code) AS from_location,
          json_build_object('name', tl.name, 'code', tl.location_code) AS to_location
        FROM inventory_transfers it
        LEFT JOIN inventory_locations fl ON fl.id = it.from_location_id
        LEFT JOIN inventory_locations tl ON tl.id = it.to_location_id
        WHERE it.status = ${status}
        ORDER BY it.created_at DESC
      `;
    } else {
      rows = await sql`
        SELECT it.*,
          json_build_object('name', fl.name, 'code', fl.location_code) AS from_location,
          json_build_object('name', tl.name, 'code', tl.location_code) AS to_location
        FROM inventory_transfers it
        LEFT JOIN inventory_locations fl ON fl.id = it.from_location_id
        LEFT JOIN inventory_locations tl ON tl.id = it.to_location_id
        ORDER BY it.created_at DESC
      `;
    }

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('Error fetching transfers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { from_location_id, to_location_id, transfer_date, notes, lines } = await request.json();

    if (!from_location_id || !to_location_id || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate transfer number
    const lastTransferRows = await sql`
      SELECT transfer_number FROM inventory_transfers ORDER BY created_at DESC LIMIT 1
    `;
    let nextNumber = 1;
    if (lastTransferRows.length > 0 && lastTransferRows[0].transfer_number) {
      const match = lastTransferRows[0].transfer_number.match(/TR-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const transfer_number = `TR-${nextNumber.toString().padStart(4, '0')}`;

    // Create transfer
    const transferRows = await sql`
      INSERT INTO inventory_transfers (transfer_number, from_location_id, to_location_id, transfer_date, status, notes)
      VALUES (${transfer_number}, ${from_location_id}, ${to_location_id}, ${transfer_date || new Date().toISOString().split('T')[0]}, 'pending', ${notes ?? null})
      RETURNING *
    `;
    const transfer = transferRows[0];

    // Create transfer lines
    for (const line of lines) {
      await sql`
        INSERT INTO inventory_transfer_items (transfer_id, product_id, quantity)
        VALUES (${transfer.id}, ${line.product_id}, ${line.quantity})
      `;
    }

    return NextResponse.json(transfer);
  } catch (error: any) {
    console.error('Error creating transfer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
