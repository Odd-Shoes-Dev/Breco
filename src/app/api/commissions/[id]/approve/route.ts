import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/commissions/[id]/approve - Approve commission
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingRows = await sql`SELECT status FROM commissions WHERE id = ${id}`;
    const existing = (existingRows as any[])[0];

    if (!existing) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Can only approve pending commissions. Current status: ${existing.status}` },
        { status: 400 }
      );
    }

    await sql`
      UPDATE commissions
      SET status = 'approved', approved_by = ${user.id}, approved_at = ${new Date().toISOString()}
      WHERE id = ${id}
    `;

    const dataRows = await sql`
      SELECT
        c.*,
        json_build_object('id', b.id, 'booking_number', b.booking_number) AS booking,
        json_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name) AS employee
      FROM commissions c
      LEFT JOIN bookings b ON b.id = c.booking_id
      LEFT JOIN employees e ON e.id = c.employee_id
      WHERE c.id = ${id}
    `;
    const data = (dataRows as any[])[0];

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
