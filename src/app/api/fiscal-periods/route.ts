import { sql } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const level = searchParams.get('level');

    let conditions = ['1=1'];
    if (status) conditions.push(`status = '${status}'`);
    if (level) conditions.push(`level = '${level}'`);

    const rows = await sql`
      SELECT * FROM fiscal_periods
      WHERE ${sql.unsafe(conditions.join(' AND '))}
      ORDER BY start_date DESC
    `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('Failed to load fiscal periods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
