import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/fiscal-periods/close - Close a fiscal period
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only administrators can close fiscal periods' },
        { status: 403 }
      );
    }

    if (!body.period_id) {
      return NextResponse.json(
        { error: 'Missing required field: period_id' },
        { status: 400 }
      );
    }

    // Update period status to closed
    const rows = await sql`
      UPDATE fiscal_periods
      SET status = 'closed', locked_by = ${user.id}, locked_at = ${new Date().toISOString()}
      WHERE id = ${body.period_id}
      RETURNING *
    `;
    const data = rows[0];

    return NextResponse.json({
      data,
      message: 'Fiscal period closed successfully'
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
