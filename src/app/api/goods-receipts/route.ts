import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/goods-receipts - List goods receipts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const purchase_order_id = searchParams.get('purchase_order_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let rows: any[];
    let countRows: any[];

    if (purchase_order_id && status) {
      rows = await sql`
        SELECT
          gr.*,
          po.id AS po_id, po.po_number,
          v.id AS vendor_id, v.name AS vendor_name,
          json_agg(
            json_build_object(
              'id', grl.id,
              'goods_receipt_id', grl.goods_receipt_id,
              'purchase_order_line_id', grl.purchase_order_line_id,
              'quantity_received', grl.quantity_received,
              'quantity_accepted', grl.quantity_accepted,
              'quantity_rejected', grl.quantity_rejected,
              'notes', grl.notes,
              'purchase_order_line', json_build_object(
                'id', pol.id,
                'description', pol.description,
                'ordered_quantity', pol.quantity,
                'unit_price', pol.unit_price
              )
            )
          ) FILTER (WHERE grl.id IS NOT NULL) AS goods_receipt_lines
        FROM goods_receipts gr
        LEFT JOIN purchase_orders po ON po.id = gr.po_id
        LEFT JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
        LEFT JOIN purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
        WHERE gr.po_id = ${purchase_order_id} AND gr.status = ${status}
        GROUP BY gr.id, po.id, po.po_number, v.id, v.name
        ORDER BY gr.receipt_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) FROM goods_receipts WHERE po_id = ${purchase_order_id} AND status = ${status}
      `;
    } else if (purchase_order_id) {
      rows = await sql`
        SELECT
          gr.*,
          po.id AS po_id, po.po_number,
          v.id AS vendor_id, v.name AS vendor_name,
          json_agg(
            json_build_object(
              'id', grl.id,
              'goods_receipt_id', grl.goods_receipt_id,
              'purchase_order_line_id', grl.purchase_order_line_id,
              'quantity_received', grl.quantity_received,
              'quantity_accepted', grl.quantity_accepted,
              'quantity_rejected', grl.quantity_rejected,
              'notes', grl.notes,
              'purchase_order_line', json_build_object(
                'id', pol.id,
                'description', pol.description,
                'ordered_quantity', pol.quantity,
                'unit_price', pol.unit_price
              )
            )
          ) FILTER (WHERE grl.id IS NOT NULL) AS goods_receipt_lines
        FROM goods_receipts gr
        LEFT JOIN purchase_orders po ON po.id = gr.po_id
        LEFT JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
        LEFT JOIN purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
        WHERE gr.po_id = ${purchase_order_id}
        GROUP BY gr.id, po.id, po.po_number, v.id, v.name
        ORDER BY gr.receipt_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) FROM goods_receipts WHERE po_id = ${purchase_order_id}
      `;
    } else if (status) {
      rows = await sql`
        SELECT
          gr.*,
          po.id AS po_id, po.po_number,
          v.id AS vendor_id, v.name AS vendor_name,
          json_agg(
            json_build_object(
              'id', grl.id,
              'goods_receipt_id', grl.goods_receipt_id,
              'purchase_order_line_id', grl.purchase_order_line_id,
              'quantity_received', grl.quantity_received,
              'quantity_accepted', grl.quantity_accepted,
              'quantity_rejected', grl.quantity_rejected,
              'notes', grl.notes,
              'purchase_order_line', json_build_object(
                'id', pol.id,
                'description', pol.description,
                'ordered_quantity', pol.quantity,
                'unit_price', pol.unit_price
              )
            )
          ) FILTER (WHERE grl.id IS NOT NULL) AS goods_receipt_lines
        FROM goods_receipts gr
        LEFT JOIN purchase_orders po ON po.id = gr.po_id
        LEFT JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
        LEFT JOIN purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
        WHERE gr.status = ${status}
        GROUP BY gr.id, po.id, po.po_number, v.id, v.name
        ORDER BY gr.receipt_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM goods_receipts WHERE status = ${status}`;
    } else {
      rows = await sql`
        SELECT
          gr.*,
          po.id AS po_id, po.po_number,
          v.id AS vendor_id, v.name AS vendor_name,
          json_agg(
            json_build_object(
              'id', grl.id,
              'goods_receipt_id', grl.goods_receipt_id,
              'purchase_order_line_id', grl.purchase_order_line_id,
              'quantity_received', grl.quantity_received,
              'quantity_accepted', grl.quantity_accepted,
              'quantity_rejected', grl.quantity_rejected,
              'notes', grl.notes,
              'purchase_order_line', json_build_object(
                'id', pol.id,
                'description', pol.description,
                'ordered_quantity', pol.quantity,
                'unit_price', pol.unit_price
              )
            )
          ) FILTER (WHERE grl.id IS NOT NULL) AS goods_receipt_lines
        FROM goods_receipts gr
        LEFT JOIN purchase_orders po ON po.id = gr.po_id
        LEFT JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
        LEFT JOIN purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
        GROUP BY gr.id, po.id, po.po_number, v.id, v.name
        ORDER BY gr.receipt_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM goods_receipts`;
    }

    const count = parseInt(countRows[0].count);

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/goods-receipts - Create goods receipt from PO
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const user = await getSession();
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
    const pos = await sql`SELECT * FROM purchase_orders WHERE id = ${body.purchase_order_id}`;
    if (pos.length === 0) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }
    const po = pos[0];

    const poLines = await sql`SELECT * FROM purchase_order_lines WHERE purchase_order_id = ${body.purchase_order_id}`;
    po.purchase_order_lines = poLines;

    if (po.status !== 'approved') {
      return NextResponse.json(
        { error: 'Can only receive goods from approved purchase orders' },
        { status: 400 }
      );
    }

    // Generate GR number
    const lastGRRows = await sql`
      SELECT gr_number FROM goods_receipts ORDER BY created_at DESC LIMIT 1
    `;
    let nextNumber = 1;
    if (lastGRRows.length > 0 && lastGRRows[0].gr_number) {
      const match = lastGRRows[0].gr_number.match(/GR-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const gr_number = `GR-${String(nextNumber).padStart(6, '0')}`;

    // Create goods receipt
    const receiptRows = await sql`
      INSERT INTO goods_receipts (gr_number, po_id, receipt_date, status, notes, created_by)
      VALUES (${gr_number}, ${body.purchase_order_id}, ${body.receipt_date}, ${body.status || 'received'}, ${body.notes || null}, ${user.id})
      RETURNING *
    `;
    const receipt = receiptRows[0];

    // Create goods receipt lines
    for (const line of body.lines) {
      await sql`
        INSERT INTO goods_receipt_lines (
          goods_receipt_id, purchase_order_line_id, quantity_received,
          quantity_accepted, quantity_rejected, notes
        ) VALUES (
          ${receipt.id}, ${line.purchase_order_line_id}, ${line.quantity_received},
          ${line.quantity_accepted}, ${line.quantity_rejected || 0}, ${line.notes || null}
        )
      `;
    }

    // Update PO status to received if fully received
    const allLinesReceived = body.lines.every((line: any) => {
      const poLine = po.purchase_order_lines.find((pol: any) => pol.id === line.purchase_order_line_id);
      return poLine && line.quantity_received >= poLine.quantity;
    });

    if (allLinesReceived) {
      await sql`
        UPDATE purchase_orders
        SET status = 'received', received_date = ${body.receipt_date}, received_by = ${user.id}
        WHERE id = ${body.purchase_order_id}
      `;
    }

    // Fetch complete receipt
    const completeRows = await sql`
      SELECT
        gr.*,
        po.id AS po_id, po.po_number,
        v.id AS vendor_id, v.name AS vendor_name,
        json_agg(
          json_build_object(
            'id', grl.id,
            'goods_receipt_id', grl.goods_receipt_id,
            'purchase_order_line_id', grl.purchase_order_line_id,
            'quantity_received', grl.quantity_received,
            'quantity_accepted', grl.quantity_accepted,
            'quantity_rejected', grl.quantity_rejected,
            'notes', grl.notes,
            'purchase_order_line', row_to_json(pol.*)
          )
        ) FILTER (WHERE grl.id IS NOT NULL) AS goods_receipt_lines
      FROM goods_receipts gr
      LEFT JOIN purchase_orders po ON po.id = gr.po_id
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
      LEFT JOIN purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
      WHERE gr.id = ${receipt.id}
      GROUP BY gr.id, po.id, po.po_number, v.id, v.name
    `;

    return NextResponse.json(completeRows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
