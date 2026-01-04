import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/fleet/[id] - Get vehicle details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        maintenance:vehicle_maintenance(*),
        rentals:car_rentals(*),
        images:vehicle_images(*)
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

// PATCH /api/fleet/[id] - Update vehicle
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

    // Update the vehicle
    const { data, error } = await supabase
      .from('vehicles')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
    const supabase = await createClient();
    const { id } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if vehicle is used in any bookings or rentals
    const [bookingsCheck, rentalsCheck] = await Promise.all([
      supabase.from('bookings').select('id').eq('assigned_vehicle_id', id).limit(1),
      supabase.from('car_rentals').select('id').eq('vehicle_id', id).limit(1),
    ]);

    if ((bookingsCheck.data && bookingsCheck.data.length > 0) || (rentalsCheck.data && rentalsCheck.data.length > 0)) {
      return NextResponse.json(
        { error: 'Cannot delete vehicle that is used in bookings or rentals. Please mark as out of service instead.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Vehicle deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
