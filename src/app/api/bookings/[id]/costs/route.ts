import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bookings/[id]/costs - Get booking costs
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: bookingId } = await context.params;

    const { data, error } = await supabase
      .from('booking_costs')
      .select(`
        *,
        vendor:vendors(id, name),
        employee:employees(id, first_name, last_name),
        expense:expenses(id, expense_number)
      `)
      .eq('booking_id', bookingId)
      .order('cost_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Calculate totals by cost type
    const totalCosts = data?.reduce((sum, cost) => sum + cost.amount, 0) || 0;
    const costsByType = data?.reduce((acc: any, cost) => {
      acc[cost.cost_type] = (acc[cost.cost_type] || 0) + cost.amount;
      return acc;
    }, {});

    return NextResponse.json({
      costs: data,
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
    const supabase = await createClient();
    const { id: bookingId } = await context.params;
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.cost_type || !body.description || !body.amount || !body.cost_date) {
      return NextResponse.json(
        { error: 'Missing required fields: cost_type, description, amount, cost_date' },
        { status: 400 }
      );
    }

    // Verify booking exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, booking_number')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Create cost record
    const { data, error } = await supabase
      .from('booking_costs')
      .insert({
        booking_id: bookingId,
        cost_type: body.cost_type,
        description: body.description,
        amount: body.amount,
        currency: body.currency || 'USD',
        exchange_rate: body.exchange_rate || 1.0,
        vendor_id: body.vendor_id,
        employee_id: body.employee_id,
        expense_id: body.expense_id,
        cost_date: body.cost_date,
        notes: body.notes,
        created_by: user.id,
      })
      .select(`
        *,
        vendor:vendors(id, name),
        employee:employees(id, first_name, last_name)
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
