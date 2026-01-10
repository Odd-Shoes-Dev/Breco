import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/fiscal-periods/close - Close a fiscal period
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
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
    const { data, error } = await supabase
      .from('fiscal_periods')
      .update({
        status: 'closed',
        closed_by: user.id,
        closed_at: new Date().toISOString(),
      })
      .eq('id', body.period_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data,
      message: 'Fiscal period closed successfully'
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
