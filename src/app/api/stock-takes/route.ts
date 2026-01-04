import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const stockTakeId = searchParams.get('stock_take_id');

    let query = supabase
      .from('stock_takes')
      .select(
        `
        *,
        inventory_locations (id, name, type),
        user_profiles!stock_takes_counted_by_fkey (full_name)
      `
      )
      .order('stock_take_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (stockTakeId) {
      query = query.eq('id', stockTakeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching stock takes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      reference_number,
      stock_take_date,
      location_id,
      type,
      notes,
      lines,
    } = body;

    // Validate required fields
    if (!reference_number || !stock_take_date || !location_id || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create stock take
    const { data: stockTake, error: stockTakeError } = await supabase
      .from('stock_takes')
      .insert({
        reference_number,
        stock_take_date,
        location_id,
        type,
        status: 'draft',
        counted_by: user.id,
        notes: notes || null,
      })
      .select()
      .single();

    if (stockTakeError) throw stockTakeError;

    // Create lines if provided
    if (lines && lines.length > 0) {
      const linesData = lines.map((line: any) => ({
        stock_take_id: stockTake.id,
        product_id: line.product_id,
        expected_quantity: line.expected_quantity,
        counted_quantity: line.counted_quantity,
        variance: line.counted_quantity - line.expected_quantity,
        notes: line.notes || null,
      }));

      const { error: linesError } = await supabase
        .from('stock_take_lines')
        .insert(linesData);

      if (linesError) throw linesError;
    }

    return NextResponse.json(stockTake, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock take:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
