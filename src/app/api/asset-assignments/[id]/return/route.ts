import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const assignmentId = id;
    const body = await request.json();
    const { return_date, condition_at_return, return_notes } = body;

    // Validate required fields
    if (!return_date) {
      return NextResponse.json(
        { error: 'Return date is required' },
        { status: 400 }
      );
    }

    // Get assignment details
    const { data: assignment, error: getError } = await supabase
      .from('asset_assignments')
      .select('asset_id, status')
      .eq('id', assignmentId)
      .single();

    if (getError) throw getError;

    if (assignment.status === 'returned') {
      return NextResponse.json(
        { error: 'Asset has already been returned' },
        { status: 400 }
      );
    }

    // Update assignment
    const { error: updateError } = await supabase
      .from('asset_assignments')
      .update({
        return_date,
        condition_at_return: condition_at_return || null,
        return_notes: return_notes || null,
        status: 'returned',
      })
      .eq('id', assignmentId);

    if (updateError) throw updateError;

    // Update asset status back to active
    const { error: assetError } = await supabase
      .from('assets')
      .update({ status: 'active' })
      .eq('id', assignment.asset_id);

    if (assetError) throw assetError;

    return NextResponse.json({
      message: 'Asset returned successfully',
      assignmentId,
    });
  } catch (error: any) {
    console.error('Error returning asset:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
