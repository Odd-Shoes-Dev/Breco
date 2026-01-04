import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/goods-receipts - List goods receipts
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const purchase_order_id = searchParams.get('purchase_order_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('goods_receipts')
      .select(`
        *,
        purchase_order:purchase_orders(
          id,
          po_number,
          vendor:vendors(id, name)
        ),
        goods_receipt_lines(
          *,
          purchase_order_line:purchase_order_lines(
            id,
            description,
            quantity as ordered_quantity,
            unit_price
          )
        )
      `, { count: 'exact' });

    if (purchase_order_id) query = query.eq('purchase_order_id', purchase_order_id);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query
      .order('receipt_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/goods-receipts - Create goods receipt from PO
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.purchase_order_id || !body.receipt_date || !body.lines || body.lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: purchase_order_id, receipt_date, lines' },
        { status: 400 }
      );
    }

    // Get PO details
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_lines(*)')
      .eq('id', body.purchase_order_id)
      .single();

    if (poError || !po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (po.status !== 'approved') {
      return NextResponse.json(
        { error: 'Can only receive goods from approved purchase orders' },
        { status: 400 }
      );
    }

    // Generate GR number
    const { data: lastGR } = await supabase
      .from('goods_receipts')
      .select('gr_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (lastGR?.gr_number) {
      const match = lastGR.gr_number.match(/GR-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const gr_number = `GR-${String(nextNumber).padStart(6, '0')}`;

    // Create goods receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('goods_receipts')
      .insert({
        gr_number,
        purchase_order_id: body.purchase_order_id,
        receipt_date: body.receipt_date,
        status: body.status || 'received',
        notes: body.notes,
        received_by: user.id,
      })
      .select()
      .single();

    if (receiptError) {
      return NextResponse.json({ error: receiptError.message }, { status: 400 });
    }

    // Create goods receipt lines
    const lines = body.lines.map((line: any) => ({
      goods_receipt_id: receipt.id,
      purchase_order_line_id: line.purchase_order_line_id,
      quantity_received: line.quantity_received,
      quantity_accepted: line.quantity_accepted,
      quantity_rejected: line.quantity_rejected || 0,
      notes: line.notes,
    }));

    const { error: linesError } = await supabase
      .from('goods_receipt_lines')
      .insert(lines);

    if (linesError) {
      // Rollback receipt creation
      await supabase.from('goods_receipts').delete().eq('id', receipt.id);
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Update PO status to received if fully received
    const allLinesReceived = body.lines.every((line: any) => {
      const poLine = po.purchase_order_lines.find((pol: any) => pol.id === line.purchase_order_line_id);
      return poLine && line.quantity_received >= poLine.quantity;
    });

    if (allLinesReceived) {
      await supabase
        .from('purchase_orders')
        .update({
          status: 'received',
          received_date: body.receipt_date,
          received_by: user.id,
        })
        .eq('id', body.purchase_order_id);
    }

    // Fetch complete receipt
    const { data: completeReceipt } = await supabase
      .from('goods_receipts')
      .select(`
        *,
        purchase_order:purchase_orders(
          id,
          po_number,
          vendor:vendors(id, name)
        ),
        goods_receipt_lines(
          *,
          purchase_order_line:purchase_order_lines(*)
        )
      `)
      .eq('id', receipt.id)
      .single();

    return NextResponse.json(completeReceipt, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
