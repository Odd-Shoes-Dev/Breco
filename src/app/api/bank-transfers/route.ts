import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-transfers - Create a bank transfer
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.from_account_id || !body.to_account_id || !body.amount || !body.transfer_date) {
      return NextResponse.json(
        { error: 'Missing required fields: from_account_id, to_account_id, amount, transfer_date' },
        { status: 400 }
      );
    }

    if (body.from_account_id === body.to_account_id) {
      return NextResponse.json(
        { error: 'Cannot transfer to the same account' },
        { status: 400 }
      );
    }

    if (body.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get account details including GL account IDs
    const { data: fromAccount } = await supabase
      .from('bank_accounts')
      .select('name, gl_account_id, currency')
      .eq('id', body.from_account_id)
      .single();

    const { data: toAccount } = await supabase
      .from('bank_accounts')
      .select('name, gl_account_id, currency')
      .eq('id', body.to_account_id)
      .single();

    if (!fromAccount || !toAccount) {
      return NextResponse.json({ error: 'One or both accounts not found' }, { status: 404 });
    }

    if (!fromAccount.gl_account_id || !toAccount.gl_account_id) {
      return NextResponse.json({ 
        error: 'Both bank accounts must be linked to GL accounts. Please update the bank account settings.' 
      }, { status: 400 });
    }

    // Generate reference if not provided
    const reference_number = body.reference_number || `TRF-${Date.now().toString(36).toUpperCase()}`;

    // Create two bank transactions: debit from source, credit to destination
    const transactions = [
      {
        bank_account_id: body.from_account_id,
        transaction_date: body.transfer_date,
        amount: -Math.abs(body.amount), // Negative for withdrawal
        description: `Transfer to ${toAccount?.name || 'account'}`,
        reference_number: reference_number,
        transaction_type: 'transfer_out',
        is_reconciled: false,
      },
      {
        bank_account_id: body.to_account_id,
        transaction_date: body.transfer_date,
        amount: Math.abs(body.amount), // Positive for deposit
        description: `Transfer from ${fromAccount?.name || 'account'}`,
        reference_number: reference_number,
        transaction_type: 'transfer_in',
        is_reconciled: false,
      },
    ];

    const { data, error } = await supabase
      .from('bank_transactions')
      .insert(transactions)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create journal entry for the transfer
    // Debit destination bank GL account, Credit source bank GL account
    const transferAmount = Math.abs(body.amount);

    // Generate journal entry number
    const year = new Date(body.transfer_date).getFullYear();
    const { data: lastEntry } = await supabase
      .from('journal_entries')
      .select('entry_number')
      .like('entry_number', `JE-${year}-%`)
      .order('entry_number', { ascending: false })
      .limit(1)
      .single();

    let entryNumber;
    if (lastEntry?.entry_number) {
      const lastNum = parseInt(lastEntry.entry_number.split('-')[2]);
      entryNumber = `JE-${year}-${String(lastNum + 1).padStart(4, '0')}`;
    } else {
      entryNumber = `JE-${year}-0001`;
    }

    // Create journal entry
    const { data: journalEntry, error: jeError } = await supabase
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date: body.transfer_date,
        description: `Bank transfer: ${fromAccount.name} → ${toAccount.name}`,
        reference: reference_number,
        status: 'posted',
        source_module: 'bank',
        source_document_id: data[0]?.id, // Link to the withdrawal transaction
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jeError) {
      console.error('Failed to create journal entry:', jeError);
      return NextResponse.json({ 
        data,
        message: 'Transfer completed successfully',
        warning: 'Journal entry creation failed'
      }, { status: 201 });
    }

    // Create journal lines
    const journalLines = [
      // Debit destination bank account (money coming in)
      {
        journal_entry_id: journalEntry.id,
        account_id: toAccount.gl_account_id,
        debit: transferAmount,
        credit: 0,
        description: `Transfer from ${fromAccount.name}`,
        created_by: user.id,
      },
      // Credit source bank account (money going out)
      {
        journal_entry_id: journalEntry.id,
        account_id: fromAccount.gl_account_id,
        debit: 0,
        credit: transferAmount,
        description: `Transfer to ${toAccount.name}`,
        created_by: user.id,
      },
    ];

    const { error: jlError } = await supabase
      .from('journal_lines')
      .insert(journalLines);

    if (jlError) {
      console.error('Failed to create journal lines:', jlError);
      return NextResponse.json({ 
        data,
        message: 'Transfer completed successfully',
        warning: 'Journal lines creation failed'
      }, { status: 201 });
    }

    return NextResponse.json({ 
      data,
      journal_entry: journalEntry,
      message: 'Transfer completed successfully' 
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
