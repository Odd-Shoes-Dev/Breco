import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/tours - List all tour packages with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const searchQuery = searchParams.get('search');
    const destinationId = searchParams.get('destination_id');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const isFeatured = searchParams.get('is_featured');
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('tour_packages')
      .select(`
        *,
        primary_destination:destinations(id, name, country)
      `)
      .order('name', { ascending: true });

    // Apply filters
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
    }

    if (destinationId && destinationId !== 'all') {
      query = query.eq('primary_destination_id', destinationId);
    }

    if (minPrice) {
      query = query.gte('price_per_person', parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.lte('price_per_person', parseFloat(maxPrice));
    }

    if (isFeatured !== null && isFeatured !== undefined) {
      query = query.eq('is_featured', isFeatured === 'true');
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
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

// POST /api/tours - Create a new tour package
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.primary_destination_id || !body.duration_days || !body.price_per_person) {
      return NextResponse.json(
        { error: 'Missing required fields: name, primary_destination_id, duration_days, price_per_person' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create the tour package
    const { data, error } = await supabase
      .from('tour_packages')
      .insert({
        ...body,
        created_by: user.id,
      })
      .select(`
        *,
        primary_destination:destinations(id, name, country)
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
