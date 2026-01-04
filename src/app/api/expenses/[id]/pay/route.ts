import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createExpenseJournalEntry } from '@/lib/accounting/journal-entry-helpers';

// POST /api/expenses/[id]/pay - Mark expense as paid
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
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if expense is approved
    if (expense.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved expenses can be marked as paid' },
        { status: 400 }
      );
    }

    // Validate bank account if provided
    if (body.bank_account_id) {
      const { data: bankAccount } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('id', body.bank_account_id)
        .single();

      if (!bankAccount) {
        return NextResponse.json(
          { error: 'Invalid bank account' },
          { status: 400 }
        );
      }
    }

    // Update expense to paid
    const updateData: any = {
      status: 'paid',
      paid_by: user.id,
      paid_at: new Date().toISOString(),
    };

    // Update bank account if provided
    if (body.bank_account_id) {
      updateData.bank_account_id = body.bank_account_id;
    }

    // Update payment method if provided
    if (body.payment_method) {
      updateData.payment_method = body.payment_method;
    }

    // Update reference number if provided
    if (body.reference_number) {
      updateData.reference = body.reference_number;
    }

    const { data: updatedExpense, error: updateError } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        paid_by_user:user_profiles!expenses_paid_by_fkey(id, full_name, email),
        expense_account:accounts!expenses_expense_account_id_fkey(id, name, code)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Create journal entry
    if (!expense.journal_entry_id && updatedExpense.expense_account) {
      const journalResult = await createExpenseJournalEntry(
        supabase,
        {
          id: updatedExpense.id,
          expense_number: updatedExpense.expense_number,
          expense_date: updatedExpense.expense_date,
          amount: updatedExpense.total,
          account_code: updatedExpense.expense_account.code,
          description: updatedExpense.description || 'Expense',
          bank_account_id: updatedExpense.bank_account_id,
        },
        user.id
      );

      if (journalResult.success && journalResult.journalEntry) {
        await supabase
          .from('expenses')
          .update({ journal_entry_id: journalResult.journalEntry.id })
          .eq('id', params.id);

        updatedExpense.journal_entry_id = journalResult.journalEntry.id;
      } else {
        console.error('Failed to create journal entry for expense:', journalResult.error);
      }
    }

    return NextResponse.json({
      data: updatedExpense,
      message: 'Expense marked as paid successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
