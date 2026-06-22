import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/employees - List all employees with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const isActive = searchParams.get('is_active');

    const rows = await sql`SELECT * FROM employees ORDER BY first_name ASC`;
    let data = rows as any[];

    if (status && status !== 'all') {
      data = data.filter((e: any) => e.employment_status === status);
    }
    if (department && department !== 'all') {
      data = data.filter((e: any) => e.department === department);
    }
    if (isActive !== null && isActive !== undefined) {
      const active = isActive === 'true';
      data = data.filter((e: any) => e.is_active === active);
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/employees - Create a new employee
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.employee_number || !body.first_name || !body.last_name || !body.hire_date || !body.job_title || !body.basic_salary) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_number, first_name, last_name, hire_date, job_title, basic_salary' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for duplicate employee number
    const existingRows = await sql`SELECT id FROM employees WHERE employee_number = ${body.employee_number} LIMIT 1`;
    if ((existingRows as any[]).length > 0) {
      return NextResponse.json({ error: 'Employee number already exists' }, { status: 409 });
    }

    const insertedRows = await sql`
      INSERT INTO employees (
        employee_number, first_name, last_name, other_names, email, phone,
        national_id, nssf_number, tin, date_of_birth, gender, nationality,
        address, emergency_contact_name, emergency_contact_phone,
        job_title, department, employment_type, employment_status, hire_date,
        basic_salary, salary_currency, pay_frequency,
        bank_name, bank_branch, bank_account_number, bank_account_name,
        is_active, notes
      ) VALUES (
        ${body.employee_number}, ${body.first_name}, ${body.last_name},
        ${body.other_names ?? null}, ${body.email ?? null}, ${body.phone ?? null},
        ${body.national_id ?? null}, ${body.nssf_number ?? null}, ${body.tin ?? null},
        ${body.date_of_birth ?? null}, ${body.gender ?? null}, ${body.nationality || 'Ugandan'},
        ${body.address ?? null}, ${body.emergency_contact_name ?? null}, ${body.emergency_contact_phone ?? null},
        ${body.job_title}, ${body.department ?? null}, ${body.employment_type || 'full_time'},
        ${'active'}, ${body.hire_date},
        ${body.basic_salary}, ${body.salary_currency || 'UGX'}, ${body.pay_frequency || 'monthly'},
        ${body.bank_name ?? null}, ${body.bank_branch ?? null},
        ${body.bank_account_number ?? null}, ${body.bank_account_name ?? null},
        ${true}, ${body.notes ?? null}
      )
      RETURNING *
    `;
    const data = (insertedRows as any[])[0];

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
