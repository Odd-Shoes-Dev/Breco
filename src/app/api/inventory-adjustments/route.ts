import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');
    const reason = searchParams.get('reason');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let rows: any[];

    if (productId && reason && startDate && endDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.product_id = ${productId} AND ia.reason = ${reason}
          AND ia.adjustment_date >= ${startDate} AND ia.adjustment_date <= ${endDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (productId && reason && startDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.product_id = ${productId} AND ia.reason = ${reason}
          AND ia.adjustment_date >= ${startDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (productId && reason && endDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.product_id = ${productId} AND ia.reason = ${reason}
          AND ia.adjustment_date <= ${endDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (productId && startDate && endDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.product_id = ${productId}
          AND ia.adjustment_date >= ${startDate} AND ia.adjustment_date <= ${endDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (reason && startDate && endDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.reason = ${reason}
          AND ia.adjustment_date >= ${startDate} AND ia.adjustment_date <= ${endDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (productId && reason) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.product_id = ${productId} AND ia.reason = ${reason}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (productId && startDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.product_id = ${productId} AND ia.adjustment_date >= ${startDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (productId && endDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.product_id = ${productId} AND ia.adjustment_date <= ${endDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (productId) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.product_id = ${productId}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (reason) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.reason = ${reason}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (startDate && endDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.adjustment_date >= ${startDate} AND ia.adjustment_date <= ${endDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (startDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.adjustment_date >= ${startDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else if (endDate) {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        WHERE ia.adjustment_date <= ${endDate}
        ORDER BY ia.adjustment_date DESC
      `;
    } else {
      rows = await sql`
        SELECT ia.*, json_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'unit', p.unit) AS products
        FROM inventory_adjustments ia
        LEFT JOIN products p ON p.id = ia.product_id
        ORDER BY ia.adjustment_date DESC
      `;
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching inventory adjustments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      product_id,
      adjustment_date,
      quantity_change,
      reason,
      reference_type,
      reference_id,
      notes,
    } = body;

    // Validate required fields
    if (!product_id || !adjustment_date || quantity_change === undefined || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create adjustment
    const rows = await sql`
      INSERT INTO inventory_adjustments (
        product_id, adjustment_date, quantity_change, reason,
        reference_type, reference_id, notes
      ) VALUES (
        ${product_id}, ${adjustment_date}, ${quantity_change}, ${reason},
        ${reference_type || null}, ${reference_id || null}, ${notes || null}
      )
      RETURNING *
    `;
    const data = rows[0];

    // Update product stock
    const productRows = await sql`SELECT current_stock FROM products WHERE id = ${product_id}`;
    if (productRows.length === 0) throw new Error('Product not found');
    const currentStock = productRows[0].current_stock || 0;

    await sql`
      UPDATE products SET current_stock = ${currentStock + quantity_change} WHERE id = ${product_id}
    `;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating inventory adjustment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
