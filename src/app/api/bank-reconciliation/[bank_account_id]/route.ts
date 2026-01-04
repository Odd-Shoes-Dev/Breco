import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/bank-reconciliation/[bank_account_id] - Get reconciliations for bank account
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('bank_reconciliations')
      .select(`
        *,
        bank_account:bank_accounts(id, account_name, account_number, current_balance),
        completed_by_user:user_profiles!bank_reconciliations_completed_by_fkey(id, full_name, email),
        created_by_user:user_profiles!bank_reconciliations_created_by_fkey(id, full_name, email)
      `)
      .eq('bank_account_id', params.bank_account_id)
      .order('reconciliation_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bank-reconciliation/[bank_account_id] - Start new reconciliation
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.statement_date || !body.statement_ending_balance) {
      return NextResponse.json(
        { error: 'Missing required fields: statement_date, statement_ending_balance' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if bank account exists
    const { data: bankAccount, error: bankError } = await supabase
      .from('bank_accounts')
      .select('id, current_balance, account_name')
      .eq('id', params.bank_account_id)
      .single();

    if (bankError || !bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    // Check for existing in_progress reconciliation
    const { data: existing } = await supabase
      .from('bank_reconciliations')
      .select('id')
      .eq('bank_account_id', params.bank_account_id)
      .eq('status', 'in_progress')
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'There is already an in-progress reconciliation for this account' },
        { status: 400 }
      );
    }

    // Get last reconciliation to get starting balance
    const { data: lastRecon } = await supabase
      .from('bank_reconciliations')
      .select('statement_ending_balance')
      .eq('bank_account_id', params.bank_account_id)
      .eq('status', 'completed')
      .order('reconciliation_date', { ascending: false })
      .limit(1)
      .single();

    const startingBalance = lastRecon?.statement_ending_balance || 0;

    // Create reconciliation
    const { data: reconciliation, error: reconError } = await supabase
      .from('bank_reconciliations')
      .insert({
        bank_account_id: params.bank_account_id,
        reconciliation_date: body.reconciliation_date || new Date().toISOString().split('T')[0],
        statement_starting_balance: startingBalance,
        statement_ending_balance: body.statement_ending_balance,
        statement_date: body.statement_date,
        book_balance: bankAccount.current_balance,
        notes: body.notes || null,
        created_by: user.id,
      })
      .select(`
        *,
        bank_account:bank_accounts(id, account_name, account_number, current_balance)
      `)
      .single();

    if (reconError) {
      return NextResponse.json({ error: reconError.message }, { status: 400 });
    }

    return NextResponse.json({ data: reconciliation }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
