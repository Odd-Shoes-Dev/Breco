import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-transactions - Create a bank transaction
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.bank_account_id || !body.transaction_date || !body.amount || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: bank_account_id, transaction_date, amount, description' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the bank account to retrieve its GL account
    const { data: bankAccount, error: bankAccountError } = await supabase
      .from('bank_accounts')
      .select('gl_account_id, name, currency')
      .eq('id', body.bank_account_id)
      .single();

    if (bankAccountError || !bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    if (!bankAccount.gl_account_id) {
      return NextResponse.json({ 
        error: 'Bank account is not linked to a GL account. Please update the bank account settings.' 
      }, { status: 400 });
    }

    // Create the bank transaction
    const { data, error } = await supabase
      .from('bank_transactions')
      .insert({
        bank_account_id: body.bank_account_id,
        transaction_date: body.transaction_date,
        amount: body.amount,
        description: body.description,
        reference_number: body.reference_number || null,
        transaction_type: body.transaction_type || 'other',
        is_reconciled: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create corresponding journal entry
    // For deposits: Debit Bank Account, Credit Revenue/Other Income or specified account
    // For withdrawals: Debit Expense or specified account, Credit Bank Account
    const isDeposit = body.amount > 0;
    const transactionAmount = Math.abs(body.amount);

    // Determine the contra account (the other side of the transaction)
    let contraAccountId = body.contra_account_id;
    
    if (!contraAccountId) {
      // Default accounts if not specified
      if (isDeposit) {
        // For deposits, default to Other Income account (4500)
        const { data: incomeAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('code', '4500')
          .single();
        contraAccountId = incomeAccount?.id;
      } else {
        // For withdrawals, default to Bank Charges account (5300)
        const { data: expenseAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('code', '5300')
          .single();
        contraAccountId = expenseAccount?.id;
      }
    }

    if (!contraAccountId) {
      // If we still don't have a contra account, skip journal entry but warn
      console.warn('No contra account found for bank transaction, journal entry not created');
      return NextResponse.json({ data }, { status: 201 });
    }

    // Generate journal entry number
    const year = new Date(body.transaction_date).getFullYear();
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
        entry_date: body.transaction_date,
        description: `Bank ${isDeposit ? 'deposit' : 'withdrawal'}: ${body.description}`,
        reference: body.reference_number || data.id,
        status: 'posted',
        source_module: 'bank',
        source_document_id: data.id,
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jeError) {
      console.error('Failed to create journal entry:', jeError);
      // Don't fail the transaction, just log the error
      return NextResponse.json({ 
        data,
        warning: 'Bank transaction created but journal entry failed' 
      }, { status: 201 });
    }

    // Create journal lines
    const journalLines = isDeposit
      ? [
          // Debit Bank Account
          {
            journal_entry_id: journalEntry.id,
            account_id: bankAccount.gl_account_id,
            debit: transactionAmount,
            credit: 0,
            description: `${body.description}`,
            created_by: user.id,
          },
          // Credit Income/Other Account
          {
            journal_entry_id: journalEntry.id,
            account_id: contraAccountId,
            debit: 0,
            credit: transactionAmount,
            description: `${body.description}`,
            created_by: user.id,
          },
        ]
      : [
          // Debit Expense/Other Account
          {
            journal_entry_id: journalEntry.id,
            account_id: contraAccountId,
            debit: transactionAmount,
            credit: 0,
            description: `${body.description}`,
            created_by: user.id,
          },
          // Credit Bank Account
          {
            journal_entry_id: journalEntry.id,
            account_id: bankAccount.gl_account_id,
            debit: 0,
            credit: transactionAmount,
            description: `${body.description}`,
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
        warning: 'Bank transaction created but journal lines failed' 
      }, { status: 201 });
    }

    return NextResponse.json({ 
      data,
      journal_entry: journalEntry 
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
