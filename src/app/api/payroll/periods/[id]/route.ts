import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/payroll/periods/[id] - Get period details with payslips
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

    const { data: period, error } = await supabase
      .from('payroll_periods')
      .select(`
        *,
        created_by_user:user_profiles!payroll_periods_created_by_fkey(id, full_name, email),
        processed_by_user:user_profiles!payroll_periods_processed_by_fkey(id, full_name, email),
        payslips:payroll_payslips(
          *,
          employee:employees(id, first_name, last_name, employee_id)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check period exists and is draft
    const { data: period, error: fetchError } = await supabase
      .from('payroll_periods')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    }

    if (period.status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only delete draft payroll periods' },
        { status: 400 }
      );
    }

    // Delete the period (cascade will delete payslips)
    const { error: deleteError } = await supabase
      .from('payroll_periods')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Payroll period deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
