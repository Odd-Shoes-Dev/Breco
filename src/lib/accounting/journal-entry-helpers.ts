/**
 * Helper functions for creating automatic journal entries
 * Implements double-entry bookkeeping for transactions
 */

import { sql } from '@/lib/db';

interface JournalLineInput {
  account_id: string;
  debit: number;
  credit: number;
  description: string;
}

interface CreateJournalEntryParams {
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
    const numRows = await sql`SELECT generate_journal_entry_number() AS entry_number`;
    const entryNumber = numRows[0]?.entry_number;
    if (!entryNumber) throw new Error('Failed to generate journal entry number');

    // Combine description and reference for display
    const fullDescription = reference ? `${description} - Ref: ${reference}` : description;

    // Create journal entry
    const entryRows = await sql`
      INSERT INTO journal_entries (
        entry_number, entry_date, description, source_module,
        source_document_id, status, created_by
      ) VALUES (
        ${entryNumber}, ${entry_date}, ${fullDescription}, ${source_module},
        ${source_document_id ?? null}, ${status}, ${created_by}
      )
      RETURNING *
    `;
    const journalEntry = entryRows[0];
    if (!journalEntry) throw new Error('Failed to create journal entry');

    // Create journal lines
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      await sql`
        INSERT INTO journal_lines (
          journal_entry_id, line_number, account_id, debit, credit, description
        ) VALUES (
          ${journalEntry.id}, ${index + 1}, ${line.account_id},
          ${line.debit}, ${line.credit}, ${line.description}
        )
      `;
    }

    return { success: true, journalEntry };
  } catch (error) {
    console.error('Error creating journal entry:', error);
    // Attempt rollback if we have the entry
    return { success: false, error };
  }
}

/**
 * Get account ID by account code
 */
export async function getAccountByCode(
  code: string
): Promise<string | null> {
  try {
    const rows = await sql`SELECT id FROM accounts WHERE code = ${code} LIMIT 1`;
    if (!rows[0]) {
      console.error(`Account with code ${code} not found`);
      return null;
    }
    return rows[0].id;
  } catch (error) {
    console.error(`Account with code ${code} not found:`, error);
    return null;
  }
}

/**
 * Create journal entry for invoice (when posted)
 * Debit: Accounts Receivable (1200)
 * Credit: Revenue (4000)
 */
export async function createInvoiceJournalEntry(
  invoice: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    total: number;
    customer_id: string;
  },
  created_by: string
) {
  const arAccountId = await getAccountByCode('1200'); // Accounts Receivable
  const revenueAccountId = await getAccountByCode('4000'); // Sales Revenue

  if (!arAccountId || !revenueAccountId) {
    throw new Error('Required accounts not found for invoice journal entry');
  }

  return createJournalEntry({
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
  bill: {
    id: string;
    bill_number: string;
    bill_date: string;
    total: number;
  },
  billLines: Array<{ account_code: string; amount: number; description: string }>,
  created_by: string
) {
  const apAccountId = await getAccountByCode('2000'); // Accounts Payable

  if (!apAccountId) {
    throw new Error('Accounts Payable account not found');
  }

  // Build debit lines from bill lines
  const debitLines = await Promise.all(
    billLines.map(async (line) => {
      const accountId = await getAccountByCode(line.account_code);
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
  receipt: {
    id: string;
    receipt_number: string;
    receipt_date: string;
    total: number;
    payment_method: string;
  },
  created_by: string
) {
  const arAccountId = await getAccountByCode('1200'); // Accounts Receivable

  // Determine cash account based on payment method
  let cashAccountCode = '1000'; // Default to Cash
  if (receipt.payment_method === 'bank_transfer' || receipt.payment_method === 'check') {
    cashAccountCode = '1010'; // Bank Account
  }

  const cashAccountId = await getAccountByCode(cashAccountCode);

  if (!arAccountId || !cashAccountId) {
    throw new Error('Required accounts not found for receipt journal entry');
  }

  return createJournalEntry({
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
  const expenseAccountId = await getAccountByCode(expense.account_code);

  // Get the cash/bank account
  let cashAccountId: string | null = null;

  if (expense.bank_account_id) {
    // Get the GL account linked to the bank account
    const rows = await sql`
      SELECT gl_account_id FROM bank_accounts WHERE id = ${expense.bank_account_id} LIMIT 1
    `;
    if (rows[0]?.gl_account_id) {
      cashAccountId = rows[0].gl_account_id;
    }
  }

  // Fallback to default cash account
  if (!cashAccountId) {
    cashAccountId = await getAccountByCode('1000');
  }

  if (!expenseAccountId || !cashAccountId) {
    throw new Error('Required accounts not found for expense journal entry');
  }

  return createJournalEntry({
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
