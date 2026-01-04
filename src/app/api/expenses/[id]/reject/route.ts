import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/expenses/[id]/reject - Reject expense
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate rejection reason
    if (!body.rejection_reason || body.rejection_reason.trim() === '') {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get expense
    const { data: expense, error: fetchError } = await supabase
      .from('expenses')
      .select('*, created_by')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if expense can be rejected
    if (expense.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot reject a paid expense' },
        { status: 400 }
      );
    }

    // Update expense to rejected
    const { data: updatedExpense, error: updateError } = await supabase
      .from('expenses')
      .update({
        status: 'rejected',
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: body.rejection_reason,
      })
      .eq('id', params.id)
      .select(`
        *,
        rejected_by_user:user_profiles!expenses_rejected_by_fkey(id, full_name, email)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // TODO: Send notification to expense creator
    // await sendExpenseRejectionNotification(expense.created_by, updatedExpense);

    return NextResponse.json({
      data: updatedExpense,
      message: 'Expense rejected successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
