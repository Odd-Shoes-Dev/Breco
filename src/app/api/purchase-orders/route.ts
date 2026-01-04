import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/purchase-orders - List purchase orders
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const vendorId = searchParams.get('vendor_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        vendor:vendors(id, name, email, phone),
        purchase_order_lines(
          id,
          product_id,
          description,
          quantity,
          unit_price,
          line_total
        )
      `, { count: 'exact' })
      .order('po_date', { ascending: false });

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

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

// POST /api/purchase-orders - Create purchase order
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.vendor_id || !body.po_date || !body.lines || body.lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: vendor_id, po_date, lines' },
        { status: 400 }
      );
    }

    // Generate PO number
    const { data: latestPO } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    if (latestPO?.po_number) {
      const match = latestPO.po_number.match(/PO-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    const poNumber = `PO-${nextNumber.toString().padStart(6, '0')}`;

    // Calculate totals
    const lines = body.lines.map((line: any) => ({
      ...line,
      line_total: line.quantity * line.unit_price,
    }));

    const subtotal = lines.reduce((sum: number, line: any) => sum + line.line_total, 0);
    const taxAmount = subtotal * (body.tax_rate || 0);
    const total = subtotal + taxAmount;

    // Create purchase order
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        vendor_id: body.vendor_id,
        po_date: body.po_date,
        expected_delivery_date: body.expected_delivery_date,
        currency: body.currency || 'USD',
        exchange_rate: body.exchange_rate || 1.0,
        subtotal,
        tax_rate: body.tax_rate || 0,
        tax_amount: taxAmount,
        total,
        status: 'draft',
        notes: body.notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (poError) {
      return NextResponse.json({ error: poError.message }, { status: 400 });
    }

    // Create PO lines
    const poLines = lines.map((line: any) => ({
      purchase_order_id: po.id,
      product_id: line.product_id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      line_total: line.line_total,
    }));

    const { error: linesError } = await supabase
      .from('purchase_order_lines')
      .insert(poLines);

    if (linesError) {
      // Rollback - delete PO
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Fetch complete PO with lines
    const { data: completePO } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        vendor:vendors(id, name, email, phone),
        purchase_order_lines(*)
      `)
      .eq('id', po.id)
      .single();

    return NextResponse.json(completePO, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
