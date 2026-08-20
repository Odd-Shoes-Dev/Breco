import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await sql`SELECT * FROM asset_categories ORDER BY name`;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching asset categories:', error);
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
    const { name, description, default_depreciation_method, useful_life_years, default_useful_life_months } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Support both useful_life_years (converted to months) and default_useful_life_months directly
    const lifeMonths = default_useful_life_months || (useful_life_years ? useful_life_years * 12 : null);

    const rows = await sql`
      INSERT INTO asset_categories (name, description, default_depreciation_method, default_useful_life_months)
      VALUES (
        ${name},
        ${description || null},
        ${default_depreciation_method || null},
        ${lifeMonths}
      )
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating asset category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/asset-categories - Update category (id in body)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, default_depreciation_method, default_useful_life_months } = body;

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 });
    }

    const rows = await sql`
      UPDATE asset_categories SET
        name = COALESCE(${name ?? null}, name),
        description = CASE WHEN ${description !== undefined} THEN ${description ?? null} ELSE description END,
        default_depreciation_method = COALESCE(${default_depreciation_method ?? null}, default_depreciation_method),
        default_useful_life_months = COALESCE(${default_useful_life_months ?? null}, default_useful_life_months)
      WHERE id = ${id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: any) {
    console.error('Error updating asset category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/asset-categories?id=... - Delete category
export async function DELETE(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Category id is required' }, { status: 400 });
    }

    // Detach assets using this category, then delete
    await sql`UPDATE fixed_assets SET category_id = NULL WHERE category_id = ${id}`;
    await sql`DELETE FROM asset_categories WHERE id = ${id}`;

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting asset category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
