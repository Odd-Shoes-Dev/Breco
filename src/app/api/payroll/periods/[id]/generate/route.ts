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
    await sql`DELETE FROM payroll_payslips WHERE payroll_period_id = ${periodId}`;

    // Get all active employees
    const employees = await sql`SELECT * FROM employees WHERE status = 'active'`;

    if (!employees || employees.length === 0) {
      return NextResponse.json(
        { error: 'No active employees found' },
        { status: 400 }
      );
    }

    // Calculate number of days in the period
    const start = new Date(period.period_start);
    const end = new Date(period.period_end);
    const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysInMonth = 30; // Standard month for calculation

    // Generate and insert payslips for each employee
    const insertedPayslips: any[] = [];

    for (const employee of employees) {
      const monthlySalary = employee.salary || 0;

      const basicSalary = (monthlySalary * daysInPeriod) / daysInMonth;

      const housingAllowance = employee.housing_allowance || 0;
      const transportAllowance = employee.transport_allowance || 0;
      const otherAllowances = employee.other_allowances || 0;

      const totalAllowances = (housingAllowance + transportAllowance + otherAllowances) * daysInPeriod / daysInMonth;

      const grossSalary = basicSalary + totalAllowances;

      const taxRate = 0.15;
      const taxDeduction = grossSalary * taxRate;
      const nhifDeduction = grossSalary * 0.025;
      const nssfDeduction = Math.min(grossSalary * 0.06, 500);
      const loanDeduction = employee.loan_deduction || 0;
      const advanceDeduction = employee.advance_deduction || 0;

      const totalDeductions = taxDeduction + nhifDeduction + nssfDeduction + loanDeduction + advanceDeduction;
      const netSalary = grossSalary - totalDeductions;

      const rows = await sql`
        INSERT INTO payroll_payslips (
          payroll_period_id, employee_id, basic_salary, allowances,
          housing_allowance, transport_allowance, other_allowances,
          gross_salary, deductions, tax_deduction, nhif_deduction,
          nssf_deduction, loan_deduction, advance_deduction, net_salary,
          days_worked, status, created_by
        ) VALUES (
          ${periodId}, ${employee.id}, ${basicSalary}, ${totalAllowances},
          ${(housingAllowance * daysInPeriod) / daysInMonth},
          ${(transportAllowance * daysInPeriod) / daysInMonth},
          ${(otherAllowances * daysInPeriod) / daysInMonth},
          ${grossSalary}, ${totalDeductions}, ${taxDeduction}, ${nhifDeduction},
          ${nssfDeduction}, ${loanDeduction}, ${advanceDeduction}, ${netSalary},
          ${daysInPeriod}, 'pending', ${user.id}
        )
        RETURNING *
      `;
      insertedPayslips.push(rows[0]);
    }

    // Update period totals
    const totalGross = insertedPayslips.reduce((sum, p) => sum + (p.gross_salary || 0), 0);
    const totalDeductions = insertedPayslips.reduce((sum, p) => sum + (p.deductions || 0), 0);
    const totalNet = insertedPayslips.reduce((sum, p) => sum + (p.net_salary || 0), 0);

    await sql`
      UPDATE payroll_periods
      SET total_gross = ${totalGross},
          total_deductions = ${totalDeductions},
          total_net = ${totalNet},
          employee_count = ${insertedPayslips.length}
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
