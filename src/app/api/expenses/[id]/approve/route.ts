import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/expenses/[id]/approve - Approve expense
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();
    const body = await request.json();

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

    // Check if expense is in pending status
    if (expense.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve expense with status: ${expense.status}` },
        { status: 400 }
      );
    }

    // Update expense to approved
    const { data: updatedExpense, error: updateError } = await supabase
      .from('expenses')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select(`
        *,
        approved_by_user:user_profiles!expenses_approved_by_fkey(id, full_name, email)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // TODO: Send notification to expense creator
    // await sendExpenseApprovalNotification(expense.created_by, updatedExpense);

    return NextResponse.json({
      data: updatedExpense,
      message: 'Expense approved successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
