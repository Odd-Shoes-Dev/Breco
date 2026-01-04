import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/payroll/payslips/[id] - Get payslip details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: payslip, error } = await supabase
      .from('payroll_payslips')
      .select(`
        *,
        employee:employees(id, employee_id, first_name, last_name, email, department, position),
        period:payroll_periods(id, period_start, period_end, payment_date, status)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check payslip exists and period is draft
    const { data: payslip, error: fetchError } = await supabase
      .from('payroll_payslips')
      .select(`
        *,
        period:payroll_periods(id, status)
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    if ((payslip.period as any)?.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only update payslips for draft periods' },
        { status: 400 }
      );
    }

    // Allow updating specific fields
    const allowedFields = [
      'basic_salary',
      'allowances',
      'housing_allowance',
      'transport_allowance',
      'other_allowances',
      'deductions',
      'tax_deduction',
      'nhif_deduction',
      'nssf_deduction',
      'loan_deduction',
      'advance_deduction',
      'days_worked',
      'notes',
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

    // Update payslip
    const { data: updatedPayslip, error: updateError } = await supabase
      .from('payroll_payslips')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updatedPayslip);
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check payslip exists and period is draft
    const { data: payslip, error: fetchError } = await supabase
      .from('payroll_payslips')
      .select(`
        *,
        period:payroll_periods(id, status)
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    if ((payslip.period as any)?.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only delete payslips for draft periods' },
        { status: 400 }
      );
    }

    // Delete payslip
    const { error: deleteError } = await supabase
      .from('payroll_payslips')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Payslip deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
