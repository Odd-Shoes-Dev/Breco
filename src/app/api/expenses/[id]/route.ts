import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createExpenseJournalEntry } from '@/lib/accounting/journal-entry-helpers';

// GET /api/expenses/[id] - Get expense details
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        vendor:vendors(id, name, company_name),
        expense_account:accounts!expenses_expense_account_id_fkey(id, name, code),
        payment_account:accounts!expenses_payment_account_id_fkey(id, name, code),
        bank_account:bank_accounts(id, account_name, account_number),
        customer:customers(id, name),
        journal_entry:journal_entries(id, entry_number, entry_date),
        created_by_user:user_profiles!expenses_created_by_fkey(id, email, full_name)
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/expenses/[id] - Update expense
export async function PATCH(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Get existing expense
    const { data: existing, error: fetchError } = await supabase
      .from('expenses')
      .select('status, journal_entry_id')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Prevent editing paid expenses
    if (existing.status === 'paid' && body.status !== 'paid') {
      return NextResponse.json(
        { error: 'Cannot edit paid expenses. Void the expense first.' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Calculate total if amount or tax changed
    const total = (body.amount || 0) + (body.tax_amount || 0);

    // Update expense
    const updateData: any = {
      ...body,
      total: total || body.total,
    };

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;

    const { data: expense, error: updateError } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Create journal entry if status changed to 'paid' and no journal entry exists
    if (body.status === 'paid' && existing.status !== 'paid' && !existing.journal_entry_id && user) {
      // Get account code for the expense account
      const { data: expenseAccount } = await supabase
        .from('accounts')
        .select('code')
        .eq('id', expense.expense_account_id)
        .single();

      if (expenseAccount) {
        const journalResult = await createExpenseJournalEntry(
          supabase,
          {
            id: expense.id,
            expense_number: expense.expense_number,
            expense_date: expense.expense_date,
            amount: expense.total,
            account_code: expenseAccount.code,
            description: expense.description || 'Expense',
            bank_account_id: expense.bank_account_id,
          },
          user.id
        );

        if (journalResult.success && journalResult.journalEntry) {
          await supabase
            .from('expenses')
            .update({ journal_entry_id: journalResult.journalEntry.id })
            .eq('id', params.id);
        }
      }
    }

    return NextResponse.json({ data: expense });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/expenses/[id] - Delete expense
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();

    // Get expense to check status
    const { data: expense, error: fetchError } = await supabase
      .from('expenses')
      .select('status, journal_entry_id')
      .eq('id', params.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Only allow deletion of pending/rejected expenses
    if (expense.status === 'paid' || expense.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot delete paid or approved expenses. Only pending/rejected expenses can be deleted.' },
        { status: 400 }
      );
    }

    // If there's a journal entry, we shouldn't delete (should void instead)
    if (expense.journal_entry_id) {
      return NextResponse.json(
        { error: 'Cannot delete expense with journal entry. Contact administrator.' },
        { status: 400 }
      );
    }

    // Delete the expense
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
