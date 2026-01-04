import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/employees - List all employees with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('employees')
      .select('*')
      .order('first_name', { ascending: true });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('employment_status', status);
    }

    if (department && department !== 'all') {
      query = query.eq('department', department);
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/employees - Create a new employee
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.employee_number || !body.first_name || !body.last_name || !body.hire_date || !body.job_title || !body.basic_salary) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_number, first_name, last_name, hire_date, job_title, basic_salary' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for duplicate employee number
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_number', body.employee_number)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Employee number already exists' },
        { status: 409 }
      );
    }

    // Create the employee
    const { data, error } = await supabase
      .from('employees')
      .insert({
        employee_number: body.employee_number,
        first_name: body.first_name,
        last_name: body.last_name,
        other_names: body.other_names || null,
        email: body.email || null,
        phone: body.phone || null,
        national_id: body.national_id || null,
        nssf_number: body.nssf_number || null,
        tin: body.tin || null,
        date_of_birth: body.date_of_birth || null,
        gender: body.gender || null,
        nationality: body.nationality || 'Ugandan',
        address: body.address || null,
        emergency_contact_name: body.emergency_contact_name || null,
        emergency_contact_phone: body.emergency_contact_phone || null,
        job_title: body.job_title,
        department: body.department || null,
        employment_type: body.employment_type || 'full_time',
        employment_status: 'active', // New employees are always active
        hire_date: body.hire_date,
        basic_salary: body.basic_salary,
        salary_currency: body.salary_currency || 'UGX',
        pay_frequency: body.pay_frequency || 'monthly',
        bank_name: body.bank_name || null,
        bank_branch: body.bank_branch || null,
        bank_account_number: body.bank_account_number || null,
        bank_account_name: body.bank_account_name || null,
        is_active: true,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
