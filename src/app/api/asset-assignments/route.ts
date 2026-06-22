import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assetId = searchParams.get('asset_id');
    const employeeId = searchParams.get('employee_id');

    const conditions: string[] = ['1=1'];
    if (status) conditions.push(`aa.status = '${status.replace(/'/g, "''")}'`);
    if (assetId) conditions.push(`aa.asset_id = '${assetId.replace(/'/g, "''")}'`);
    if (employeeId) conditions.push(`aa.employee_id = '${employeeId.replace(/'/g, "''")}'`);
    const where = conditions.join(' AND ');

    const rows = await sql`
      SELECT
        aa.*,
        json_build_object('id', a.id, 'name', a.name, 'asset_tag', a.asset_tag,
          'asset_categories', json_build_object('name', ac.name)
        ) AS assets,
        json_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name,
          'employee_number', e.employee_number, 'department', e.department
        ) AS employees
      FROM asset_assignments aa
      LEFT JOIN assets a ON a.id = aa.asset_id
      LEFT JOIN asset_categories ac ON ac.id = a.category_id
      LEFT JOIN employees e ON e.id = aa.employee_id
      WHERE ${sql.unsafe(where)}
      ORDER BY aa.assignment_date DESC
    `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching asset assignments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      asset_id,
      employee_id,
      assignment_date,
      expected_return_date,
      condition_at_assignment,
      notes,
    } = body;

    // Validate required fields
    if (!asset_id || !employee_id || !assignment_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if asset is already assigned
    const existingAssignment = await sql`
      SELECT id FROM asset_assignments WHERE asset_id = ${asset_id} AND status = 'assigned'
    `;

    if (existingAssignment.length > 0) {
      return NextResponse.json(
        { error: 'Asset is already assigned to another employee' },
        { status: 400 }
      );
    }

    // Create assignment
    const rows = await sql`
      INSERT INTO asset_assignments (
        asset_id, employee_id, assignment_date, expected_return_date,
        condition_at_assignment, status, notes
      ) VALUES (
        ${asset_id},
        ${employee_id},
        ${assignment_date},
        ${expected_return_date || null},
        ${condition_at_assignment || 'good'},
        'assigned',
        ${notes || null}
      )
      RETURNING *
    `;

    // Update asset status to assigned
    await sql`UPDATE assets SET status = 'assigned' WHERE id = ${asset_id}`;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating asset assignment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
