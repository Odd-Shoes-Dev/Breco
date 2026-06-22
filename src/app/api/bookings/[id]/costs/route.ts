import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bookings/[id]/costs - Get booking costs
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await context.params;

    const data = await sql`
      SELECT
        bc.*,
        json_build_object('id', v.id, 'name', v.name) AS vendor,
        json_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name) AS employee,
        json_build_object('id', ex.id, 'expense_number', ex.expense_number) AS expense
      FROM booking_costs bc
      LEFT JOIN vendors v ON v.id = bc.vendor_id
      LEFT JOIN employees e ON e.id = bc.employee_id
      LEFT JOIN expenses ex ON ex.id = bc.expense_id
      WHERE bc.booking_id = ${bookingId}
      ORDER BY bc.cost_date DESC
    `;
    const costs = data as any[];

    const totalCosts = costs.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0);
    const costsByType = costs.reduce((acc: any, cost) => {
      acc[cost.cost_type] = (acc[cost.cost_type] || 0) + Number(cost.amount);
      return acc;
    }, {});

    return NextResponse.json({
      costs,
      total_costs: totalCosts,
      costs_by_type: costsByType,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bookings/[id]/costs - Add cost to booking
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await context.params;
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!body.cost_type || !body.description || !body.amount || !body.cost_date) {
      return NextResponse.json(
        { error: 'Missing required fields: cost_type, description, amount, cost_date' },
        { status: 400 }
      );
    }

    // Verify booking exists
    const bookingRows = await sql`SELECT id, booking_number FROM bookings WHERE id = ${bookingId}`;
    const booking = (bookingRows as any[])[0];
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const insertedRows = await sql`
      INSERT INTO booking_costs (
        booking_id, cost_type, description, amount, currency, exchange_rate,
        vendor_id, employee_id, expense_id, cost_date, notes, created_by
      ) VALUES (
        ${bookingId}, ${body.cost_type}, ${body.description}, ${body.amount},
        ${body.currency || 'USD'}, ${body.exchange_rate || 1.0},
        ${body.vendor_id ?? null}, ${body.employee_id ?? null}, ${body.expense_id ?? null},
        ${body.cost_date}, ${body.notes ?? null}, ${user.id}
      )
      RETURNING id
    `;
    const newId = (insertedRows as any[])[0].id;

    const dataRows = await sql`
      SELECT
        bc.*,
        json_build_object('id', v.id, 'name', v.name) AS vendor,
        json_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name) AS employee
      FROM booking_costs bc
      LEFT JOIN vendors v ON v.id = bc.vendor_id
      LEFT JOIN employees e ON e.id = bc.employee_id
      WHERE bc.id = ${newId}
    `;
    const data = (dataRows as any[])[0];

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
