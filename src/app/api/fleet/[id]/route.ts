import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/fleet/[id] - Get vehicle details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const vehicles = await sql`SELECT * FROM vehicles WHERE id = ${id}`;
    if (vehicles.length === 0) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }
    const vehicle = vehicles[0];

    const [maintenance, rentals, images] = await Promise.all([
      sql`SELECT * FROM vehicle_maintenance WHERE vehicle_id = ${id}`,
      sql`SELECT * FROM car_rentals WHERE vehicle_id = ${id}`,
      sql`SELECT * FROM vehicle_images WHERE vehicle_id = ${id}`,
    ]);

    const data = { ...vehicle, maintenance, rentals, images };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/fleet/[id] - Update vehicle
export async function PATCH(
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
      UPDATE vehicles SET
        registration_number = COALESCE(${body.registration_number ?? null}::text, registration_number),
        make = COALESCE(${body.make ?? null}::text, make),
        model = COALESCE(${body.model ?? null}::text, model),
        vehicle_type = COALESCE(${body.vehicle_type ?? null}::text, vehicle_type),
        year = CASE WHEN ${body.year !== undefined}::boolean THEN ${body.year ?? null} ELSE year END,
        color = CASE WHEN ${body.color !== undefined}::boolean THEN ${body.color ?? null}::text ELSE color END,
        status = COALESCE(${body.status ?? null}::text, status),
        purchase_price = CASE WHEN ${body.purchase_price !== undefined}::boolean THEN ${body.purchase_price ?? null} ELSE purchase_price END,
        purchase_date = CASE WHEN ${body.purchase_date !== undefined}::boolean THEN ${body.purchase_date ?? null}::date ELSE purchase_date END,
        insurance_expiry = CASE WHEN ${body.insurance_expiry !== undefined}::boolean THEN ${body.insurance_expiry ?? null}::date ELSE insurance_expiry END,
        license_expiry = CASE WHEN ${body.license_expiry !== undefined}::boolean THEN ${body.license_expiry ?? null}::date ELSE license_expiry END,
        mileage = CASE WHEN ${body.mileage !== undefined}::boolean THEN ${body.mileage ?? null} ELSE mileage END,
        fuel_type = CASE WHEN ${body.fuel_type !== undefined}::boolean THEN ${body.fuel_type ?? null}::text ELSE fuel_type END,
        capacity = CASE WHEN ${body.capacity !== undefined}::boolean THEN ${body.capacity ?? null} ELSE capacity END,
        notes = CASE WHEN ${body.notes !== undefined}::boolean THEN ${body.notes ?? null}::text ELSE notes END
      WHERE id = ${id}
      RETURNING *
    `;
    const data = rows[0];

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/fleet/[id] - Delete vehicle
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if vehicle is used in any bookings or rentals
    const [bookingsCheck, rentalsCheck] = await Promise.all([
      sql`SELECT id FROM bookings WHERE assigned_vehicle_id = ${id} LIMIT 1`,
      sql`SELECT id FROM car_rentals WHERE vehicle_id = ${id} LIMIT 1`,
    ]);

    if (bookingsCheck.length > 0 || rentalsCheck.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete vehicle that is used in bookings or rentals. Please mark as out of service instead.' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM vehicles WHERE id = ${id}`;

    return NextResponse.json({ message: 'Vehicle deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
