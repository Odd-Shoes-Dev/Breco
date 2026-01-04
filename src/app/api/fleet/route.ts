import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/fleet - List all vehicles with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const searchQuery = searchParams.get('search');
    const status = searchParams.get('status');
    const vehicleType = searchParams.get('vehicle_type');

    let query = supabase
      .from('vehicles')
      .select('*')
      .order('registration_number', { ascending: true });

    // Apply filters
    if (searchQuery) {
      query = query.or(`registration_number.ilike.%${searchQuery}%,make.ilike.%${searchQuery}%,model.ilike.%${searchQuery}%`);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (vehicleType && vehicleType !== 'all') {
      query = query.eq('vehicle_type', vehicleType);
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

// POST /api/fleet - Create a new vehicle
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.registration_number || !body.make || !body.model || !body.vehicle_type) {
      return NextResponse.json(
        { error: 'Missing required fields: registration_number, make, model, vehicle_type' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for duplicate registration number
    const { data: existing } = await supabase
      .from('vehicles')
      .select('id')
      .eq('registration_number', body.registration_number)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Vehicle with this registration number already exists' },
        { status: 409 }
      );
    }

    // Create the vehicle
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        ...body,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
