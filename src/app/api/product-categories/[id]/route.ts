import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// PATCH /api/product-categories/[id] - Update a product category
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const rows = await sql`
      UPDATE product_categories SET
        name = COALESCE(${body.name ?? null}, name),
        description = CASE WHEN ${body.description !== undefined} THEN ${body.description ?? null} ELSE description END,
        parent_id = CASE WHEN ${body.parent_id !== undefined} THEN ${body.parent_id ?? null} ELSE parent_id END,
        is_active = COALESCE(${body.is_active ?? null}, is_active)
      WHERE id = ${id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('Error updating product category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/product-categories/[id] - Delete a product category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const products = await sql`SELECT id FROM products WHERE category_id = ${id} LIMIT 1`;
    if (products.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that has products. Reassign the products first.' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM product_categories WHERE id = ${id}`;

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
