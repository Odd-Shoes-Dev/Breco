import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/payroll/periods/[id]/generate - Generate payslips for all employees
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: periodId } = await params;

    // Check period exists and is draft
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', periodId)
      .single();

    if (periodError) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    if (period.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only generate payslips for draft periods' },
        { status: 400 }
      );
    }

    // Delete existing payslips if any
    await supabase
      .from('payroll_payslips')
      .delete()
      .eq('payroll_period_id', periodId);

    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('status', 'active');

    if (empError) {
      return NextResponse.json({ error: empError.message }, { status: 400 });
    }

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

    // Generate payslips for each employee
    const payslips = employees.map((employee: any) => {
      const monthlySalary = employee.salary || 0;
      
      // Calculate basic salary (prorated if partial period)
      const basicSalary = (monthlySalary * daysInPeriod) / daysInMonth;
      
      // Calculate allowances (example: housing, transport, etc.)
      const housingAllowance = employee.housing_allowance || 0;
      const transportAllowance = employee.transport_allowance || 0;
      const otherAllowances = employee.other_allowances || 0;
      
      const totalAllowances = (housingAllowance + transportAllowance + otherAllowances) * daysInPeriod / daysInMonth;
      
      // Calculate gross salary
      const grossSalary = basicSalary + totalAllowances;
      
      // Calculate deductions
      // Tax (simplified - should be based on tax brackets)
      const taxRate = 0.15; // 15% flat tax (example)
      const taxDeduction = grossSalary * taxRate;
      
      // NHIF (National Health Insurance Fund - example rates)
      const nhifDeduction = grossSalary * 0.025; // 2.5%
      
      // NSSF (National Social Security Fund - example rates)
      const nssfDeduction = Math.min(grossSalary * 0.06, 500); // 6% up to max
      
      // Other deductions
      const loanDeduction = employee.loan_deduction || 0;
      const advanceDeduction = employee.advance_deduction || 0;
      
      const totalDeductions = taxDeduction + nhifDeduction + nssfDeduction + loanDeduction + advanceDeduction;
      
      // Calculate net salary
      const netSalary = grossSalary - totalDeductions;
      
      return {
        payroll_period_id: periodId,
        employee_id: employee.id,
        basic_salary: basicSalary,
        allowances: totalAllowances,
        housing_allowance: (housingAllowance * daysInPeriod) / daysInMonth,
        transport_allowance: (transportAllowance * daysInPeriod) / daysInMonth,
        other_allowances: (otherAllowances * daysInPeriod) / daysInMonth,
        gross_salary: grossSalary,
        deductions: totalDeductions,
        tax_deduction: taxDeduction,
        nhif_deduction: nhifDeduction,
        nssf_deduction: nssfDeduction,
        loan_deduction: loanDeduction,
        advance_deduction: advanceDeduction,
        net_salary: netSalary,
        days_worked: daysInPeriod,
        status: 'pending',
        created_by: user.id,
      };
    });

    // Insert all payslips
    const { data: insertedPayslips, error: insertError } = await supabase
      .from('payroll_payslips')
      .insert(payslips)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    // Update period totals
    const totalGross = payslips.reduce((sum: number, p: any) => sum + p.gross_salary, 0);
    const totalDeductions = payslips.reduce((sum: number, p: any) => sum + p.deductions, 0);
    const totalNet = payslips.reduce((sum: number, p: any) => sum + p.net_salary, 0);

    const { error: updateError } = await supabase
      .from('payroll_periods')
      .update({
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalNet,
        employee_count: payslips.length,
      })
      .eq('id', periodId);

    if (updateError) {
      console.error('Failed to update period totals:', updateError);
    }

    return NextResponse.json({
      message: 'Payslips generated successfully',
      count: insertedPayslips.length,
      payslips: insertedPayslips,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
