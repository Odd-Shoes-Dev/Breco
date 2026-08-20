import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let conditions = ['1=1'];
    if (status) conditions.push(`er.status = '${status}'`);

    const rows = await sql`
      SELECT er.*,
        json_build_object(
          'first_name', e.first_name,
          'last_name', e.last_name,
          'employee_number', e.employee_number
        ) AS employee,
        CASE WHEN er.approved_by IS NOT NULL THEN
          json_build_object('full_name', u.full_name)
        ELSE NULL END AS approver,
        CASE WHEN er.paid_in_payroll_id IS NOT NULL THEN
          json_build_object('period_name', pp.period_name)
        ELSE NULL END AS payroll_period
      FROM employee_reimbursements er
      LEFT JOIN employees e ON er.employee_id = e.id
      LEFT JOIN users u ON er.approved_by = u.id
      LEFT JOIN payroll_periods pp ON er.paid_in_payroll_id = pp.id
      WHERE ${sql.unsafe(conditions.join(' AND '))}
      ORDER BY er.created_at DESC
    `;

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('Failed to load reimbursements:', error);
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
    const { employee_id, reimbursement_date, expense_type, description, amount, receipt_url } = body;

    if (!employee_id || !expense_type || !amount) {
      return NextResponse.json({ error: 'employee_id, expense_type, and amount are required' }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO employee_reimbursements (employee_id, reimbursement_date, expense_type, description, amount, receipt_url, status, created_by)
      VALUES (${employee_id}, ${reimbursement_date || new Date().toISOString().split('T')[0]}, ${expense_type}, ${description || null}, ${amount}, ${receipt_url || null}, 'pending', ${user.id})
      RETURNING *
    `;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create reimbursement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
