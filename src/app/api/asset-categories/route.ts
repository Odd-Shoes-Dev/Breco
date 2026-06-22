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
    const { name, description, depreciation_method, useful_life_years } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const rows = await sql`
      INSERT INTO asset_categories (name, description, depreciation_method, useful_life_years)
      VALUES (
        ${name},
        ${description || null},
        ${depreciation_method || null},
        ${useful_life_years || null}
      )
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating asset category:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
