import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const categoryId = searchParams.get('category_id');

    let rows;
    if (active === 'true' && categoryId) {
      rows = await sql`
        SELECT p.*, p.selling_price AS unit_price, p.purchase_price AS cost_price, pc.name AS category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.is_active = true AND p.category_id = ${categoryId}
        ORDER BY p.name ASC
      `;
    } else if (active === 'true') {
      rows = await sql`
        SELECT p.*, p.selling_price AS unit_price, p.purchase_price AS cost_price, pc.name AS category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.is_active = true
        ORDER BY p.name ASC
      `;
    } else if (active === 'false' && categoryId) {
      rows = await sql`
        SELECT p.*, p.selling_price AS unit_price, p.purchase_price AS cost_price, pc.name AS category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.is_active = false AND p.category_id = ${categoryId}
        ORDER BY p.name ASC
      `;
    } else if (active === 'false') {
      rows = await sql`
        SELECT p.*, p.selling_price AS unit_price, p.purchase_price AS cost_price, pc.name AS category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.is_active = false
        ORDER BY p.name ASC
      `;
    } else if (categoryId) {
      rows = await sql`
        SELECT p.*, p.selling_price AS unit_price, p.purchase_price AS cost_price, pc.name AS category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.category_id = ${categoryId}
        ORDER BY p.name ASC
      `;
    } else {
      rows = await sql`
        SELECT p.*, p.selling_price AS unit_price, p.purchase_price AS cost_price, pc.name AS category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        ORDER BY p.name ASC
      `;
    }

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('Failed to load products:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
