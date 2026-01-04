import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/goods-receipts/[id] - Get goods receipt details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('goods_receipts')
      .select(`
        *,
        purchase_order:purchase_orders(
          id,
          po_number,
          vendor:vendors(id, name, email)
        ),
        goods_receipt_lines(
          *,
          purchase_order_line:purchase_order_lines(
            id,
            description,
            quantity,
            unit_price,
            unit
          )
        ),
        received_by_user:user_profiles!goods_receipts_received_by_fkey(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/goods-receipts/[id] - Update goods receipt status
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;
    const body = await request.json();

    const { data: existing } = await supabase
      .from('goods_receipts')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('goods_receipts')
      .update({
        status: body.status,
        notes: body.notes,
      })
      .eq('id', id)
      .select(`
        *,
        purchase_order:purchase_orders(id, po_number)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
