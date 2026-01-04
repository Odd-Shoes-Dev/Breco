import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/purchase-orders/[id]/approve - Approve purchase order
export async function POST(
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

    // Get PO
    const { data: po, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('*, vendor:vendors(name)')
      .eq('id', id)
      .single();

    if (fetchError || !po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (po.status !== 'draft' && po.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Only draft or pending approval POs can be approved' },
        { status: 400 }
      );
    }

    // Approve PO
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
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

    return NextResponse.json({
      message: 'Purchase order approved successfully',
      purchase_order: data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
