import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bookings - List all bookings with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const bookingType = searchParams.get('booking_type');
    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(id, name, email, phone, country),
        tour_package:tour_packages(id, name, duration_days),
        assigned_guide:employees!bookings_assigned_guide_id_fkey(id, first_name, last_name),
        assigned_vehicle:vehicles(id, registration_number, make, model)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (bookingType && bookingType !== 'all') {
      query = query.eq('booking_type', bookingType);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (startDate) {
      query = query.gte('travel_start_date', startDate);
    }

    if (endDate) {
      query = query.lte('travel_end_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.customer_id || !body.booking_type || !body.travel_start_date || !body.travel_end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_id, booking_type, travel_start_date, travel_end_date' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check tour package availability if specified and status is confirmed
    if (body.tour_package_id && body.status === 'confirmed') {
      const numberOfPeople = body.number_of_people || 1;
      
      const { data: available, error: availError } = await supabase
        .rpc('check_tour_availability', {
          p_tour_package_id: body.tour_package_id,
          p_number_of_people: numberOfPeople,
        });

      if (availError) {
        console.error('Error checking availability:', availError);
      } else if (!available) {
        return NextResponse.json(
          { error: `Insufficient availability. Tour package has less than ${numberOfPeople} slots available.` },
          { status: 400 }
        );
      }
    }

    // Generate booking number
    const { data: latestBooking } = await supabase
      .from('bookings')
      .select('booking_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (latestBooking?.booking_number) {
      const match = latestBooking.booking_number.match(/BK-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const bookingNumber = `BK-${nextNumber.toString().padStart(6, '0')}`;

    // Create the booking
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...body,
        booking_number: bookingNumber,
        number_of_people: body.number_of_people || 1,
        created_by: user.id,
      })
      .select(`
        *,
        customer:customers(id, name, email, phone, country),
        tour_package:tour_packages(id, name, duration_days)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
