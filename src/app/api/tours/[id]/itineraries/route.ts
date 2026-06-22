import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/tours/[id]/itineraries - Get tour itineraries
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const data = await sql`
      SELECT * FROM tour_itineraries
      WHERE tour_package_id = ${id}
      ORDER BY day_number
    `;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/tours/[id]/itineraries - Create itinerary
export async function POST(
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
      INSERT INTO tour_itineraries (
        tour_package_id, day_number, title, description, accommodation, meals, activities
      ) VALUES (
        ${id}, ${body.day_number}, ${body.title || null}, ${body.description || null},
        ${body.accommodation || null}, ${body.meals || null}, ${body.activities || null}
      )
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/tours/[id]/itineraries - Update itinerary
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { itineraryId } = body;

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await sql`
      UPDATE tour_itineraries
      SET
        day_number = COALESCE(${body.day_number ?? null}, day_number),
        title = COALESCE(${body.title ?? null}, title),
        description = COALESCE(${body.description ?? null}, description),
        accommodation = COALESCE(${body.accommodation ?? null}, accommodation),
        meals = COALESCE(${body.meals ?? null}, meals),
        activities = COALESCE(${body.activities ?? null}, activities)
      WHERE id = ${itineraryId}
      RETURNING *
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tours/[id]/itineraries - Delete itinerary
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const itineraryId = searchParams.get('itineraryId');

    if (!itineraryId) {
      return NextResponse.json({ error: 'Itinerary ID required' }, { status: 400 });
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await sql`DELETE FROM tour_itineraries WHERE id = ${itineraryId}`;

    return NextResponse.json({ message: 'Itinerary deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
