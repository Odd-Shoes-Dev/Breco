import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/commissions/[id] - Get commission details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data, error } = await supabase
      .from('commissions')
      .select(`
        *,
        booking:bookings(id, booking_number),
        invoice:invoices(id, invoice_number),
        employee:employees(id, first_name, last_name, email),
        vendor:vendors(id, name, email),
        approved_by_user:user_profiles!commissions_approved_by_fkey(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
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
    const supabase = await createClient();
    const { id } = await context.params;
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check current status - only allow updates on pending/approved
    const { data: existing } = await supabase
      .from('commissions')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    if (existing.status === 'paid' || existing.status === 'cancelled') {
      return NextResponse.json(
        { error: `Cannot update commission with status: ${existing.status}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('commissions')
      .update({
        commission_rate: body.commission_rate,
        base_amount: body.base_amount,
        commission_amount: body.commission_amount,
        payment_date: body.payment_date,
        status: body.status,
        notes: body.notes,
      })
      .eq('id', id)
      .select(`
        *,
        booking:bookings(id, booking_number),
        employee:employees(id, first_name, last_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
    const supabase = await createClient();
    const { id } = await context.params;

    // Check if already paid
    const { data: existing } = await supabase
      .from('commissions')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
    }

    if (existing.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot cancel paid commission' },
        { status: 400 }
      );
    }

    // Soft delete - change status to cancelled
    const { error } = await supabase
      .from('commissions')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Commission cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
