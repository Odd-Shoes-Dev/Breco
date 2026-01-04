import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/commissions - List commissions with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const commission_type = searchParams.get('commission_type');
    const status = searchParams.get('status');
    const booking_id = searchParams.get('booking_id');
    const employee_id = searchParams.get('employee_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('commissions')
      .select(`
        *,
        booking:bookings(id, booking_number),
        invoice:invoices(id, invoice_number),
        employee:employees(id, first_name, last_name),
        vendor:vendors(id, name)
      `, { count: 'exact' });

    if (commission_type) query = query.eq('commission_type', commission_type);
    if (status) query = query.eq('status', status);
    if (booking_id) query = query.eq('booking_id', booking_id);
    if (employee_id) query = query.eq('employee_id', employee_id);

    const { data, error, count } = await query
      .order('commission_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/commissions - Create commission
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.commission_type || !body.commission_date) {
      return NextResponse.json(
        { error: 'Missing required fields: commission_type, commission_date' },
        { status: 400 }
      );
    }

    // Calculate commission amount
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

    const { data, error } = await supabase
      .from('commissions')
      .insert({
        commission_type: body.commission_type,
        booking_id: body.booking_id,
        invoice_id: body.invoice_id,
        employee_id: body.employee_id,
        vendor_id: body.vendor_id,
        commission_rate: body.commission_rate,
        base_amount: body.base_amount,
        commission_amount,
        currency: body.currency || 'USD',
        exchange_rate: body.exchange_rate || 1.0,
        commission_date: body.commission_date,
        payment_date: body.payment_date,
        status: body.status || 'pending',
        notes: body.notes,
        created_by: user.id,
      })
      .select(`
        *,
        booking:bookings(id, booking_number),
        invoice:invoices(id, invoice_number),
        employee:employees(id, first_name, last_name),
        vendor:vendors(id, name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
