import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bookings - List all bookings with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const bookingType = searchParams.get('booking_type');
    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const rows = await sql`
      SELECT
        b.*,
        json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'country', c.country) AS customer,
        json_build_object('id', tp.id, 'name', tp.name, 'package_code', tp.package_code, 'duration_days', tp.duration_days) AS tour_package,
        json_build_object('id', h.id, 'name', h.name, 'star_rating', h.star_rating) AS hotel,
        json_build_object('id', v.id, 'vehicle_type', v.vehicle_type, 'registration_number', v.registration_number, 'daily_rate_usd', v.daily_rate_usd) AS vehicle
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN tour_packages tp ON tp.id = b.tour_package_id
      LEFT JOIN hotels h ON h.id = b.hotel_id
      LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
      ORDER BY b.created_at DESC
    `;

    let data = rows as any[];

    if (status && status !== 'all') data = data.filter((b: any) => b.status === status);
    if (bookingType && bookingType !== 'all') data = data.filter((b: any) => b.booking_type === bookingType);
    if (customerId) data = data.filter((b: any) => b.customer_id === customerId);
    if (startDate) data = data.filter((b: any) => b.travel_start_date >= startDate);
    if (endDate) data = data.filter((b: any) => b.travel_end_date <= endDate);

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.customer_id || !body.booking_type || !body.travel_start_date || !body.travel_end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_id, booking_type, travel_start_date, travel_end_date' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check tour package availability if specified and status is confirmed
    if (body.tour_package_id && body.status === 'confirmed') {
      const numberOfPeople = body.number_of_people || 1;

      try {
        const availRows = await sql`SELECT check_tour_availability(${body.tour_package_id}::uuid, ${numberOfPeople}::int) AS available`;
        const available = (availRows as any[])[0]?.available;
        if (!available) {
          return NextResponse.json(
            { error: `Insufficient availability. Tour package has less than ${numberOfPeople} slots available.` },
            { status: 400 }
          );
        }
      } catch (availErr: any) {
        console.error('Error checking availability:', availErr);
      }
    }

    // Generate booking number
    const latestRows = await sql`SELECT booking_number FROM bookings ORDER BY created_at DESC LIMIT 1`;
    const latestBooking = (latestRows as any[])[0];

    let nextNumber = 1;
    if (latestBooking?.booking_number) {
      const match = latestBooking.booking_number.match(/BK-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const bookingNumber = `BK-${nextNumber.toString().padStart(6, '0')}`;

    const insertedRows = await sql`
      INSERT INTO bookings (
        customer_id, booking_type, travel_start_date, travel_end_date,
        tour_package_id, hotel_id, assigned_vehicle_id, number_of_people,
        status, currency, exchange_rate, total, amount_paid,
        special_requests, notes, booking_number, created_by
      ) VALUES (
        ${body.customer_id}, ${body.booking_type}, ${body.travel_start_date}, ${body.travel_end_date},
        ${body.tour_package_id ?? null}, ${body.hotel_id ?? null}, ${body.assigned_vehicle_id ?? null},
        ${body.number_of_people || 1},
        ${body.status || 'draft'}, ${body.currency || 'USD'}, ${body.exchange_rate || 1.0},
        ${body.total || 0}, ${body.amount_paid || 0},
        ${body.special_requests ?? null}, ${body.notes ?? null},
        ${bookingNumber}, ${user.id}
      )
      RETURNING id
    `;
    const newId = (insertedRows as any[])[0].id;

    const dataRows = await sql`
      SELECT
        b.*,
        json_build_object('id', c.id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'country', c.country) AS customer,
        json_build_object('id', tp.id, 'name', tp.name, 'duration_days', tp.duration_days) AS tour_package
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN tour_packages tp ON tp.id = b.tour_package_id
      WHERE b.id = ${newId}
    `;
    const data = (dataRows as any[])[0];

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
