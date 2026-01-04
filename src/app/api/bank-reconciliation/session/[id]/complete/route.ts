import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-reconciliation/session/[id]/complete - Complete reconciliation
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get reconciliation with current totals
    const { data: reconciliation, error: reconError } = await supabase
      .from('bank_reconciliations')
      .select('*, bank_account:bank_accounts(account_name)')
      .eq('id', params.id)
      .single();

    if (reconError || !reconciliation) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    if (reconciliation.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Reconciliation is not in progress' },
        { status: 400 }
      );
    }

    // Check if reconciliation balances
    const tolerance = body.tolerance || 0.01; // Allow 1 cent difference by default
    if (Math.abs(reconciliation.difference) > tolerance) {
      return NextResponse.json(
        {
          error: 'Reconciliation does not balance',
          difference: reconciliation.difference,
          book_balance: reconciliation.book_balance,
          adjusted_bank_balance: reconciliation.adjusted_bank_balance,
        },
        { status: 400 }
      );
    }

    // Complete the reconciliation (trigger will mark transactions as reconciled)
    const { data, error: updateError } = await supabase
      .from('bank_reconciliations')
      .update({
        status: 'completed',
        completed_by: user.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select(`
        *,
        bank_account:bank_accounts(id, account_name, account_number),
        completed_by_user:user_profiles!bank_reconciliations_completed_by_fkey(id, full_name, email)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Get count of reconciled transactions
    const { count } = await supabase
      .from('bank_reconciliation_items')
      .select('*', { count: 'exact', head: true })
      .eq('reconciliation_id', params.id);

    return NextResponse.json({
      data,
      message: `Reconciliation completed successfully. ${count} transactions reconciled.`,
      reconciled_count: count,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
