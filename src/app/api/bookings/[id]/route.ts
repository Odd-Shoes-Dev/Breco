import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bookings/[id] - Get booking details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(id, name, email, phone, country),
        tour_package:tour_packages(id, name, package_code, duration_days, price_per_person, currency),
        hotel:hotels(id, name, star_rating, address, phone),
        vehicle:vehicles!bookings_assigned_vehicle_id_fkey(id, registration_number, vehicle_type, seating_capacity, daily_rate_usd),
        guests:booking_guests(*),
        activities:booking_activities(*),
        payments:booking_payments(*)
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

// PATCH /api/bookings/[id] - Update booking
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

    // Get existing booking
    const { data: existing } = await supabase
      .from('bookings')
      .select('status, tour_package_id, number_of_people')
      .eq('id', id)
      .single();

    // Check availability if changing to confirmed status
    if (body.status === 'confirmed' && existing?.status !== 'confirmed' && body.tour_package_id) {
      const numberOfPeople = body.number_of_people || existing?.number_of_people || 1;
      
      const { data: available } = await supabase
        .rpc('check_tour_availability', {
          p_tour_package_id: body.tour_package_id,
          p_number_of_people: numberOfPeople,
        });

      if (!available) {
        return NextResponse.json(
          { error: `Insufficient availability. Tour package has less than ${numberOfPeople} slots available.` },
          { status: 400 }
        );
      }
    }

    // Update the booking (trigger will handle availability)
    const { data, error } = await supabase
      .from('bookings')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        customer:customers(id, name, email, phone, country),
        tour_package:tour_packages(id, name, duration_days)
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

// DELETE /api/bookings/[id] - Delete booking
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

    // Check if booking exists
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Only allow deletion of draft bookings
    if (booking.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft bookings can be deleted. Please cancel confirmed bookings instead.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Booking deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
