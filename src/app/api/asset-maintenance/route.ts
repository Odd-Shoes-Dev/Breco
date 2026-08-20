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
    const maintenanceType = searchParams.get('maintenance_type');

    const conditions: string[] = ['1=1'];
    if (status) conditions.push(`am.status = '${status.replace(/'/g, "''")}'`);
    if (assetId) conditions.push(`am.asset_id = '${assetId.replace(/'/g, "''")}'`);
    if (maintenanceType) conditions.push(`am.maintenance_type = '${maintenanceType.replace(/'/g, "''")}'`);
    const where = conditions.join(' AND ');

    const rows = await sql`
      SELECT
        am.*,
        json_build_object(
          'id', a.id, 'name', a.name, 'asset_number', a.asset_number,
          'asset_categories', json_build_object('name', ac.name)
        ) AS assets,
        json_build_object(
          'first_name', e.first_name, 'last_name', e.last_name,
          'employee_number', e.employee_number
        ) AS employees
      FROM asset_maintenance am
      LEFT JOIN fixed_assets a ON a.id = am.asset_id
      LEFT JOIN asset_categories ac ON ac.id = a.category_id
      LEFT JOIN employees e ON e.id = am.performed_by_employee_id
      WHERE ${sql.unsafe(where)}
      ORDER BY am.scheduled_date DESC
    `;

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching maintenance records:', error);
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
      maintenance_type,
      scheduled_date,
      performed_date,
      performed_by_employee_id,
      performed_by_vendor,
      description,
      cost,
      status,
      notes,
      next_maintenance_date,
    } = body;

    // Validate required fields
    if (!asset_id || !maintenance_type || !scheduled_date || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const rows = await sql`
      INSERT INTO asset_maintenance (
        asset_id, maintenance_type, scheduled_date, performed_date,
        performed_by_employee_id, performed_by_vendor, description,
        cost, status, notes, next_maintenance_date
      ) VALUES (
        ${asset_id},
        ${maintenance_type},
        ${scheduled_date},
        ${performed_date || null},
        ${performed_by_employee_id || null},
        ${performed_by_vendor || null},
        ${description},
        ${cost || null},
        ${status || 'scheduled'},
        ${notes || null},
        ${next_maintenance_date || null}
      )
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating maintenance record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
