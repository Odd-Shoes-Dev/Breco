import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/tours/[id] - Get tour package details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const rows = await sql`
      SELECT tp.*,
        row_to_json(d.*) AS primary_destination,
        (SELECT json_agg(tpi.*) FROM tour_package_images tpi WHERE tpi.tour_package_id = tp.id) AS images,
        (SELECT json_agg(ti.*) FROM tour_itineraries ti WHERE ti.tour_package_id = tp.id) AS itineraries,
        (
          SELECT json_agg(json_build_object(
            'id', tpd.id, 'tour_package_id', tpd.tour_package_id, 'destination_id', tpd.destination_id,
            'destination', row_to_json(dest.*)
          ))
          FROM tour_package_destinations tpd
          LEFT JOIN destinations dest ON dest.id = tpd.destination_id
          WHERE tpd.tour_package_id = tp.id
        ) AS destinations,
        (SELECT json_agg(tsp.*) FROM tour_seasonal_pricing tsp WHERE tsp.tour_package_id = tp.id) AS seasonal_pricing
      FROM tour_packages tp
      LEFT JOIN destinations d ON d.id = tp.primary_destination_id
      WHERE tp.id = ${id}
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/tours/[id] - Update tour package
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

    // Build SET clause from body fields
    const allowedFields = [
      'name', 'description', 'primary_destination_id', 'duration_days', 'price_per_person',
      'max_group_size', 'min_group_size', 'difficulty_level', 'included_services',
      'excluded_services', 'is_featured', 'is_active',
    ];

    const updates: any = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // We need to handle dynamic updates; do individual field updates or use a workaround
    // Build update using separate queries for each field (safe approach with tagged templates)
    // For simplicity, use the fields approach
    const rows = await sql`
      UPDATE tour_packages
      SET
        name = COALESCE(${updates.name ?? null}, name),
        description = COALESCE(${updates.description ?? null}, description),
        primary_destination_id = COALESCE(${updates.primary_destination_id ?? null}, primary_destination_id),
        duration_days = COALESCE(${updates.duration_days ?? null}, duration_days),
        price_per_person = COALESCE(${updates.price_per_person ?? null}, price_per_person),
        max_group_size = COALESCE(${updates.max_group_size ?? null}, max_group_size),
        min_group_size = COALESCE(${updates.min_group_size ?? null}, min_group_size),
        difficulty_level = COALESCE(${updates.difficulty_level ?? null}, difficulty_level),
        included_services = COALESCE(${updates.included_services ?? null}, included_services),
        excluded_services = COALESCE(${updates.excluded_services ?? null}, excluded_services),
        is_featured = COALESCE(${updates.is_featured ?? null}, is_featured),
        is_active = COALESCE(${updates.is_active ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 });
    }

    // Fetch with destination
    const fullRows = await sql`
      SELECT tp.*,
        row_to_json(d.*) AS primary_destination
      FROM tour_packages tp
      LEFT JOIN destinations d ON d.id = tp.primary_destination_id
      WHERE tp.id = ${id}
    `;

    return NextResponse.json({ data: fullRows[0] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tours/[id] - Delete tour package
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

    // Check if tour is used in any bookings
    const bookings = await sql`
      SELECT id FROM bookings WHERE tour_package_id = ${id} LIMIT 1
    `;

    if (bookings.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete tour package that is used in bookings. Please deactivate it instead.' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM tour_packages WHERE id = ${id}`;

    return NextResponse.json({ message: 'Tour package deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
