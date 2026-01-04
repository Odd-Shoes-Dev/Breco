import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-reconciliation/session/[id] - Get reconciliation details
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();

    const { data: reconciliation, error: reconError } = await supabase
      .from('bank_reconciliations')
      .select(`
        *,
        bank_account:bank_accounts(id, account_name, account_number, current_balance, currency),
        completed_by_user:user_profiles!bank_reconciliations_completed_by_fkey(id, full_name, email),
        created_by_user:user_profiles!bank_reconciliations_created_by_fkey(id, full_name, email)
      `)
      .eq('id', params.id)
      .single();

    if (reconError) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    // Get matched transactions
    const { data: matchedTransactions } = await supabase
      .from('bank_reconciliation_items')
      .select(`
        *,
        transaction:bank_transactions(*)
      `)
      .eq('reconciliation_id', params.id);

    // Get unmatched transactions for this bank account
    const { data: unmatchedTransactions } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', reconciliation.bank_account_id)
      .eq('is_reconciled', false)
      .lte('transaction_date', reconciliation.statement_date)
      .order('transaction_date', { ascending: false });

    return NextResponse.json({
      data: {
        ...reconciliation,
        matched_transactions: matchedTransactions || [],
        unmatched_transactions: unmatchedTransactions || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bank-reconciliation/session/[id] - Update reconciliation
export async function PATCH(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Get existing reconciliation
    const { data: existing } = await supabase
      .from('bank_reconciliations')
      .select('status')
      .eq('id', params.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    if (existing.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot update completed reconciliation' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('bank_reconciliations')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-reconciliation/session/[id] - Cancel reconciliation
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();

    // Get reconciliation
    const { data: reconciliation } = await supabase
      .from('bank_reconciliations')
      .select('status')
      .eq('id', params.id)
      .single();

    if (!reconciliation) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    if (reconciliation.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot delete completed reconciliation' },
        { status: 400 }
      );
    }

    // Delete reconciliation items first (cascade should handle this, but being explicit)
    await supabase
      .from('bank_reconciliation_items')
      .delete()
      .eq('reconciliation_id', params.id);

    // Delete reconciliation
    const { error } = await supabase
      .from('bank_reconciliations')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Reconciliation cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
