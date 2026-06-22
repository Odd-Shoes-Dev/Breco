import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/inventory/[id]/adjust - Adjust inventory quantity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.adjustment_type || body.quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: adjustment_type, quantity' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current product
    const itemRows = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (itemRows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    const item = itemRows[0];

    // Get current quantity from inventory_movements
    const qtyRows = await sql`
      SELECT COALESCE(SUM(quantity), 0) AS qty FROM inventory_movements WHERE product_id = ${id}
    `;
    const currentQuantity = parseFloat(qtyRows[0]?.qty || '0');

    // Calculate movement quantity
    let movementQuantity = body.quantity;

    switch (body.adjustment_type) {
      case 'add':
      case 'receive':
      case 'return':
        break;
      case 'remove':
      case 'sell':
      case 'damage':
      case 'shrinkage':
        if (body.quantity > currentQuantity) {
          return NextResponse.json(
            { error: 'Insufficient quantity on hand' },
            { status: 400 }
          );
        }
        movementQuantity = -body.quantity;
        break;
      case 'adjustment':
        movementQuantity = body.quantity - currentQuantity;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid adjustment type' },
          { status: 400 }
        );
    }

    // Create movement record
    const movementRows = await sql`
      INSERT INTO inventory_movements (
        product_id, movement_type, quantity, unit_cost, notes, created_by
      ) VALUES (
        ${id}, ${body.adjustment_type}, ${movementQuantity},
        ${body.unit_cost || item.purchase_price || null}, ${body.notes || null}, ${user.id}
      )
      RETURNING *
    `;
    const movement = movementRows[0];

    // Fetch updated product
    const updatedItemRows = await sql`
      SELECT * FROM products WHERE id = ${id}
    `;
    const updatedItem = updatedItemRows[0];

    return NextResponse.json({
      data: {
        item: updatedItem,
        movement,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/inventory/[id]/movements - Get movement history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      sql`
        SELECT * FROM inventory_movements
        WHERE product_id = ${id}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`SELECT COUNT(*) FROM inventory_movements WHERE product_id = ${id}`,
    ]);

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
