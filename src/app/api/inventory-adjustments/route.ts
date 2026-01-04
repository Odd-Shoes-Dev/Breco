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
    const productId = searchParams.get('product_id');
    const reason = searchParams.get('reason');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabase
      .from('inventory_adjustments')
      .select(
        `
        *,
        products (id, name, sku, unit)
      `
      )
      .order('adjustment_date', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (reason) {
      query = query.eq('reason', reason);
    }

    if (startDate) {
      query = query.gte('adjustment_date', startDate);
    }

    if (endDate) {
      query = query.lte('adjustment_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching inventory adjustments:', error);
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
      product_id,
      adjustment_date,
      quantity_change,
      reason,
      reference_type,
      reference_id,
      notes,
    } = body;

    // Validate required fields
    if (!product_id || !adjustment_date || quantity_change === undefined || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create adjustment
    const { data, error } = await supabase
      .from('inventory_adjustments')
      .insert({
        product_id,
        adjustment_date,
        quantity_change,
        reason,
        reference_type: reference_type || null,
        reference_id: reference_id || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Update product stock
    const { data: currentProduct, error: getError } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', product_id)
      .single();

    if (getError) throw getError;

    const { error: stockError } = await supabase
      .from('products')
      .update({ current_stock: (currentProduct.current_stock || 0) + quantity_change })
      .eq('id', product_id);

    if (stockError) throw stockError;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating inventory adjustment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
