import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/hotels/[id] - Get hotel details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const hotels = await sql`SELECT * FROM hotels WHERE id = ${id}`;
    if (hotels.length === 0) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }
    const hotel = hotels[0];

    const [destRows, roomTypes, images] = await Promise.all([
      sql`SELECT id, name, country, description FROM destinations WHERE id = ${hotel.destination_id}`,
      sql`SELECT * FROM hotel_room_types WHERE hotel_id = ${id}`,
      sql`SELECT * FROM hotel_images WHERE hotel_id = ${id}`,
    ]);

    const data = {
      ...hotel,
      destination: destRows[0] || null,
      room_types: roomTypes,
      images,
    };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/hotels/[id] - Update hotel
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
      UPDATE hotels SET
        name = COALESCE(${body.name ?? null}::text, name),
        destination_id = COALESCE(${body.destination_id ?? null}::uuid, destination_id),
        address = CASE WHEN ${body.address !== undefined}::boolean THEN ${body.address ?? null}::text ELSE address END,
        star_rating = CASE WHEN ${body.star_rating !== undefined}::boolean THEN ${body.star_rating ?? null} ELSE star_rating END,
        hotel_type = CASE WHEN ${body.hotel_type !== undefined}::boolean THEN ${body.hotel_type ?? null}::text ELSE hotel_type END,
        standard_rate_usd = CASE WHEN ${body.standard_rate_usd !== undefined}::boolean THEN ${body.standard_rate_usd ?? null} ELSE standard_rate_usd END,
        deluxe_rate_usd = CASE WHEN ${body.deluxe_rate_usd !== undefined}::boolean THEN ${body.deluxe_rate_usd ?? null} ELSE deluxe_rate_usd END,
        suite_rate_usd = CASE WHEN ${body.suite_rate_usd !== undefined}::boolean THEN ${body.suite_rate_usd ?? null} ELSE suite_rate_usd END,
        contact_person = CASE WHEN ${body.contact_person !== undefined}::boolean THEN ${body.contact_person ?? null}::text ELSE contact_person END,
        contact_phone = CASE WHEN ${body.contact_phone !== undefined}::boolean THEN ${body.contact_phone ?? null}::text ELSE contact_phone END,
        commission_rate = CASE WHEN ${body.commission_rate !== undefined}::boolean THEN ${body.commission_rate ?? null} ELSE commission_rate END,
        notes = CASE WHEN ${body.notes !== undefined}::boolean THEN ${body.notes ?? null}::text ELSE notes END,
        is_partner = CASE WHEN ${body.is_partner !== undefined}::boolean THEN ${body.is_partner ?? null}::boolean ELSE is_partner END,
        website = CASE WHEN ${body.website !== undefined}::boolean THEN ${body.website ?? null}::text ELSE website END,
        phone = CASE WHEN ${body.phone !== undefined}::boolean THEN ${body.phone ?? null}::text ELSE phone END,
        email = CASE WHEN ${body.email !== undefined}::boolean THEN ${body.email ?? null}::text ELSE email END,
        is_active = CASE WHEN ${body.is_active !== undefined}::boolean THEN ${body.is_active ?? null}::boolean ELSE is_active END
      WHERE id = ${id}
      RETURNING *
    `;
    const hotel = rows[0];

    const destRows = await sql`
      SELECT id, name, country FROM destinations WHERE id = ${hotel.destination_id}
    `;
    const data = { ...hotel, destination: destRows[0] || null };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/hotels/[id] - Delete hotel
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

    // Check if hotel is used in any bookings
    const bookings = await sql`
      SELECT id FROM booking_hotels WHERE hotel_id = ${id} LIMIT 1
    `;

    if (bookings.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete hotel that is used in bookings. Please deactivate it instead.' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM hotels WHERE id = ${id}`;

    return NextResponse.json({ message: 'Hotel deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
