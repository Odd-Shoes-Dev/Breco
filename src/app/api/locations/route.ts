import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let query = supabase
      .from('locations')
      .select('*')
      .order('name');

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching locations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const {
      name,
      code,
      type,
      address,
      city,
      state,
      postal_code,
      country,
      phone,
      email,
      manager_name,
      is_active
    } = body;

    if (!name || !code || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('locations')
      .insert({
        name,
        code,
        type,
        address,
        city,
        state,
        postal_code,
        country,
        phone,
        email,
        manager_name,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
