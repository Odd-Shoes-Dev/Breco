import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql`
      SELECT *, location_code AS code, address_line1 AS address, zip_code AS postal_code
      FROM inventory_locations WHERE id = ${id}`;
    const data = rows[0];

    if (!data) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Get inventory count at this location (stock is computed from inventory_movements)
    const inventoryRows = await sql`
      SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory_movements WHERE location_id = ${id}
    `;
    const totalQuantity = Number(inventoryRows[0]?.quantity || 0);

    return NextResponse.json({ ...data, total_inventory: totalQuantity });
  } catch (error: any) {
    console.error('Error fetching location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build SET clause from body fields
    const fields = Object.keys(body);
    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Update fields one by one safely
    for (const field of fields) {
      const value = body[field];
      if (field === 'name') await sql`UPDATE inventory_locations SET name = ${value} WHERE id = ${id}`;
      else if (field === 'code') await sql`UPDATE inventory_locations SET location_code = ${value} WHERE id = ${id}`;
      else if (field === 'type') await sql`UPDATE inventory_locations SET type = ${value} WHERE id = ${id}`;
      else if (field === 'address') await sql`UPDATE inventory_locations SET address_line1 = ${value} WHERE id = ${id}`;
      else if (field === 'city') await sql`UPDATE inventory_locations SET city = ${value} WHERE id = ${id}`;
      else if (field === 'state') await sql`UPDATE inventory_locations SET state = ${value} WHERE id = ${id}`;
      else if (field === 'postal_code') await sql`UPDATE inventory_locations SET zip_code = ${value} WHERE id = ${id}`;
      else if (field === 'country') await sql`UPDATE inventory_locations SET country = ${value} WHERE id = ${id}`;
      else if (field === 'phone') await sql`UPDATE inventory_locations SET phone = ${value} WHERE id = ${id}`;
      else if (field === 'is_active') await sql`UPDATE inventory_locations SET is_active = ${value} WHERE id = ${id}`;
    }

    const rows = await sql`
      SELECT *, location_code AS code, address_line1 AS address, zip_code AS postal_code
      FROM inventory_locations WHERE id = ${id}`;
    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('Error updating location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if location has inventory movements
    const inventoryRows = await sql`
      SELECT id FROM inventory_movements WHERE location_id = ${id} LIMIT 1
    `;

    if (inventoryRows.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete location with existing inventory' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM inventory_locations WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
