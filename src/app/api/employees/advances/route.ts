import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let conditions = ['1=1'];
    if (status) conditions.push(`sa.status = '${status}'`);

    const rows = await sql`
      SELECT sa.*,
        json_build_object(
          'first_name', e.first_name,
          'last_name', e.last_name,
          'employee_number', e.employee_number
        ) AS employee,
        CASE WHEN sa.approved_by IS NOT NULL THEN
          json_build_object('full_name', u.full_name)
        ELSE NULL END AS approver
      FROM salary_advances sa
      LEFT JOIN employees e ON sa.employee_id = e.id
      LEFT JOIN users u ON sa.approved_by = u.id
      WHERE ${sql.unsafe(conditions.join(' AND '))}
      ORDER BY sa.created_at DESC
    `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('Failed to load salary advances:', error);
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
    const { employee_id, advance_date, amount, reason, repayment_months } = body;

    if (!employee_id || !amount) {
      return NextResponse.json({ error: 'employee_id and amount are required' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO salary_advances (employee_id, advance_date, amount, reason, repayment_months, status, created_by)
      VALUES (${employee_id}, ${advance_date || new Date().toISOString().split('T')[0]}, ${amount}, ${reason || null}, ${repayment_months || 1}, 'pending', ${user.id})
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create salary advance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
