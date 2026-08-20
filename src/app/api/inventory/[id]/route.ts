import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/inventory/[id] - Get a single inventory item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql`
      SELECT p.*,
        COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand,
        row_to_json(pc.*) AS product_category,
        json_build_object('id', ia.id, 'name', ia.name, 'code', ia.code) AS income_account,
        json_build_object('id', ea.id, 'name', ea.name, 'code', ea.code) AS expense_account,
        json_build_object('id', inva.id, 'name', inva.name, 'code', inva.code) AS inventory_account
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN accounts ia ON ia.id = p.income_account_id
      LEFT JOIN accounts ea ON ea.id = p.expense_account_id
      LEFT JOIN accounts inva ON inva.id = p.inventory_account_id
      WHERE p.id = ${id}
      LIMIT 1
    `;

    const item = rows[0];
    if (!item) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const quantityOnHand = Number(item.quantity_on_hand) || 0;
    const quantityReserved = Number(item.quantity_reserved) || 0;

    return NextResponse.json({
      ...item,
      cost_price: Number(item.purchase_price) || 0,
      unit_price: Number(item.selling_price) || 0,
      quantity_on_hand: quantityOnHand,
      quantity_reserved: quantityReserved,
      quantity_available: quantityOnHand - quantityReserved,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/inventory/[id] - Update an inventory item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existingRows = await sql`SELECT id FROM products WHERE id = ${id}`;
    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (body.sku) {
      const dup = await sql`SELECT id FROM products WHERE sku = ${body.sku} AND id != ${id}`;
      if (dup.length > 0) {
        return NextResponse.json({ error: 'An item with this SKU already exists' }, { status: 400 });
      }
    }

    const rows = await sql`
      UPDATE products SET
        sku = COALESCE(${body.sku ?? null}, sku),
        name = COALESCE(${body.name ?? null}, name),
        description = ${body.description ?? null},
        category_id = ${body.category_id ?? null},
        unit_of_measure = COALESCE(${body.unit_of_measure ?? null}, unit_of_measure),
        purchase_price = COALESCE(${body.cost_price ?? body.purchase_price ?? null}, purchase_price),
        selling_price = COALESCE(${body.unit_price ?? body.selling_price ?? null}, selling_price),
        currency = COALESCE(${body.currency ?? null}, currency),
        reorder_point = COALESCE(${body.reorder_point ?? null}, reorder_point),
        reorder_quantity = COALESCE(${body.reorder_quantity ?? null}, reorder_quantity),
        quantity_reserved = COALESCE(${body.quantity_reserved ?? null}, quantity_reserved),
        is_taxable = COALESCE(${body.is_taxable ?? null}, is_taxable),
        is_active = COALESCE(${body.is_active ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // quantity_on_hand isn't a stored column — it's derived from inventory_movements.
    // If the caller changed it, record the delta as an adjustment movement.
    if (body.quantity_on_hand !== undefined && body.quantity_on_hand !== null) {
      const currentQtyRows = await sql`
        SELECT COALESCE(SUM(quantity), 0) AS qty FROM inventory_movements WHERE product_id = ${id}
      `;
      const currentQty = Number(currentQtyRows[0]?.qty) || 0;
      const targetQty = Number(body.quantity_on_hand) || 0;
      const delta = targetQty - currentQty;

      if (delta !== 0) {
        await sql`
          INSERT INTO inventory_movements (product_id, movement_type, quantity, unit_cost, notes)
          VALUES (${id}, 'adjustment', ${delta}, ${rows[0]?.purchase_price ?? 0}, 'Manual quantity edit')
        `;
      }
    }

    const finalQtyRows = await sql`
      SELECT COALESCE(SUM(quantity), 0) AS qty FROM inventory_movements WHERE product_id = ${id}
    `;
    const finalOnHand = Number(finalQtyRows[0]?.qty) || 0;
    const finalReserved = Number(rows[0]?.quantity_reserved) || 0;

    return NextResponse.json({
      ...rows[0],
      cost_price: Number(rows[0]?.purchase_price) || 0,
      unit_price: Number(rows[0]?.selling_price) || 0,
      quantity_on_hand: finalOnHand,
      quantity_reserved: finalReserved,
      quantity_available: finalOnHand - finalReserved,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/inventory/[id] - Delete an inventory item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingRows = await sql`SELECT id FROM products WHERE id = ${id}`;
    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const usedInLines = await sql`
      SELECT 1 FROM invoice_lines WHERE product_id = ${id}
      UNION ALL
      SELECT 1 FROM bill_lines WHERE product_id = ${id}
      LIMIT 1
    `;
    if (usedInLines.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a product referenced by existing invoices or bills. Deactivate it instead.' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM inventory_movements WHERE product_id = ${id}`;
    await sql`DELETE FROM products WHERE id = ${id}`;

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
