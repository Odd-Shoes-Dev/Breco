import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const categoryId = searchParams.get('category_id');

    let conditions = ['1=1'];
    if (active === 'true') conditions.push('p.is_active = true');
    if (active === 'false') conditions.push('p.is_active = false');
    if (categoryId) conditions.push(`p.category_id = '${categoryId}'`);

    const rows = await sql`
      SELECT p.*, pc.name AS category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE ${sql.unsafe(conditions.join(' AND '))}
      ORDER BY p.name ASC
    `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('Failed to load products:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
