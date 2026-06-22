import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/purchase-orders - List purchase orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const vendorId = searchParams.get('vendor_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let rows: any[];
    let countRows: any[];

    if (vendorId && status) {
      rows = await sql`
        SELECT po.*,
          json_build_object('id', v.id, 'name', v.name, 'email', v.email, 'phone', v.phone) AS vendor,
          COALESCE(json_agg(
            json_build_object(
              'id', pol.id, 'product_id', pol.product_id, 'description', pol.description,
              'quantity', pol.quantity, 'unit_price', pol.unit_price, 'line_total', pol.line_total
            )
          ) FILTER (WHERE pol.id IS NOT NULL), '[]') AS purchase_order_lines
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
        WHERE po.vendor_id = ${vendorId} AND po.status = ${status}
        GROUP BY po.id, v.id, v.name, v.email, v.phone
        ORDER BY po.po_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM purchase_orders WHERE vendor_id = ${vendorId} AND status = ${status}`;
    } else if (vendorId) {
      rows = await sql`
        SELECT po.*,
          json_build_object('id', v.id, 'name', v.name, 'email', v.email, 'phone', v.phone) AS vendor,
          COALESCE(json_agg(
            json_build_object(
              'id', pol.id, 'product_id', pol.product_id, 'description', pol.description,
              'quantity', pol.quantity, 'unit_price', pol.unit_price, 'line_total', pol.line_total
            )
          ) FILTER (WHERE pol.id IS NOT NULL), '[]') AS purchase_order_lines
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
        WHERE po.vendor_id = ${vendorId}
        GROUP BY po.id, v.id, v.name, v.email, v.phone
        ORDER BY po.po_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM purchase_orders WHERE vendor_id = ${vendorId}`;
    } else if (status) {
      rows = await sql`
        SELECT po.*,
          json_build_object('id', v.id, 'name', v.name, 'email', v.email, 'phone', v.phone) AS vendor,
          COALESCE(json_agg(
            json_build_object(
              'id', pol.id, 'product_id', pol.product_id, 'description', pol.description,
              'quantity', pol.quantity, 'unit_price', pol.unit_price, 'line_total', pol.line_total
            )
          ) FILTER (WHERE pol.id IS NOT NULL), '[]') AS purchase_order_lines
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
        WHERE po.status = ${status}
        GROUP BY po.id, v.id, v.name, v.email, v.phone
        ORDER BY po.po_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM purchase_orders WHERE status = ${status}`;
    } else {
      rows = await sql`
        SELECT po.*,
          json_build_object('id', v.id, 'name', v.name, 'email', v.email, 'phone', v.phone) AS vendor,
          COALESCE(json_agg(
            json_build_object(
              'id', pol.id, 'product_id', pol.product_id, 'description', pol.description,
              'quantity', pol.quantity, 'unit_price', pol.unit_price, 'line_total', pol.line_total
            )
          ) FILTER (WHERE pol.id IS NOT NULL), '[]') AS purchase_order_lines
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
        GROUP BY po.id, v.id, v.name, v.email, v.phone
        ORDER BY po.po_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM purchase_orders`;
    }

    const count = parseInt(countRows[0]?.count || '0');

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

// POST /api/purchase-orders - Create purchase order
export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.vendor_id || !body.po_date || !body.lines || body.lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: vendor_id, po_date, lines' },
        { status: 400 }
      );
    }

    // Generate PO number
    const latestRows = await sql`
      SELECT po_number FROM purchase_orders ORDER BY created_at DESC LIMIT 1
    `;
    const latestPO = latestRows[0];

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
    const poRows = await sql`
      INSERT INTO purchase_orders (
        po_number, vendor_id, po_date, expected_delivery_date, currency,
        exchange_rate, subtotal, tax_rate, tax_amount, total, status, notes, created_by
      ) VALUES (
        ${poNumber}, ${body.vendor_id}, ${body.po_date},
        ${body.expected_delivery_date ?? null},
        ${body.currency || 'USD'}, ${body.exchange_rate || 1.0},
        ${subtotal}, ${body.tax_rate || 0}, ${taxAmount}, ${total},
        'draft', ${body.notes ?? null}, ${user.id}
      )
      RETURNING *
    `;
    const po = poRows[0];

    if (!po) {
      return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 400 });
    }

    // Create PO lines
    try {
      for (const line of lines) {
        await sql`
          INSERT INTO purchase_order_lines (
            purchase_order_id, product_id, description, quantity, unit_price, line_total
          ) VALUES (
            ${po.id}, ${line.product_id ?? null}, ${line.description ?? null},
            ${line.quantity}, ${line.unit_price}, ${line.line_total}
          )
        `;
      }
    } catch (linesError: any) {
      // Rollback - delete PO
      await sql`DELETE FROM purchase_orders WHERE id = ${po.id}`;
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Fetch complete PO with lines
    const completeRows = await sql`
      SELECT po.*,
        json_build_object('id', v.id, 'name', v.name, 'email', v.email, 'phone', v.phone) AS vendor,
        COALESCE(json_agg(row_to_json(pol.*)) FILTER (WHERE pol.id IS NOT NULL), '[]') AS purchase_order_lines
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN purchase_order_lines pol ON pol.purchase_order_id = po.id
      WHERE po.id = ${po.id}
      GROUP BY po.id, v.id, v.name, v.email, v.phone
    `;

    return NextResponse.json(completeRows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
