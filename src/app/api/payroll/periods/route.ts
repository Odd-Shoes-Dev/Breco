import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/payroll/periods - List payroll periods
export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const year = url.searchParams.get('year');

    let rows: any[];

    if (status && year) {
      const yearInt = parseInt(year);
      rows = await sql`
        SELECT pp.*,
          json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) AS processed_by_user
        FROM payroll_periods pp
        LEFT JOIN user_profiles u ON u.id = pp.processed_by
        WHERE pp.status = ${status}
          AND pp.period_start >= ${`${yearInt}-01-01`}
          AND pp.period_start <= ${`${yearInt}-12-31`}
        ORDER BY pp.period_start DESC
      `;
    } else if (status) {
      rows = await sql`
        SELECT pp.*,
          json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) AS processed_by_user
        FROM payroll_periods pp
        LEFT JOIN user_profiles u ON u.id = pp.processed_by
        WHERE pp.status = ${status}
        ORDER BY pp.period_start DESC
      `;
    } else if (year) {
      const yearInt = parseInt(year);
      rows = await sql`
        SELECT pp.*,
          json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) AS processed_by_user
        FROM payroll_periods pp
        LEFT JOIN user_profiles u ON u.id = pp.processed_by
        WHERE pp.period_start >= ${`${yearInt}-01-01`}
          AND pp.period_start <= ${`${yearInt}-12-31`}
        ORDER BY pp.period_start DESC
      `;
    } else {
      rows = await sql`
        SELECT pp.*,
          json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email) AS processed_by_user
        FROM payroll_periods pp
        LEFT JOIN user_profiles u ON u.id = pp.processed_by
        ORDER BY pp.period_start DESC
      `;
    }

    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/payroll/periods - Create a new payroll period
export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { period_start, period_end, payment_date } = body;

    // Validate required fields
    if (!period_start || !period_end || !payment_date) {
      return NextResponse.json(
        { error: 'period_start, period_end, and payment_date are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(period_start);
    const end = new Date(period_end);
    const payment = new Date(payment_date);

    if (start >= end) {
      return NextResponse.json(
        { error: 'period_end must be after period_start' },
        { status: 400 }
      );
    }

    if (payment < end) {
      return NextResponse.json(
        { error: 'payment_date must be on or after period_end' },
        { status: 400 }
      );
    }

    // Check for overlapping periods
    const existing = await sql`
      SELECT id FROM payroll_periods
      WHERE period_start <= ${period_end} AND period_end >= ${period_start}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'A payroll period already exists that overlaps with this date range' },
        { status: 400 }
      );
    }

    // Create the payroll period
    const rows = await sql`
      INSERT INTO payroll_periods (period_start, period_end, payment_date, status, created_by)
      VALUES (${period_start}, ${period_end}, ${payment_date}, 'draft', ${user.id})
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
