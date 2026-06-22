import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/hotels - List all hotels with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const searchQuery = searchParams.get('search');
    const destinationId = searchParams.get('destination_id');
    const minRating = searchParams.get('min_rating');
    const isActive = searchParams.get('is_active');

    let rows: any[];

    // Build conditions progressively
    const conditions: string[] = [];
    if (searchQuery) conditions.push('search');
    if (destinationId && destinationId !== 'all') conditions.push('dest');
    if (minRating) conditions.push('rating');
    if (isActive !== null && isActive !== undefined) conditions.push('active');

    // Use conditional queries based on filter combinations
    if (searchQuery && destinationId && destinationId !== 'all' && minRating && isActive !== null && isActive !== undefined) {
      const q = `%${searchQuery}%`;
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        WHERE (h.name ILIKE ${q} OR h.address ILIKE ${q})
          AND h.destination_id = ${destinationId}
          AND h.star_rating >= ${parseFloat(minRating)}
          AND h.is_active = ${isActive === 'true'}
        ORDER BY h.name ASC
      `;
    } else if (searchQuery && destinationId && destinationId !== 'all' && minRating) {
      const q = `%${searchQuery}%`;
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        WHERE (h.name ILIKE ${q} OR h.address ILIKE ${q})
          AND h.destination_id = ${destinationId}
          AND h.star_rating >= ${parseFloat(minRating)}
        ORDER BY h.name ASC
      `;
    } else if (searchQuery && destinationId && destinationId !== 'all') {
      const q = `%${searchQuery}%`;
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        WHERE (h.name ILIKE ${q} OR h.address ILIKE ${q})
          AND h.destination_id = ${destinationId}
        ORDER BY h.name ASC
      `;
    } else if (searchQuery && minRating) {
      const q = `%${searchQuery}%`;
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        WHERE (h.name ILIKE ${q} OR h.address ILIKE ${q})
          AND h.star_rating >= ${parseFloat(minRating)}
        ORDER BY h.name ASC
      `;
    } else if (destinationId && destinationId !== 'all' && minRating) {
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        WHERE h.destination_id = ${destinationId} AND h.star_rating >= ${parseFloat(minRating)}
        ORDER BY h.name ASC
      `;
    } else if (searchQuery) {
      const q = `%${searchQuery}%`;
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        WHERE h.name ILIKE ${q} OR h.address ILIKE ${q}
        ORDER BY h.name ASC
      `;
    } else if (destinationId && destinationId !== 'all') {
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        WHERE h.destination_id = ${destinationId}
        ORDER BY h.name ASC
      `;
    } else if (minRating) {
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        WHERE h.star_rating >= ${parseFloat(minRating)}
        ORDER BY h.name ASC
      `;
    } else if (isActive !== null && isActive !== undefined) {
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        WHERE h.is_active = ${isActive === 'true'}
        ORDER BY h.name ASC
      `;
    } else {
      rows = await sql`
        SELECT h.*, json_build_object('id', d.id, 'name', d.name, 'country', d.country) AS destination
        FROM hotels h LEFT JOIN destinations d ON d.id = h.destination_id
        ORDER BY h.name ASC
      `;
    }

    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/hotels - Create a new hotel
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.destination_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, destination_id' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create the hotel
    const rows = await sql`
      INSERT INTO hotels (
        name, destination_id, address, star_rating, description,
        website, phone, email, check_in_time, check_out_time,
        amenities, is_active, created_by
      ) VALUES (
        ${body.name}, ${body.destination_id}, ${body.address || null},
        ${body.star_rating || null}, ${body.description || null},
        ${body.website || null}, ${body.phone || null}, ${body.email || null},
        ${body.check_in_time || null}, ${body.check_out_time || null},
        ${body.amenities || null}, ${body.is_active !== false}, ${user.id}
      )
      RETURNING *
    `;
    const hotel = rows[0];

    const destRows = await sql`
      SELECT id, name, country FROM destinations WHERE id = ${hotel.destination_id}
    `;
    const data = { ...hotel, destination: destRows[0] || null };

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
