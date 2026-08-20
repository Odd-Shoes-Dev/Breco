import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/employees/[id] - Get a single employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql`
      SELECT
        e.*,
        COALESCE((SELECT json_agg(a.*) FROM employee_allowances a WHERE a.employee_id = e.id), '[]') AS allowances,
        COALESCE((SELECT json_agg(d.*) FROM employee_deductions d WHERE d.employee_id = e.id), '[]') AS deductions,
        COALESCE((SELECT json_agg(sa.*) FROM salary_advances sa WHERE sa.employee_id = e.id), '[]') AS advances,
        COALESCE((SELECT json_agg(r.*) FROM employee_reimbursements r WHERE r.employee_id = e.id), '[]') AS reimbursements
      FROM employees e
      WHERE e.id = ${id}
    `;
    const data = (rows as any[])[0];

    if (!data) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
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
    const { id } = await params;
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentRows = await sql`SELECT * FROM employees WHERE id = ${id}`;
    const currentEmployee = (currentRows as any[])[0];

    if (!currentEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check for duplicate employee number
    if (body.employee_number && body.employee_number !== currentEmployee.employee_number) {
      const dupRows = await sql`
        SELECT id FROM employees WHERE employee_number = ${body.employee_number} AND id != ${id} LIMIT 1
      `;
      if ((dupRows as any[]).length > 0) {
        return NextResponse.json({ error: 'Employee number already exists' }, { status: 409 });
      }
    }

    // Handle employment status changes
    let terminationDate = body.termination_date ?? null;
    let isActive = body.is_active ?? null;

    if (body.employment_status === 'terminated' && !body.termination_date) {
      terminationDate = new Date().toISOString().split('T')[0];
      isActive = false;
    }

    if (body.employment_status === 'active' && currentEmployee.employment_status === 'terminated') {
      terminationDate = null;
      isActive = true;
    }

    await sql`
      UPDATE employees SET
        employee_number = COALESCE(${body.employee_number ?? null}, employee_number),
        first_name = COALESCE(${body.first_name ?? null}, first_name),
        last_name = COALESCE(${body.last_name ?? null}, last_name),
        other_names = CASE WHEN ${body.other_names !== undefined} THEN ${body.other_names ?? null} ELSE other_names END,
        email = CASE WHEN ${body.email !== undefined} THEN ${body.email ?? null} ELSE email END,
        phone = CASE WHEN ${body.phone !== undefined} THEN ${body.phone ?? null} ELSE phone END,
        national_id = CASE WHEN ${body.national_id !== undefined} THEN ${body.national_id ?? null} ELSE national_id END,
        nssf_number = CASE WHEN ${body.nssf_number !== undefined} THEN ${body.nssf_number ?? null} ELSE nssf_number END,
        tin = CASE WHEN ${body.tin !== undefined} THEN ${body.tin ?? null} ELSE tin END,
        date_of_birth = CASE WHEN ${body.date_of_birth !== undefined} THEN ${body.date_of_birth ?? null} ELSE date_of_birth END,
        gender = CASE WHEN ${body.gender !== undefined} THEN ${body.gender ?? null} ELSE gender END,
        nationality = COALESCE(${body.nationality ?? null}, nationality),
        address = CASE WHEN ${body.address !== undefined} THEN ${body.address ?? null} ELSE address END,
        emergency_contact_name = CASE WHEN ${body.emergency_contact_name !== undefined} THEN ${body.emergency_contact_name ?? null} ELSE emergency_contact_name END,
        emergency_contact_phone = CASE WHEN ${body.emergency_contact_phone !== undefined} THEN ${body.emergency_contact_phone ?? null} ELSE emergency_contact_phone END,
        job_title = COALESCE(${body.job_title ?? null}, job_title),
        department = CASE WHEN ${body.department !== undefined} THEN ${body.department ?? null} ELSE department END,
        employment_type = COALESCE(${body.employment_type ?? null}, employment_type),
        employment_status = COALESCE(${body.employment_status ?? null}, employment_status),
        hire_date = COALESCE(${body.hire_date ?? null}, hire_date),
        termination_date = CASE WHEN ${terminationDate !== undefined} THEN ${terminationDate} ELSE termination_date END,
        basic_salary = COALESCE(${body.basic_salary ?? null}, basic_salary),
        salary_currency = COALESCE(${body.salary_currency ?? null}, salary_currency),
        pay_frequency = COALESCE(${body.pay_frequency ?? null}, pay_frequency),
        bank_name = CASE WHEN ${body.bank_name !== undefined} THEN ${body.bank_name ?? null} ELSE bank_name END,
        bank_branch = CASE WHEN ${body.bank_branch !== undefined} THEN ${body.bank_branch ?? null} ELSE bank_branch END,
        bank_account_number = CASE WHEN ${body.bank_account_number !== undefined} THEN ${body.bank_account_number ?? null} ELSE bank_account_number END,
        bank_account_name = CASE WHEN ${body.bank_account_name !== undefined} THEN ${body.bank_account_name ?? null} ELSE bank_account_name END,
        is_active = COALESCE(${isActive}, is_active),
        notes = CASE WHEN ${body.notes !== undefined} THEN ${body.notes ?? null} ELSE notes END,
        updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
    `;

    const dataRows = await sql`SELECT * FROM employees WHERE id = ${id}`;
    const data = (dataRows as any[])[0];

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
    const { id } = await params;

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if employee has payslips
    const payslipRows = await sql`SELECT id FROM payslips WHERE employee_id = ${id} LIMIT 1`;

    if ((payslipRows as any[]).length > 0) {
      // Soft delete
      await sql`
        UPDATE employees SET
          is_active = false,
          employment_status = 'terminated',
          termination_date = ${new Date().toISOString().split('T')[0]},
          updated_at = ${new Date().toISOString()}
        WHERE id = ${id}
      `;
      const dataRows = await sql`SELECT * FROM employees WHERE id = ${id}`;
      const data = (dataRows as any[])[0];

      return NextResponse.json({
        data,
        message: 'Employee marked as terminated (has payroll history)',
      }, { status: 200 });
    }

    // Hard delete if no payslips
    await sql`DELETE FROM employees WHERE id = ${id}`;

    return NextResponse.json({ message: 'Employee deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
