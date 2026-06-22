import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/payroll/periods/[id] - Get period details with payslips
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const rows = await sql`
      SELECT pp.*,
        json_build_object('id', cu.id, 'full_name', cu.full_name, 'email', cu.email) AS created_by_user,
        json_build_object('id', pu.id, 'full_name', pu.full_name, 'email', pu.email) AS processed_by_user,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ps.id,
              'employee_id', ps.employee_id,
              'basic_salary', ps.basic_salary,
              'gross_salary', ps.gross_salary,
              'net_salary', ps.net_salary,
              'status', ps.status,
              'employee', json_build_object(
                'id', e.id,
                'first_name', e.first_name,
                'last_name', e.last_name,
                'employee_id', e.employee_id
              )
            )
          ) FILTER (WHERE ps.id IS NOT NULL),
          '[]'
        ) AS payslips
      FROM payroll_periods pp
      LEFT JOIN users cu ON cu.id = pp.created_by
      LEFT JOIN users pu ON pu.id = pp.processed_by
      LEFT JOIN payroll_payslips ps ON ps.payroll_period_id = pp.id
      LEFT JOIN employees e ON e.id = ps.employee_id
      WHERE pp.id = ${id}
      GROUP BY pp.id, cu.id, cu.full_name, cu.email, pu.id, pu.full_name, pu.email
    `;

    const period = rows[0];
    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    return NextResponse.json(period);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/payroll/periods/[id] - Delete draft period
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check period exists and is draft
    const rows = await sql`SELECT status FROM payroll_periods WHERE id = ${id}`;
    const period = rows[0];

    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    if (period.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only delete draft payroll periods' },
        { status: 400 }
      );
    }

    // Delete the period (cascade will delete payslips)
    await sql`DELETE FROM payroll_periods WHERE id = ${id}`;

    return NextResponse.json({ message: 'Payroll period deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
