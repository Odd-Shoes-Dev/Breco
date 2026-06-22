import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/payroll/payslips/[id] - Get payslip details
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
      SELECT ps.*,
        json_build_object(
          'id', e.id,
          'employee_id', e.employee_id,
          'first_name', e.first_name,
          'last_name', e.last_name,
          'email', e.email,
          'department', e.department,
          'position', e.position
        ) AS employee,
        json_build_object(
          'id', pp.id,
          'period_start', pp.period_start,
          'period_end', pp.period_end,
          'payment_date', pp.payment_date,
          'status', pp.status
        ) AS period
      FROM payroll_payslips ps
      LEFT JOIN employees e ON e.id = ps.employee_id
      LEFT JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
      WHERE ps.id = ${id}
    `;

    const payslip = rows[0];
    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    return NextResponse.json(payslip);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/payroll/payslips/[id] - Update payslip (only if period is draft)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check payslip exists and period is draft
    const rows = await sql`
      SELECT ps.*, pp.status AS period_status
      FROM payroll_payslips ps
      LEFT JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
      WHERE ps.id = ${id}
    `;
    const payslip = rows[0];

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    if (payslip.period_status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only update payslips for draft periods' },
        { status: 400 }
      );
    }

    // Allow updating specific fields
    const allowedFields = [
      'basic_salary', 'allowances', 'housing_allowance', 'transport_allowance',
      'other_allowances', 'deductions', 'tax_deduction', 'nhif_deduction',
      'nssf_deduction', 'loan_deduction', 'advance_deduction', 'days_worked', 'notes',
    ];

    const updates: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Recalculate gross and net if components changed
    if (updates.basic_salary !== undefined || updates.allowances !== undefined) {
      const basicSalary = updates.basic_salary ?? payslip.basic_salary;
      const allowances = updates.allowances ?? payslip.allowances;
      updates.gross_salary = basicSalary + allowances;
    }

    if (updates.deductions !== undefined || updates.gross_salary !== undefined) {
      const grossSalary = updates.gross_salary ?? payslip.gross_salary;
      const deductions = updates.deductions ?? payslip.deductions;
      updates.net_salary = grossSalary - deductions;
    }

    // Apply updates for each field
    for (const [field, value] of Object.entries(updates)) {
      if (field === 'basic_salary') await sql`UPDATE payroll_payslips SET basic_salary = ${value} WHERE id = ${id}`;
      else if (field === 'allowances') await sql`UPDATE payroll_payslips SET allowances = ${value} WHERE id = ${id}`;
      else if (field === 'housing_allowance') await sql`UPDATE payroll_payslips SET housing_allowance = ${value} WHERE id = ${id}`;
      else if (field === 'transport_allowance') await sql`UPDATE payroll_payslips SET transport_allowance = ${value} WHERE id = ${id}`;
      else if (field === 'other_allowances') await sql`UPDATE payroll_payslips SET other_allowances = ${value} WHERE id = ${id}`;
      else if (field === 'gross_salary') await sql`UPDATE payroll_payslips SET gross_salary = ${value} WHERE id = ${id}`;
      else if (field === 'deductions') await sql`UPDATE payroll_payslips SET deductions = ${value} WHERE id = ${id}`;
      else if (field === 'tax_deduction') await sql`UPDATE payroll_payslips SET tax_deduction = ${value} WHERE id = ${id}`;
      else if (field === 'nhif_deduction') await sql`UPDATE payroll_payslips SET nhif_deduction = ${value} WHERE id = ${id}`;
      else if (field === 'nssf_deduction') await sql`UPDATE payroll_payslips SET nssf_deduction = ${value} WHERE id = ${id}`;
      else if (field === 'loan_deduction') await sql`UPDATE payroll_payslips SET loan_deduction = ${value} WHERE id = ${id}`;
      else if (field === 'advance_deduction') await sql`UPDATE payroll_payslips SET advance_deduction = ${value} WHERE id = ${id}`;
      else if (field === 'net_salary') await sql`UPDATE payroll_payslips SET net_salary = ${value} WHERE id = ${id}`;
      else if (field === 'days_worked') await sql`UPDATE payroll_payslips SET days_worked = ${value} WHERE id = ${id}`;
      else if (field === 'notes') await sql`UPDATE payroll_payslips SET notes = ${value} WHERE id = ${id}`;
    }

    const updatedRows = await sql`SELECT * FROM payroll_payslips WHERE id = ${id}`;
    return NextResponse.json(updatedRows[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/payroll/payslips/[id] - Delete payslip (only if period is draft)
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

    // Check payslip exists and period is draft
    const rows = await sql`
      SELECT ps.*, pp.status AS period_status
      FROM payroll_payslips ps
      LEFT JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
      WHERE ps.id = ${id}
    `;
    const payslip = rows[0];

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    if (payslip.period_status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only delete payslips for draft periods' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM payroll_payslips WHERE id = ${id}`;

    return NextResponse.json({ message: 'Payslip deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
