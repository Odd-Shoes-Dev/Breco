import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/purchase-orders/[id]/approve - Approve purchase order
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get PO
    const rows = await sql`
      SELECT po.*, json_build_object('name', v.name) AS vendor
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      WHERE po.id = ${id}
    `;
    const po = rows[0];

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (po.status !== 'draft' && po.status !== 'pending_approval') {
      return NextResponse.json(
        { error: 'Only draft or pending approval POs can be approved' },
        { status: 400 }
      );
    }

    // Approve PO
    await sql`
      UPDATE purchase_orders
      SET status = 'approved',
          approved_by = ${user.id},
          approved_at = ${new Date().toISOString()}
      WHERE id = ${id}
    `;

    const updatedRows = await sql`
      SELECT po.*,
        json_build_object('id', v.id, 'name', v.name, 'email', v.email) AS vendor,
        COALESCE(json_agg(row_to_json(pol.*)) FILTER (WHERE pol.id IS NOT NULL), '[]') AS purchase_order_lines
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN purchase_order_lines pol ON pol.po_id = po.id
      WHERE po.id = ${id}
      GROUP BY po.id, v.id, v.name, v.email
    `;

    return NextResponse.json({
      message: 'Purchase order approved successfully',
      purchase_order: updatedRows[0],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
