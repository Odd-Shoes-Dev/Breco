import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/commissions/[id] - Get commission details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const rows = await sql`
      SELECT
        c.*,
        json_build_object('id', b.id, 'booking_number', b.booking_number) AS booking,
        json_build_object('id', i.id, 'invoice_number', i.invoice_number) AS invoice,
        json_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name, 'email', e.email) AS employee,
        json_build_object('id', v.id, 'name', v.name, 'email', v.email) AS vendor,
        json_build_object('id', up.id, 'full_name', up.full_name) AS approved_by_user
      FROM commissions c
      LEFT JOIN bookings b ON b.id = c.booking_id
      LEFT JOIN invoices i ON i.id = c.invoice_id
      LEFT JOIN employees e ON e.id = c.employee_id
      LEFT JOIN vendors v ON v.id = c.vendor_id
      LEFT JOIN user_profiles up ON up.id = c.approved_by
      WHERE c.id = ${id}
    `;
    const data = (rows as any[])[0];

    if (!data) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/commissions/[id] - Update commission
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingRows = await sql`SELECT status FROM commissions WHERE id = ${id}`;
    const existing = (existingRows as any[])[0];

    if (!existing) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    if (existing.status === 'paid' || existing.status === 'cancelled') {
      return NextResponse.json(
        { error: `Cannot update commission with status: ${existing.status}` },
        { status: 400 }
      );
    }

    await sql`
      UPDATE commissions SET
        commission_rate = COALESCE(${body.commission_rate ?? null}, commission_rate),
        base_amount = COALESCE(${body.base_amount ?? null}, base_amount),
        commission_amount = COALESCE(${body.commission_amount ?? null}, commission_amount),
        payment_date = CASE WHEN ${body.payment_date !== undefined} THEN ${body.payment_date ?? null} ELSE payment_date END,
        status = COALESCE(${body.status ?? null}, status),
        notes = CASE WHEN ${body.notes !== undefined} THEN ${body.notes ?? null} ELSE notes END
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

// DELETE /api/commissions/[id] - Cancel commission
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const existingRows = await sql`SELECT status FROM commissions WHERE id = ${id}`;
    const existing = (existingRows as any[])[0];

    if (!existing) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    if (existing.status === 'paid') {
      return NextResponse.json({ error: 'Cannot cancel paid commission' }, { status: 400 });
    }

    await sql`UPDATE commissions SET status = 'cancelled' WHERE id = ${id}`;

    return NextResponse.json({ message: 'Commission cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
