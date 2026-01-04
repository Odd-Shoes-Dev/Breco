import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/hotels - List all hotels with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const searchQuery = searchParams.get('search');
    const destinationId = searchParams.get('destination_id');
    const minRating = searchParams.get('min_rating');
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('hotels')
      .select(`
        *,
        destination:destinations(id, name, country)
      `)
      .order('name', { ascending: true });

    // Apply filters
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`);
    }

    if (destinationId && destinationId !== 'all') {
      query = query.eq('destination_id', destinationId);
    }

    if (minRating) {
      query = query.gte('star_rating', parseFloat(minRating));
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

// POST /api/hotels - Create a new hotel
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.destination_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, destination_id' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create the hotel
    const { data, error } = await supabase
      .from('hotels')
      .insert({
        ...body,
        created_by: user.id,
      })
      .select(`
        *,
        destination:destinations(id, name, country)
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
