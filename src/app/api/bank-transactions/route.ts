import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bank-transactions - Create a bank transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.bank_account_id || !body.transaction_date || !body.amount || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: bank_account_id, transaction_date, amount, description' },
        { status: 400 }
      );
    }

    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the bank account to retrieve its GL account
    const bankAccounts = await sql`
      SELECT gl_account_id, name, currency FROM bank_accounts WHERE id = ${body.bank_account_id}
    `;

    if (bankAccounts.length === 0) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const bankAccount = bankAccounts[0];

    if (!bankAccount.gl_account_id) {
      return NextResponse.json({
        error: 'Bank account is not linked to a GL account. Please update the bank account settings.',
      }, { status: 400 });
    }

    // Create the bank transaction
    const txRows = await sql`
      INSERT INTO bank_transactions (
        bank_account_id, transaction_date, amount, description,
        reference_number, transaction_type, is_reconciled
      ) VALUES (
        ${body.bank_account_id},
        ${body.transaction_date},
        ${body.amount},
        ${body.description},
        ${body.reference_number || null},
        ${body.transaction_type || 'other'},
        false
      )
      RETURNING *
    `;

    const data = txRows[0];

    const isDeposit = body.amount > 0;
    const transactionAmount = Math.abs(body.amount);

    let contraAccountId = body.contra_account_id;

    if (!contraAccountId) {
      if (isDeposit) {
        const incomeAccounts = await sql`SELECT id FROM accounts WHERE code = '4500'`;
        contraAccountId = incomeAccounts[0]?.id;
      } else {
        const expenseAccounts = await sql`SELECT id FROM accounts WHERE code = '5300'`;
        contraAccountId = expenseAccounts[0]?.id;
      }
    }

    if (!contraAccountId) {
      console.warn('No contra account found for bank transaction, journal entry not created');
      return NextResponse.json({ data }, { status: 201 });
    }

    // Generate journal entry number
    const year = new Date(body.transaction_date).getFullYear();
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
          entry_number, entry_date, description, reference,
          status, source_module, source_document_id, created_by, posted_by, posted_at
        ) VALUES (
          ${entryNumber},
          ${body.transaction_date},
          ${`Bank ${isDeposit ? 'deposit' : 'withdrawal'}: ${body.description}`},
          ${body.reference_number || data.id},
          'posted',
          'bank',
          ${data.id},
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
        warning: 'Bank transaction created but journal entry failed',
      }, { status: 201 });
    }

    // Create journal lines
    const journalLines = isDeposit
      ? [
          { account_id: bankAccount.gl_account_id, debit: transactionAmount, credit: 0 },
          { account_id: contraAccountId, debit: 0, credit: transactionAmount },
        ]
      : [
          { account_id: contraAccountId, debit: transactionAmount, credit: 0 },
          { account_id: bankAccount.gl_account_id, debit: 0, credit: transactionAmount },
        ];

    try {
      for (const line of journalLines) {
        await sql`
          INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, description, created_by)
          VALUES (${journalEntry.id}, ${line.account_id}, ${line.debit}, ${line.credit}, ${body.description}, ${user.id})
        `;
      }
    } catch (jlError) {
      console.error('Failed to create journal lines:', jlError);
      return NextResponse.json({
        data,
        warning: 'Bank transaction created but journal lines failed',
      }, { status: 201 });
    }

    return NextResponse.json({
      data,
      journal_entry: journalEntry,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
