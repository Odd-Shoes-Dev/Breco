import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/petty-cash/disbursements/[id]/approve - Approve disbursement
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check current status
    const { data: existing } = await supabase
      .from('petty_cash_disbursements')
      .select('status, amount, cash_account_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Disbursement not found' }, { status: 404 });
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Can only approve pending disbursements. Current status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Get petty cash expense account
    const { data: expenseAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('code', '5300')
      .single();

    if (!expenseAccount) {
      return NextResponse.json(
        { error: 'Petty cash expense account (5300) not found' },
        { status: 400 }
      );
    }

    // Create journal entry: DR Petty Cash Expense, CR Cash Account
    const { data: journalEntry, error: jeError } = await supabase
      .from('journal_entries')
      .insert({
        entry_date: new Date().toISOString().split('T')[0],
        description: `Petty cash disbursement - ${existing.amount}`,
        reference_type: 'petty_cash_disbursement',
        reference_id: id,
        created_by: user.id,
      })
      .select()
      .single();

    if (jeError) {
      return NextResponse.json({ error: jeError.message }, { status: 400 });
    }

    // Create journal lines
    const lines = [
      {
        journal_entry_id: journalEntry.id,
        account_id: expenseAccount.id, // DR Petty Cash Expense
        debit: existing.amount,
        credit: 0,
      },
      {
        journal_entry_id: journalEntry.id,
        account_id: existing.cash_account_id, // CR Cash
        debit: 0,
        credit: existing.amount,
      },
    ];

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(lines);

    if (linesError) {
      // Rollback journal entry
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Update disbursement status
    const { data, error } = await supabase
      .from('petty_cash_disbursements')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        journal_entry_id: journalEntry.id,
      })
      .eq('id', id)
      .select(`
        *,
        cash_account:bank_accounts!petty_cash_disbursements_cash_account_id_fkey(id, account_name)
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
