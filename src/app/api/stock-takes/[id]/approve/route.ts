import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const stockTakeId = id;

    // Get stock take with lines
    const { data: stockTake, error: stockTakeError } = await supabase
      .from('stock_takes')
      .select(
        `
        *,
        stock_take_lines (
          id,
          product_id,
          variance
        )
      `
      )
      .eq('id', stockTakeId)
      .single();

    if (stockTakeError) throw stockTakeError;

    if (stockTake.status === 'completed') {
      return NextResponse.json(
        { error: 'Stock take already completed' },
        { status: 400 }
      );
    }

    // Update stock take status
    const { error: updateError } = await supabase
      .from('stock_takes')
      .update({
        status: 'completed',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', stockTakeId);

    if (updateError) throw updateError;

    // Apply inventory adjustments for each line with variance
    const lines = stockTake.stock_take_lines || [];
    for (const line of lines) {
      if (line.variance !== 0) {
        // Create adjustment record
        const { error: adjustError } = await supabase
          .from('inventory_adjustments')
          .insert({
            product_id: line.product_id,
            adjustment_date: new Date().toISOString(),
            quantity_change: line.variance,
            reason: 'stock_take',
            reference_type: 'stock_take',
            reference_id: stockTakeId,
            notes: `Stock take ${stockTake.reference_number}`,
          });

        if (adjustError) throw adjustError;

        // Update product stock using RPC function if it exists, otherwise direct update
        const { data: currentProduct, error: productError } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', line.product_id)
          .single();

        if (productError) throw productError;

        const { error: stockError } = await supabase
          .from('products')
          .update({ current_stock: (currentProduct.current_stock || 0) + line.variance })
          .eq('id', line.product_id);

        if (stockError) throw stockError;
      }
    }

    return NextResponse.json({
      message: 'Stock take approved and inventory updated',
      stockTakeId,
      adjustmentsApplied: lines.filter((l: any) => l.variance !== 0).length,
    });
  } catch (error: any) {
    console.error('Error approving stock take:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
