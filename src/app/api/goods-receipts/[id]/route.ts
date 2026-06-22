import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/goods-receipts/[id] - Get goods receipt details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const rows = await sql`
      SELECT
        gr.*,
        json_build_object('id', po.id, 'po_number', po.po_number,
          'vendor', json_build_object('id', v.id, 'name', v.name, 'email', v.email)
        ) AS purchase_order,
        json_build_object('id', up.id, 'full_name', up.full_name) AS received_by_user,
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
              'id', pol.id, 'description', pol.description,
              'quantity', pol.quantity, 'unit_price', pol.unit_price, 'unit', pol.unit
            )
          )
        ) FILTER (WHERE grl.id IS NOT NULL) AS goods_receipt_lines
      FROM goods_receipts gr
      LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
      LEFT JOIN purchase_order_lines pol ON pol.id = grl.purchase_order_line_id
      LEFT JOIN users up ON up.id = gr.received_by
      WHERE gr.id = ${id}
      GROUP BY gr.id, po.id, po.po_number, v.id, v.name, v.email, up.id, up.full_name
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
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
    const { id } = await context.params;
    const body = await request.json();

    const existing = await sql`SELECT status FROM goods_receipts WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Goods receipt not found' }, { status: 404 });
    }

    const rows = await sql`
      UPDATE goods_receipts
      SET status = ${body.status}, notes = ${body.notes ?? null}
      WHERE id = ${id}
      RETURNING *
    `;

    const gr = rows[0];

    const poRows = await sql`SELECT id, po_number FROM purchase_orders WHERE id = ${gr.purchase_order_id}`;
    const data = { ...gr, purchase_order: poRows[0] || null };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
