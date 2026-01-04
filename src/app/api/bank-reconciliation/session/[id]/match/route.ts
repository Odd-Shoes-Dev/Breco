import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-reconciliation/session/[id]/match - Match/unmatch transaction
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate transaction_id
    if (!body.transaction_id) {
      return NextResponse.json(
        { error: 'Missing required field: transaction_id' },
        { status: 400 }
      );
    }

    // Get reconciliation
    const { data: reconciliation, error: reconError } = await supabase
      .from('bank_reconciliations')
      .select('status, bank_account_id')
      .eq('id', params.id)
      .single();

    if (reconError || !reconciliation) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    if (reconciliation.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Can only match transactions in in_progress reconciliations' },
        { status: 400 }
      );
    }

    // Verify transaction belongs to the bank account
    const { data: transaction } = await supabase
      .from('bank_transactions')
      .select('bank_account_id, is_reconciled')
      .eq('id', body.transaction_id)
      .single();

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.bank_account_id !== reconciliation.bank_account_id) {
      return NextResponse.json(
        { error: 'Transaction does not belong to this bank account' },
        { status: 400 }
      );
    }

    if (transaction.is_reconciled) {
      return NextResponse.json(
        { error: 'Transaction is already reconciled in a completed reconciliation' },
        { status: 400 }
      );
    }

    // Check if match action
    const action = body.action || 'match'; // match or unmatch

    if (action === 'match') {
      // Add to reconciliation items
      const { data, error } = await supabase
        .from('bank_reconciliation_items')
        .insert({
          reconciliation_id: params.id,
          transaction_id: body.transaction_id,
          cleared_date: body.cleared_date || new Date().toISOString().split('T')[0],
          matched_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          return NextResponse.json(
            { error: 'Transaction is already matched in this reconciliation' },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ data, message: 'Transaction matched successfully' });
    } else if (action === 'unmatch') {
      // Remove from reconciliation items
      const { error } = await supabase
        .from('bank_reconciliation_items')
        .delete()
        .eq('reconciliation_id', params.id)
        .eq('transaction_id', body.transaction_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ message: 'Transaction unmatched successfully' });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "match" or "unmatch"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
