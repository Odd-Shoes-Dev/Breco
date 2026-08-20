import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/tours - List all tour packages with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const searchQuery = searchParams.get('search');
    const destinationId = searchParams.get('destination_id');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const isFeatured = searchParams.get('is_featured');
    const isActive = searchParams.get('is_active');

    // Build conditions
    const conditions: string[] = [];
    const values: any[] = [];

    // We'll use a dynamic approach by fetching all and filtering in JS
    // since sql tagged templates don't support truly dynamic WHERE clauses easily
    let data = await sql`
      SELECT tp.*,
        row_to_json(d.*) AS primary_destination
      FROM tour_packages tp
      LEFT JOIN destinations d ON d.id = tp.primary_destination_id
      ORDER BY tp.name ASC
    `;

    // Apply filters in JS
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((t: any) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }

    if (destinationId && destinationId !== 'all') {
      data = data.filter((t: any) => t.primary_destination_id === destinationId);
    }

    if (minPrice) {
      data = data.filter((t: any) => parseFloat(t.base_price_usd) >= parseFloat(minPrice));
    }

    if (maxPrice) {
      data = data.filter((t: any) => parseFloat(t.base_price_usd) <= parseFloat(maxPrice));
    }

    if (isFeatured !== null && isFeatured !== undefined) {
      const featured = isFeatured === 'true';
      data = data.filter((t: any) => t.is_featured === featured);
    }

    if (isActive !== null && isActive !== undefined) {
      const active = isActive === 'true';
      data = data.filter((t: any) => t.is_active === active);
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/tours - Create a new tour package
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.package_code || !body.duration_days) {
      return NextResponse.json(
        { error: 'Missing required fields: name, package_code, duration_days' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await sql`
      INSERT INTO tour_packages (
        package_code, name, description, primary_destination_id,
        duration_days, duration_nights,
        base_price_usd, base_price_eur, base_price_ugx, price_per_person,
        max_group_size, min_group_size, tour_type, difficulty_level,
        inclusions, exclusions, image_url,
        is_featured, is_active, created_by
      ) VALUES (
        ${body.package_code}, ${body.name}, ${body.description || null}, ${body.primary_destination_id || null},
        ${body.duration_days}, ${body.duration_nights ?? 0},
        ${body.base_price_usd ?? 0}, ${body.base_price_eur ?? 0}, ${body.base_price_ugx ?? 0},
        ${body.price_per_person ?? true},
        ${body.max_group_size || null}, ${body.min_group_size || null},
        ${body.tour_type || null}, ${body.difficulty_level || null},
        ${body.inclusions || null}, ${body.exclusions || null}, ${body.image_url || null},
        ${body.is_featured ?? false}, ${body.is_active ?? true}, ${user.id}
      )
      RETURNING *
    `;

    const tour = rows[0];

    // Fetch with destination
    const fullRows = await sql`
      SELECT tp.*,
        row_to_json(d.*) AS primary_destination
      FROM tour_packages tp
      LEFT JOIN destinations d ON d.id = tp.primary_destination_id
      WHERE tp.id = ${tour.id}
    `;

    return NextResponse.json({ data: fullRows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
