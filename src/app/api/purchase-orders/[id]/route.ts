import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/purchase-orders/[id] - Get PO details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        vendor:vendors(id, name, email, phone, address_line1, city, country),
        purchase_order_lines(*),
        goods_receipts(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/purchase-orders/[id] - Update PO
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if PO exists and is editable
    const { data: existing } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (existing.status === 'received' || existing.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot edit received or closed purchase orders' },
        { status: 400 }
      );
    }

    // Update PO
    const { data, error } = await supabase
      .from('purchase_orders')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        vendor:vendors(id, name, email),
        purchase_order_lines(*)
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

// DELETE /api/purchase-orders/[id] - Cancel PO
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if PO can be cancelled
    const { data: po } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .single();

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (po.status === 'received' || po.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot cancel received or closed purchase orders. Mark as void instead.' },
        { status: 400 }
      );
    }

    // Update status to cancelled instead of deleting
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Purchase order cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
