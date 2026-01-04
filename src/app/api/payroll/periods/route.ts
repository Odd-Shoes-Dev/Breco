import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/payroll/periods - List payroll periods
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const year = url.searchParams.get('year');

    let query = supabase
      .from('payroll_periods')
      .select(`
        *,
        processed_by_user:user_profiles!payroll_periods_processed_by_fkey(id, full_name, email)
      `)
      .order('period_start', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (year) {
      const yearInt = parseInt(year);
      query = query
        .gte('period_start', `${yearInt}-01-01`)
        .lte('period_start', `${yearInt}-12-31`);
    }

    const { data: periods, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(periods);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/payroll/periods - Create a new payroll period
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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
    const { data: existing, error: checkError } = await supabase
      .from('payroll_periods')
      .select('id')
      .or(`period_start.lte.${period_end},period_end.gte.${period_start}`)
      .limit(1);

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 });
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A payroll period already exists that overlaps with this date range' },
        { status: 400 }
      );
    }

    // Create the payroll period
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .insert({
        period_start,
        period_end,
        payment_date,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (periodError) {
      return NextResponse.json({ error: periodError.message }, { status: 400 });
    }

    return NextResponse.json(period, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
