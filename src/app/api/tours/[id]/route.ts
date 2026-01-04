import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/tours/[id] - Get tour package details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('tour_packages')
      .select(`
        *,
        primary_destination:destinations(id, name, country, description),
        images:tour_package_images(*),
        itineraries:tour_itineraries(*),
        destinations:tour_package_destinations(
          *,
          destination:destinations(id, name, country)
        ),
        seasonal_pricing:tour_seasonal_pricing(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 200 });
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
    const supabase = await createClient();
    const { id } = await context.params;
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update the tour package
    const { data, error } = await supabase
      .from('tour_packages')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        primary_destination:destinations(id, name, country)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
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
    const supabase = await createClient();
    const { id } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if tour is used in any bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('tour_package_id', id)
      .limit(1);

    if (bookings && bookings.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete tour package that is used in bookings. Please deactivate it instead.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('tour_packages')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Tour package deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
