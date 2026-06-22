import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/purchase-orders/[id] - Get PO details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const rows = await sql`
      SELECT po.*,
        json_build_object(
          'id', v.id, 'name', v.name, 'email', v.email, 'phone', v.phone,
          'address', v.address, 'city', v.city, 'country', v.country
        ) AS vendor,
        COALESCE(json_agg(DISTINCT row_to_json(pol.*)) FILTER (WHERE pol.id IS NOT NULL), '[]') AS purchase_order_lines,
        COALESCE(json_agg(DISTINCT row_to_json(gr.*)) FILTER (WHERE gr.id IS NOT NULL), '[]') AS goods_receipts
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
      LEFT JOIN goods_receipts gr ON gr.po_id = po.id
      WHERE po.id = ${id}
      GROUP BY po.id, v.id, v.name, v.email, v.phone, v.address, v.city, v.country
    `;

    const data = rows[0];
    if (!data) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
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
    const { id } = await context.params;
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if PO exists and is editable
    const existingRows = await sql`SELECT status FROM purchase_orders WHERE id = ${id}`;
    const existing = existingRows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (existing.status === 'received' || existing.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot edit received or closed purchase orders' },
        { status: 400 }
      );
    }

    // Apply updates for known fields
    for (const [field, value] of Object.entries(body)) {
      if (field === 'status') await sql`UPDATE purchase_orders SET status = ${value} WHERE id = ${id}`;
      else if (field === 'vendor_id') await sql`UPDATE purchase_orders SET vendor_id = ${value} WHERE id = ${id}`;
      else if (field === 'po_date') await sql`UPDATE purchase_orders SET po_date = ${value} WHERE id = ${id}`;
      else if (field === 'expected_delivery_date') await sql`UPDATE purchase_orders SET expected_delivery_date = ${value} WHERE id = ${id}`;
      else if (field === 'currency') await sql`UPDATE purchase_orders SET currency = ${value} WHERE id = ${id}`;
      else if (field === 'notes') await sql`UPDATE purchase_orders SET notes = ${value} WHERE id = ${id}`;
      else if (field === 'tax_rate') await sql`UPDATE purchase_orders SET tax_rate = ${value} WHERE id = ${id}`;
      else if (field === 'subtotal') await sql`UPDATE purchase_orders SET subtotal = ${value} WHERE id = ${id}`;
      else if (field === 'tax_amount') await sql`UPDATE purchase_orders SET tax_amount = ${value} WHERE id = ${id}`;
      else if (field === 'total') await sql`UPDATE purchase_orders SET total = ${value} WHERE id = ${id}`;
    }

    const rows = await sql`
      SELECT po.*,
        json_build_object('id', v.id, 'name', v.name, 'email', v.email) AS vendor,
        COALESCE(json_agg(row_to_json(pol.*)) FILTER (WHERE pol.id IS NOT NULL), '[]') AS purchase_order_lines
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
      WHERE po.id = ${id}
      GROUP BY po.id, v.id, v.name, v.email
    `;

    return NextResponse.json(rows[0]);
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
    const { id } = await context.params;

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if PO can be cancelled
    const rows = await sql`SELECT status FROM purchase_orders WHERE id = ${id}`;
    const po = rows[0];

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
    await sql`UPDATE purchase_orders SET status = 'cancelled' WHERE id = ${id}`;

    return NextResponse.json({ message: 'Purchase order cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
