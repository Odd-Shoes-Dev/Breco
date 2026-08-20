import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

// POST /api/payroll/periods/[id]/generate - Generate payslips for all employees
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: periodId } = await params;

    // Check period exists and is draft
    const periodRows = await sql`SELECT * FROM payroll_periods WHERE id = ${periodId}`;
    const period = periodRows[0];

    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    if (period.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only generate payslips for draft periods' },
        { status: 400 }
      );
    }

    // Delete existing payslips if any
    await sql`DELETE FROM payslips WHERE payroll_period_id = ${periodId}`;

    // Get all active employees
    const employees = await sql`
      SELECT e.*,
        COALESCE((
          SELECT SUM(ea.amount) FROM employee_allowances ea
          WHERE ea.employee_id = e.id AND ea.is_active = true
        ), 0) AS total_allowances,
        COALESCE((
          SELECT SUM(ed.amount) FROM employee_deductions ed
          WHERE ed.employee_id = e.id AND ed.is_active = true
        ), 0) AS total_other_deductions
      FROM employees e
      WHERE e.is_active = true
    `;

    if (!employees || employees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees found' },
        { status: 400 }
      );
    }

    // Calculate number of days in the period
    const start = new Date(period.start_date);
    const end = new Date(period.end_date);
    const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysInMonth = 30; // Standard month for calculation

    // Generate and insert payslips for each employee
    const insertedPayslips: any[] = [];

    for (const employee of employees) {
      const monthlySalary = Number(employee.basic_salary) || 0;

      const basicSalary = (monthlySalary * daysInPeriod) / daysInMonth;

      const totalAllowances = (Number(employee.total_allowances) || 0) * daysInPeriod / daysInMonth;

      const grossSalary = basicSalary + totalAllowances;

      const taxRate = 0.15;
      const taxDeduction = grossSalary * taxRate;
      const nhifDeduction = grossSalary * 0.025;
      const nssfDeduction = Math.min(grossSalary * 0.06, 500);
      const loanDeduction = 0;
      const advanceDeduction = 0;
      const otherDeductions = (Number(employee.total_other_deductions) || 0) + nhifDeduction;

      const totalDeductions = taxDeduction + otherDeductions + nssfDeduction + loanDeduction + advanceDeduction;
      const netSalary = grossSalary - totalDeductions;

      const payslipNumRows = await sql`SELECT 'PS-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || substring(md5(random()::text), 1, 6) AS num`;
      const payslipNumber = payslipNumRows[0].num;

      const rows = await sql`
        INSERT INTO payslips (
          payslip_number, payroll_period_id, employee_id, basic_salary, total_allowances,
          gross_salary, paye, nssf_employee, loan_deduction, salary_advance,
          other_deductions, total_deductions, net_salary
        ) VALUES (
          ${payslipNumber}, ${periodId}, ${employee.id}, ${basicSalary}, ${totalAllowances},
          ${grossSalary}, ${taxDeduction}, ${nssfDeduction},
          ${loanDeduction}, ${advanceDeduction},
          ${otherDeductions}, ${totalDeductions}, ${netSalary}
        )
        RETURNING *
      `;
      insertedPayslips.push(rows[0]);
    }

    // Update period totals
    const totalGross = insertedPayslips.reduce((sum, p) => sum + (p.gross_salary || 0), 0);
    const totalDeductions = insertedPayslips.reduce((sum, p) => sum + (p.total_deductions || 0), 0);
    const totalNet = insertedPayslips.reduce((sum, p) => sum + (p.net_salary || 0), 0);

    await sql`
      UPDATE payroll_periods
      SET total_gross = ${totalGross},
          total_deductions = ${totalDeductions},
          total_net = ${totalNet}
      WHERE id = ${periodId}
    `;

    return NextResponse.json({
      message: 'Payslips generated successfully',
      count: insertedPayslips.length,
      payslips: insertedPayslips,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
