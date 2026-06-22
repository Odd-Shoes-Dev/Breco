import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/inventory - List inventory items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const lowStock = searchParams.get('low_stock');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // When filtering for low stock we need all rows first, then filter in JS
    if (lowStock === 'true') {
      let allRows: any[];
      if (search && category) {
        const q = `%${search}%`;
        allRows = await sql`
          SELECT p.*, COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand FROM products p
          WHERE (name ILIKE ${q} OR sku ILIKE ${q} OR description ILIKE ${q})
            AND category_id = ${category}
          ORDER BY name
        `;
      } else if (search) {
        const q = `%${search}%`;
        allRows = await sql`
          SELECT p.*, COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand FROM products p
          WHERE name ILIKE ${q} OR sku ILIKE ${q} OR description ILIKE ${q}
          ORDER BY name
        `;
      } else if (category) {
        allRows = await sql`SELECT p.*, COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand FROM products p WHERE category_id = ${category} ORDER BY name`;
      } else {
        allRows = await sql`SELECT p.*, COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand FROM products p ORDER BY name`;
      }

      const filtered = allRows.filter(
        (item: any) => (item?.quantity_on_hand ?? 0) <= (item?.reorder_point ?? 0)
      );
      const paged = filtered.slice(offset, offset + limit);

      return NextResponse.json({
        data: paged,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      });
    }

    let rows: any[];
    let countRows: any[];

    if (search && category) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT p.*, COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand FROM products p
        WHERE (name ILIKE ${q} OR sku ILIKE ${q} OR description ILIKE ${q})
          AND category_id = ${category}
        ORDER BY name
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) FROM products
        WHERE (name ILIKE ${q} OR sku ILIKE ${q} OR description ILIKE ${q})
          AND category_id = ${category}
      `;
    } else if (search) {
      const q = `%${search}%`;
      rows = await sql`
        SELECT p.*, COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand FROM products p
        WHERE name ILIKE ${q} OR sku ILIKE ${q} OR description ILIKE ${q}
        ORDER BY name
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) FROM products
        WHERE name ILIKE ${q} OR sku ILIKE ${q} OR description ILIKE ${q}
      `;
    } else if (category) {
      rows = await sql`
        SELECT p.*, COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand FROM products p WHERE category_id = ${category} ORDER BY name LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) FROM products WHERE category_id = ${category}`;
    } else {
      rows = await sql`SELECT p.*, COALESCE((SELECT SUM(im.quantity) FROM inventory_movements im WHERE im.product_id = p.id), 0) AS quantity_on_hand FROM products p ORDER BY name LIMIT ${limit} OFFSET ${offset}`;
      countRows = await sql`SELECT COUNT(*) FROM products`;
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

// POST /api/inventory - Create inventory item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.sku) {
      return NextResponse.json(
        { error: 'Missing required fields: name, sku' },
        { status: 400 }
      );
    }

    // Check SKU uniqueness
    const existing = await sql`SELECT id FROM products WHERE sku = ${body.sku}`;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An item with this SKU already exists' },
        { status: 400 }
      );
    }

    // Get inventory asset account
    const inventoryAccountRows = await sql`SELECT id FROM accounts WHERE code = '1300'`;
    const inventoryAccountId = inventoryAccountRows[0]?.id || null;

    // Get COGS account
    const cogsAccountRows = await sql`SELECT id FROM accounts WHERE code = '5100'`;
    const cogsAccountId = cogsAccountRows[0]?.id || null;

    const rows = await sql`
      INSERT INTO products (
        sku, name, description, category_id, unit_of_measure,
        purchase_price, selling_price,
        reorder_point, inventory_account_id, expense_account_id,
        income_account_id, is_active, track_inventory, is_taxable
      ) VALUES (
        ${body.sku}, ${body.name}, ${body.description || null}, ${body.category_id || null},
        ${body.unit_of_measure || 'each'},
        ${body.unit_cost || 0}, ${body.unit_price || 0},
        ${body.reorder_point || 0},
        ${inventoryAccountId}, ${cogsAccountId}, NULL,
        ${body.is_active !== false}, ${body.track_inventory !== false},
        ${body.is_taxable !== false}
      )
      RETURNING *
    `;
    const data = rows[0];

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
