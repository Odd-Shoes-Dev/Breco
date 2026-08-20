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
        vehicle_number = COALESCE(${body.vehicle_number ?? null}::text, vehicle_number),
        registration_number = COALESCE(${body.registration_number ?? null}::text, registration_number),
        make = COALESCE(${body.make ?? null}::text, make),
        model = COALESCE(${body.model ?? null}::text, model),
        vehicle_type = COALESCE(${body.vehicle_type ?? null}::text, vehicle_type),
        year = CASE WHEN ${body.year !== undefined}::boolean THEN ${body.year ?? null} ELSE year END,
        color = CASE WHEN ${body.color !== undefined}::boolean THEN ${body.color ?? null}::text ELSE color END,
        status = COALESCE(${body.status ?? null}, status),
        fuel_type = CASE WHEN ${body.fuel_type !== undefined}::boolean THEN ${body.fuel_type ?? null}::text ELSE fuel_type END,
        transmission = CASE WHEN ${body.transmission !== undefined}::boolean THEN ${body.transmission ?? null}::text ELSE transmission END,
        seating_capacity = COALESCE(${body.seating_capacity ?? null}, seating_capacity),
        luggage_capacity = CASE WHEN ${body.luggage_capacity !== undefined}::boolean THEN ${body.luggage_capacity ?? null}::text ELSE luggage_capacity END,
        features = CASE WHEN ${body.features !== undefined}::boolean THEN ${body.features ?? null} ELSE features END,
        purchase_price = CASE WHEN ${body.purchase_price !== undefined}::boolean THEN ${body.purchase_price ?? null} ELSE purchase_price END,
        purchase_date = CASE WHEN ${body.purchase_date !== undefined}::boolean THEN ${body.purchase_date ?? null}::date ELSE purchase_date END,
        current_value = CASE WHEN ${body.current_value !== undefined}::boolean THEN ${body.current_value ?? null} ELSE current_value END,
        insurance_expiry = CASE WHEN ${body.insurance_expiry !== undefined}::boolean THEN ${body.insurance_expiry ?? null}::date ELSE insurance_expiry END,
        daily_rate_usd = CASE WHEN ${body.daily_rate_usd !== undefined}::boolean THEN ${body.daily_rate_usd ?? null} ELSE daily_rate_usd END,
        daily_rate_ugx = CASE WHEN ${body.daily_rate_ugx !== undefined}::boolean THEN ${body.daily_rate_ugx ?? null} ELSE daily_rate_ugx END,
        weekly_rate_usd = CASE WHEN ${body.weekly_rate_usd !== undefined}::boolean THEN ${body.weekly_rate_usd ?? null} ELSE weekly_rate_usd END,
        mileage_rate = CASE WHEN ${body.mileage_rate !== undefined}::boolean THEN ${body.mileage_rate ?? null} ELSE mileage_rate END,
        current_mileage = COALESCE(${body.current_mileage ?? null}, current_mileage),
        last_service_date = CASE WHEN ${body.last_service_date !== undefined}::boolean THEN ${body.last_service_date ?? null}::date ELSE last_service_date END,
        next_service_mileage = CASE WHEN ${body.next_service_mileage !== undefined}::boolean THEN ${body.next_service_mileage ?? null} ELSE next_service_mileage END,
        location = CASE WHEN ${body.location !== undefined}::boolean THEN ${body.location ?? null}::text ELSE location END,
        is_active = COALESCE(${body.is_active ?? null}, is_active),
        notes = CASE WHEN ${body.notes !== undefined}::boolean THEN ${body.notes ?? null}::text ELSE notes END,
        updated_at = NOW()
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
