import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/employees/[id] - Get a single employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        allowances:employee_allowances(*),
        deductions:employee_deductions(*),
        advances:salary_advances(*),
        reimbursements:employee_reimbursements(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/employees/[id] - Update an employee
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current employee data
    const { data: currentEmployee, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // If changing employee number, check for duplicates
    if (body.employee_number && body.employee_number !== currentEmployee.employee_number) {
      const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('employee_number', body.employee_number)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Employee number already exists' },
          { status: 409 }
        );
      }
    }

    // Handle employment status changes
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // If terminating, set termination date
    if (body.employment_status === 'terminated' && !body.termination_date) {
      updateData.termination_date = new Date().toISOString().split('T')[0];
      updateData.is_active = false;
    }

    // If reactivating, clear termination date
    if (body.employment_status === 'active' && currentEmployee.employment_status === 'terminated') {
      updateData.termination_date = null;
      updateData.is_active = true;
    }

    // Update the employee
    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/employees/[id] - Delete an employee (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if employee has payslips
    const { data: payslips } = await supabase
      .from('payslips')
      .select('id')
      .eq('employee_id', id)
      .limit(1);

    if (payslips && payslips.length > 0) {
      // Soft delete - mark as inactive instead of deleting
      const { data, error } = await supabase
        .from('employees')
        .update({
          is_active: false,
          employment_status: 'terminated',
          termination_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        data,
        message: 'Employee marked as terminated (has payroll history)',
      }, { status: 200 });
    }

    // Hard delete if no payslips
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Employee deleted successfully',
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
