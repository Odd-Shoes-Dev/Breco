import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bookings/[id] - Get booking details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const rows = await sql`
      SELECT
        b.*,
        json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'country', c.country) AS customer,
        json_build_object('id', tp.id, 'name', tp.name, 'package_code', tp.package_code, 'duration_days', tp.duration_days, 'price_per_person', tp.price_per_person, 'currency', tp.currency) AS tour_package,
        json_build_object('id', h.id, 'name', h.name, 'star_rating', h.star_rating, 'address', h.address, 'phone', h.phone) AS hotel,
        json_build_object('id', v.id, 'registration_number', v.registration_number, 'vehicle_type', v.vehicle_type, 'seating_capacity', v.seating_capacity, 'daily_rate_usd', v.daily_rate_usd) AS vehicle,
        COALESCE((SELECT json_agg(g.*) FROM booking_guests g WHERE g.booking_id = b.id), '[]') AS guests,
        COALESCE((SELECT json_agg(a.*) FROM booking_activities a WHERE a.booking_id = b.id), '[]') AS activities,
        COALESCE((SELECT json_agg(p.*) FROM booking_payments p WHERE p.booking_id = b.id), '[]') AS payments
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN tour_packages tp ON tp.id = b.tour_package_id
      LEFT JOIN hotels h ON h.id = b.hotel_id
      LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
      WHERE b.id = ${id}
    `;
    const data = (rows as any[])[0];

    if (!data) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bookings/[id] - Update booking
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

    // Get existing booking
    const existingRows = await sql`SELECT status, tour_package_id, number_of_people FROM bookings WHERE id = ${id}`;
    const existing = (existingRows as any[])[0];

    // Check availability if changing to confirmed status
    if (body.status === 'confirmed' && existing?.status !== 'confirmed' && body.tour_package_id) {
      const numberOfPeople = body.number_of_people || existing?.number_of_people || 1;

      try {
        const availRows = await sql`SELECT check_tour_availability(${body.tour_package_id}::uuid, ${numberOfPeople}::int) AS available`;
        const available = (availRows as any[])[0]?.available;
        if (!available) {
          return NextResponse.json(
            { error: `Insufficient availability. Tour package has less than ${numberOfPeople} slots available.` },
            { status: 400 }
          );
        }
      } catch (e) {
        // If function doesn't exist, skip check
      }
    }

    // Update booking with all provided fields (only known safe columns)
    await sql`
      UPDATE bookings SET
        customer_id = COALESCE(${body.customer_id ?? null}, customer_id),
        booking_type = COALESCE(${body.booking_type ?? null}, booking_type),
        travel_start_date = COALESCE(${body.travel_start_date ?? null}, travel_start_date),
        travel_end_date = COALESCE(${body.travel_end_date ?? null}, travel_end_date),
        tour_package_id = CASE WHEN ${body.tour_package_id !== undefined} THEN ${body.tour_package_id ?? null} ELSE tour_package_id END,
        hotel_id = CASE WHEN ${body.hotel_id !== undefined} THEN ${body.hotel_id ?? null} ELSE hotel_id END,
        assigned_vehicle_id = CASE WHEN ${body.assigned_vehicle_id !== undefined} THEN ${body.assigned_vehicle_id ?? null} ELSE assigned_vehicle_id END,
        number_of_people = COALESCE(${body.number_of_people ?? null}, number_of_people),
        status = COALESCE(${body.status ?? null}, status),
        currency = COALESCE(${body.currency ?? null}, currency),
        exchange_rate = COALESCE(${body.exchange_rate ?? null}, exchange_rate),
        total = COALESCE(${body.total ?? null}, total),
        amount_paid = COALESCE(${body.amount_paid ?? null}, amount_paid),
        balance_due = COALESCE(${body.balance_due ?? null}, balance_due),
        special_requests = CASE WHEN ${body.special_requests !== undefined} THEN ${body.special_requests ?? null} ELSE special_requests END,
        notes = CASE WHEN ${body.notes !== undefined} THEN ${body.notes ?? null} ELSE notes END
      WHERE id = ${id}
    `;

    const dataRows = await sql`
      SELECT
        b.*,
        json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'country', c.country) AS customer,
        json_build_object('id', tp.id, 'name', tp.name, 'duration_days', tp.duration_days) AS tour_package
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN tour_packages tp ON tp.id = b.tour_package_id
      WHERE b.id = ${id}
    `;
    const data = (dataRows as any[])[0];

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bookings/[id] - Delete booking
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

    const bookingRows = await sql`SELECT id, status FROM bookings WHERE id = ${id}`;
    const booking = (bookingRows as any[])[0];

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft bookings can be deleted. Please cancel confirmed bookings instead.' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM bookings WHERE id = ${id}`;

    return NextResponse.json({ message: 'Booking deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
