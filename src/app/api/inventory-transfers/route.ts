import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
      VALUES (${transfer_number}, ${from_location_id}, ${to_location_id}, ${transfer_date ?? null}, 'pending', ${notes ?? null})
      RETURNING *
    `;
    const transfer = transferRows[0];

    // Create transfer lines
    for (const line of lines) {
      await sql`
        INSERT INTO inventory_transfer_lines (transfer_id, product_id, quantity)
        VALUES (${transfer.id}, ${line.product_id}, ${line.quantity})
      `;
    }

    return NextResponse.json(transfer);
  } catch (error: any) {
    console.error('Error creating transfer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
