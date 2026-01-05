import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { status, inspection_notes } = await request.json();
    const { id } = await params;

    const { data: gr, error: grError } = await supabase
      .from('goods_receipts')
      .select('*')
      .eq('id', id)
      .single();

    if (grError || !gr) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }

    // Update goods receipt status
    const { error: updateError } = await supabase
      .from('goods_receipts')
      .update({
        status,
        inspection_notes,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // If accepted, update inventory
    if (status === 'accepted') {
      const { data: grLines, error: linesError } = await supabase
        .from('goods_receipt_lines')
        .select('*')
        .eq('goods_receipt_id', id);

      if (linesError) throw linesError;

      for (const line of grLines || []) {
        if (line.product_id) {
          // Get current quantity
          const { data: product } = await supabase
            .from('products')
            .select('quantity_in_stock')
            .eq('id', line.product_id)
            .single();

          const newQuantity = (product?.quantity_in_stock || 0) + line.quantity_received;

          // Update product quantity
          await supabase
            .from('products')
            .update({ quantity_in_stock: newQuantity })
            .eq('id', line.product_id);

          // Record inventory movement
          await supabase.from('inventory_movements').insert({
            product_id: line.product_id,
            company_id: gr.company_id,
            movement_type: 'purchase',
            quantity: line.quantity_received,
            unit_cost: line.unit_cost,
            reference_type: 'goods_receipt',
            reference_id: id,
            movement_date: gr.received_date,
            notes: `Goods Receipt ${gr.gr_number}`,
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating goods receipt status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
