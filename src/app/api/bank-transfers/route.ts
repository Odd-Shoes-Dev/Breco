import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-transfers - Create a bank transfer
export async function POST(request: NextRequest) {
  try {
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

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get account details
    const fromAccounts = await sql`
      SELECT account_name, gl_account_id, currency FROM bank_accounts WHERE id = ${body.from_account_id}
    `;
    const toAccounts = await sql`
      SELECT account_name, gl_account_id, currency FROM bank_accounts WHERE id = ${body.to_account_id}
    `;

    if (fromAccounts.length === 0 || toAccounts.length === 0) {
      return NextResponse.json({ error: 'One or both accounts not found' }, { status: 404 });
    }

    const fromAccount = fromAccounts[0];
    const toAccount = toAccounts[0];

    if (!fromAccount.gl_account_id || !toAccount.gl_account_id) {
      return NextResponse.json({
        error: 'Both bank accounts must be linked to GL accounts. Please update the bank account settings.',
      }, { status: 400 });
    }

    const reference_number = body.reference_number || `TRF-${Date.now().toString(36).toUpperCase()}`;

    // Create two bank transactions
    const tx1 = await sql`
      INSERT INTO bank_transactions (bank_account_id, transaction_date, amount, description, reference_number, transaction_type, is_reconciled)
      VALUES (${body.from_account_id}, ${body.transfer_date}, ${-Math.abs(body.amount)}, ${`Transfer to ${toAccount.account_name}`}, ${reference_number}, 'transfer_out', false)
      RETURNING *
    `;
    const tx2 = await sql`
      INSERT INTO bank_transactions (bank_account_id, transaction_date, amount, description, reference_number, transaction_type, is_reconciled)
      VALUES (${body.to_account_id}, ${body.transfer_date}, ${Math.abs(body.amount)}, ${`Transfer from ${fromAccount.account_name}`}, ${reference_number}, 'transfer_in', false)
      RETURNING *
    `;

    const data = [tx1[0], tx2[0]];
    const transferAmount = Math.abs(body.amount);

    // Generate journal entry number
    const year = new Date(body.transfer_date).getFullYear();
    const lastEntries = await sql`
      SELECT entry_number FROM journal_entries
      WHERE entry_number LIKE ${`JE-${year}-%`}
      ORDER BY entry_number DESC
      LIMIT 1
    `;

    let entryNumber;
    if (lastEntries.length > 0 && lastEntries[0].entry_number) {
      const lastNum = parseInt(lastEntries[0].entry_number.split('-')[2]);
      entryNumber = `JE-${year}-${String(lastNum + 1).padStart(4, '0')}`;
    } else {
      entryNumber = `JE-${year}-0001`;
    }

    // Create journal entry
    let journalEntry;
    try {
      const jeRows = await sql`
        INSERT INTO journal_entries (
          entry_number, entry_date, description,
          status, reference_type, reference_id, created_by, posted_by, posted_at
        ) VALUES (
          ${entryNumber},
          ${body.transfer_date},
          ${`Bank transfer: ${fromAccount.account_name} → ${toAccount.account_name}`},
          'posted',
          'bank',
          ${data[0]?.id},
          ${user.id},
          ${user.id},
          NOW()
        )
        RETURNING *
      `;
      journalEntry = jeRows[0];
    } catch (jeError) {
      console.error('Failed to create journal entry:', jeError);
      return NextResponse.json({
        data,
        message: 'Transfer completed successfully',
        warning: 'Journal entry creation failed',
      }, { status: 201 });
    }

    // Create journal lines
    try {
      await sql`
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (${journalEntry.id}, ${toAccount.gl_account_id}, ${transferAmount}, 0, ${`Transfer from ${fromAccount.account_name}`})
      `;
      await sql`
        INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description)
        VALUES (${journalEntry.id}, ${fromAccount.gl_account_id}, 0, ${transferAmount}, ${`Transfer to ${toAccount.account_name}`})
      `;
    } catch (jlError) {
      console.error('Failed to create journal lines:', jlError);
      return NextResponse.json({
        data,
        message: 'Transfer completed successfully',
        warning: 'Journal lines creation failed',
      }, { status: 201 });
    }

    return NextResponse.json({
      data,
      journal_entry: journalEntry,
      message: 'Transfer completed successfully',
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
