import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await sql`
      SELECT pc.*, CASE WHEN pc.parent_id IS NOT NULL THEN json_build_object('id', p.id, 'name', p.name) END AS parent
      FROM product_categories pc
      LEFT JOIN product_categories p ON p.id = pc.parent_id
      ORDER BY pc.name`;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching product categories:', error);
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
    const { name, description, parent_id } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const rows = await sql`
      INSERT INTO product_categories (name, description, parent_id)
      VALUES (${name}, ${description || null}, ${parent_id || null})
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating product category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
