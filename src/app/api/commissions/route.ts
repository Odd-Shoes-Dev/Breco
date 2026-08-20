import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/commissions - List commissions with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const commission_type = searchParams.get('commission_type');
    const status = searchParams.get('status');
    const booking_id = searchParams.get('booking_id');
    const employee_id = searchParams.get('employee_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const rows = await sql`
      SELECT
        c.*,
        json_build_object('id', b.id, 'booking_number', b.booking_number) AS booking,
        json_build_object('id', i.id, 'invoice_number', i.invoice_number) AS invoice,
        json_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name) AS employee,
        json_build_object('id', v.id, 'name', v.name) AS vendor
      FROM commissions c
      LEFT JOIN bookings b ON b.id = c.booking_id
      LEFT JOIN invoices i ON i.id = c.invoice_id
      LEFT JOIN employees e ON e.id = c.employee_id
      LEFT JOIN vendors v ON v.id = c.vendor_id
      ORDER BY c.commission_date DESC
    `;

    let data = rows as any[];

    if (commission_type) data = data.filter((r: any) => r.commission_type === commission_type);
    if (status) data = data.filter((r: any) => r.status === status);
    if (booking_id) data = data.filter((r: any) => r.booking_id === booking_id);
    if (employee_id) data = data.filter((r: any) => r.employee_id === employee_id);

    const total = data.length;
    const paged = data.slice(offset, offset + limit);

    return NextResponse.json({
      data: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/commissions - Create commission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!body.commission_type || !body.commission_date) {
      return NextResponse.json(
        { error: 'Missing required fields: commission_type, commission_date' },
        { status: 400 }
      );
    }

    let commission_amount = body.commission_amount;
    if (body.commission_rate && body.base_amount) {
      commission_amount = body.base_amount * (body.commission_rate / 100);
    }

    if (!commission_amount || commission_amount <= 0) {
      return NextResponse.json(
        { error: 'Commission amount must be greater than zero' },
        { status: 400 }
      );
    }

    const insertedRows = await sql`
      INSERT INTO commissions (
        commission_type, booking_id, invoice_id, employee_id, vendor_id,
        commission_rate, base_amount, commission_amount, currency, exchange_rate,
        commission_date, payment_date, status, notes, created_by
      ) VALUES (
        ${body.commission_type}, ${body.booking_id ?? null}, ${body.invoice_id ?? null},
        ${body.employee_id ?? null}, ${body.vendor_id ?? null},
        ${body.commission_rate ?? null}, ${body.base_amount ?? null}, ${commission_amount},
        ${body.currency || 'USD'}, ${body.exchange_rate || 1.0},
        ${body.commission_date}, ${body.payment_date ?? null},
        ${body.status || 'pending'}, ${body.notes ?? null}, ${user.id}
      )
      RETURNING id
    `;
    const newId = (insertedRows as any[])[0].id;

    const dataRows = await sql`
      SELECT
        c.*,
        json_build_object('id', b.id, 'booking_number', b.booking_number) AS booking,
        json_build_object('id', i.id, 'invoice_number', i.invoice_number) AS invoice,
        json_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name) AS employee,
        json_build_object('id', v.id, 'name', v.name) AS vendor
      FROM commissions c
      LEFT JOIN bookings b ON b.id = c.booking_id
      LEFT JOIN invoices i ON i.id = c.invoice_id
      LEFT JOIN employees e ON e.id = c.employee_id
      LEFT JOIN vendors v ON v.id = c.vendor_id
      WHERE c.id = ${newId}
    `;
    const data = (dataRows as any[])[0];

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
