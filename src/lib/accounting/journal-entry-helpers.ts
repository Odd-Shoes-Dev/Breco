/**
 * Helper functions for creating automatic journal entries
 * Implements double-entry bookkeeping for transactions
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface JournalLineInput {
  account_id: string;
  debit: number;
  credit: number;
  description: string;
}

interface CreateJournalEntryParams {
  supabase: SupabaseClient;
  entry_date: string;
  description: string;
  reference?: string; // This will be incorporated into description/memo
  source_module: string;
  lines: JournalLineInput[];
  created_by: string;
  status?: 'draft' | 'posted';
  source_document_id?: string;
}

/**
 * Create a journal entry with lines
 */
export async function createJournalEntry({
  supabase,
  entry_date,
  description,
  reference,
  source_module,
  lines,
  created_by,
  status = 'posted',
  source_document_id,
}: CreateJournalEntryParams) {
  try {
    // Validate that debits equal credits
    const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error(
        `Journal entry not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`
      );
    }

    // Generate journal entry number
    const { data: entryNumber, error: numError } = await supabase.rpc(
      'generate_journal_entry_number'
    );

    if (numError) throw numError;

    // Combine description and reference for display
    const fullDescription = reference ? `${description} - Ref: ${reference}` : description;

    // Create journal entry
    const { data: journalEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        entry_number: entryNumber,
        entry_date,
        description: fullDescription,
        source_module: source_module,
        source_document_id,
        status,
        created_by,
      })
      .select()
      .single();

    if (entryError) throw entryError;

    // Create journal lines
    const journalLines = lines.map((line, index) => ({
      journal_entry_id: journalEntry.id,
      line_number: index + 1,
      account_id: line.account_id,
      debit: line.debit,
      credit: line.credit,
      description: line.description,
    }));

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(journalLines);

    if (linesError) {
      // Rollback journal entry if lines fail
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      throw linesError;
    }

    return { success: true, journalEntry };
  } catch (error) {
    console.error('Error creating journal entry:', error);
    return { success: false, error };
  }
}

/**
 * Get account ID by account code
 */
export async function getAccountByCode(
  supabase: SupabaseClient,
  code: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', code)
    .single();

  if (error || !data) {
    console.error(`Account with code ${code} not found:`, error);
    return null;
  }

  return data.id;
}

/**
 * Create journal entry for invoice (when posted)
 * Debit: Accounts Receivable (1200)
 * Credit: Revenue (4000)
 */
export async function createInvoiceJournalEntry(
  supabase: SupabaseClient,
  invoice: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    total: number;
    customer_id: string;
  },
  created_by: string
) {
  const arAccountId = await getAccountByCode(supabase, '1200'); // Accounts Receivable
  const revenueAccountId = await getAccountByCode(supabase, '4000'); // Sales Revenue

  if (!arAccountId || !revenueAccountId) {
    throw new Error('Required accounts not found for invoice journal entry');
  }

  return createJournalEntry({
    supabase,
    entry_date: invoice.invoice_date,
    description: `Invoice ${invoice.invoice_number}`,
    source_module: 'invoice',
    source_document_id: invoice.id,
    lines: [
      {
        account_id: arAccountId,
        debit: invoice.total,
        credit: 0,
        description: `AR - Invoice ${invoice.invoice_number}`,
      },
      {
        account_id: revenueAccountId,
        debit: 0,
        credit: invoice.total,
        description: `Revenue - Invoice ${invoice.invoice_number}`,
      },
    ],
    created_by,
    status: 'posted',
  });
}

/**
 * Create journal entry for bill
 * Debit: Expense Account (from bill lines)
 * Credit: Accounts Payable (2000)
 */
export async function createBillJournalEntry(
  supabase: SupabaseClient,
  bill: {
    id: string;
    bill_number: string;
    bill_date: string;
    total: number;
  },
  billLines: Array<{ account_code: string; amount: number; description: string }>,
  created_by: string
) {
  const apAccountId = await getAccountByCode(supabase, '2000'); // Accounts Payable

  if (!apAccountId) {
    throw new Error('Accounts Payable account not found');
  }

  // Build debit lines from bill lines
  const debitLines = await Promise.all(
    billLines.map(async (line) => {
      const accountId = await getAccountByCode(supabase, line.account_code);
      if (!accountId) {
        throw new Error(`Account ${line.account_code} not found`);
      }
      return {
        account_id: accountId,
        debit: line.amount,
        credit: 0,
        description: line.description,
      };
    })
  );

  // Add credit line for AP
  const lines = [
    ...debitLines,
    {
      account_id: apAccountId,
      debit: 0,
      credit: bill.total,
      description: `AP - Bill ${bill.bill_number}`,
    },
  ];

  return createJournalEntry({
    supabase,
    entry_date: bill.bill_date,
    description: `Bill ${bill.bill_number}`,
    source_module: 'bill',
    source_document_id: bill.id,
    lines,
    created_by,
    status: 'posted',
  });
}

/**
 * Create journal entry for receipt
 * Debit: Cash/Bank Account
 * Credit: Accounts Receivable (1200)
 */
export async function createReceiptJournalEntry(
  supabase: SupabaseClient,
  receipt: {
    id: string;
    receipt_number: string;
    receipt_date: string;
    total: number;
    payment_method: string;
  },
  created_by: string
) {
  const arAccountId = await getAccountByCode(supabase, '1200'); // Accounts Receivable
  
  // Determine cash account based on payment method
  let cashAccountCode = '1000'; // Default to Cash
  if (receipt.payment_method === 'bank_transfer' || receipt.payment_method === 'check') {
    cashAccountCode = '1010'; // Bank Account
  }
  
  const cashAccountId = await getAccountByCode(supabase, cashAccountCode);

  if (!arAccountId || !cashAccountId) {
    throw new Error('Required accounts not found for receipt journal entry');
  }

  return createJournalEntry({
    supabase,
    entry_date: receipt.receipt_date,
    description: `Receipt ${receipt.receipt_number}`,
    source_module: 'receipt',
    source_document_id: receipt.id,
    lines: [
      {
        account_id: cashAccountId,
        debit: receipt.total,
        credit: 0,
        description: `Cash received - Receipt ${receipt.receipt_number}`,
      },
      {
        account_id: arAccountId,
        debit: 0,
        credit: receipt.total,
        description: `AR payment - Receipt ${receipt.receipt_number}`,
      },
    ],
    created_by,
    status: 'posted',
  });
}

/**
 * Create journal entry for expense
 * Debit: Expense Account
 * Credit: Cash/Bank Account
 */
export async function createExpenseJournalEntry(
  supabase: SupabaseClient,
  expense: {
    id: string;
    expense_number: string;
    expense_date: string;
    amount: number;
    account_code: string;
    description: string;
    bank_account_id?: string;
  },
  created_by: string
) {
  const expenseAccountId = await getAccountByCode(supabase, expense.account_code);
  
  // Get the cash/bank account
  let cashAccountId: string | null = null;
  
  if (expense.bank_account_id) {
    // Get the GL account linked to the bank account
    const { data: bankAccount } = await supabase
      .from('bank_accounts')
      .select('gl_account_id')
      .eq('id', expense.bank_account_id)
      .single();
    
    if (bankAccount?.gl_account_id) {
      cashAccountId = bankAccount.gl_account_id;
    }
  }
  
  // Fallback to default cash account
  if (!cashAccountId) {
    cashAccountId = await getAccountByCode(supabase, '1000');
  }

  if (!expenseAccountId || !cashAccountId) {
    throw new Error('Required accounts not found for expense journal entry');
  }

  return createJournalEntry({
    supabase,
    entry_date: expense.expense_date,
    description: `Expense: ${expense.description}`,
    source_module: 'expense',
    source_document_id: expense.id,
    lines: [
      {
        account_id: expenseAccountId,
        debit: expense.amount,
        credit: 0,
        description: expense.description,
      },
      {
        account_id: cashAccountId,
        debit: 0,
        credit: expense.amount,
        description: `Payment - ${expense.description}`,
      },
    ],
    created_by,
    status: 'posted',
  });
}
