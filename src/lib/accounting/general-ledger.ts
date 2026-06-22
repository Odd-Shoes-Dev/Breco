// =====================================================
// General Ledger & Posting Logic
// Breco Safaris Ltd Financial System
// =====================================================

import { sql } from '@/lib/db';
import type {
  JournalEntry,
  JournalLine,
  JournalEntryWithLines,
  Account,
} from '@/types/database';
import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface JournalLineInput {
  account_id: string;
  description?: string;
  debit: number;
  credit: number;
  currency?: string;
  exchange_rate?: number;
  customer_id?: string;
  vendor_id?: string;
  project_id?: string;
  department?: string;
}

export interface CreateJournalEntryInput {
  entry_date: string;
  description: string;
  memo?: string;
  reference_type?: string;
  reference_id?: string;
  is_adjusting?: boolean;
  is_closing?: boolean;
  is_reversing?: boolean;
  lines: JournalLineInput[];
}

/**
 * Validates that a journal entry balances (debits = credits)
 */
export function validateJournalBalance(lines: JournalLineInput[]): {
  valid: boolean;
  totalDebits: Decimal;
  totalCredits: Decimal;
  difference: Decimal;
} {
  const totalDebits = lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.debit || 0)),
    new Decimal(0)
  );
  const totalCredits = lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.credit || 0)),
    new Decimal(0)
  );
  const difference = totalDebits.minus(totalCredits).abs();

  return {
    valid: difference.lessThanOrEqualTo(new Decimal(0.01)),
    totalDebits,
    totalCredits,
    difference,
  };
}

/**
 * Generates the next journal entry number
 */
export async function generateJournalNumber(): Promise<string> {
  const rows = await sql`SELECT generate_journal_number() AS num`;
  if (!rows[0]?.num) throw new Error('Failed to generate journal number');
  return rows[0].num;
}

/**
 * Creates a journal entry with lines (draft status)
 */
export async function createJournalEntry(
  input: CreateJournalEntryInput,
  userId: string
): Promise<JournalEntryWithLines> {
  // Validate balance
  const balance = validateJournalBalance(input.lines);
  if (!balance.valid) {
    throw new Error(
      `Journal entry does not balance. Debits: ${balance.totalDebits}, Credits: ${balance.totalCredits}`
    );
  }

  // Generate entry number
  const entryNumber = await generateJournalNumber();

  // Get period for the entry date
  const periodRows = await sql`
    SELECT id FROM fiscal_periods
    WHERE level = 'monthly'
      AND start_date <= ${input.entry_date}
      AND end_date >= ${input.entry_date}
    LIMIT 1
  `;
  const period = periodRows[0];

  // Create journal entry
  const entryRows = await sql`
    INSERT INTO journal_entries (
      entry_number, entry_date, period_id, description,
      reference_type, reference_id, is_adjusting, is_closing,
      status, created_by
    ) VALUES (
      ${entryNumber}, ${input.entry_date}, ${period?.id ?? null},
      ${input.description},
      ${input.reference_type || 'manual'}, ${input.reference_id ?? null},
      ${input.is_adjusting || false}, ${input.is_closing || false},
      'draft', ${userId}
    )
    RETURNING *
  `;
  const entry = entryRows[0];
  if (!entry) throw new Error('Failed to create journal entry');

  // Create journal lines
  const lines: any[] = [];
  for (let index = 0; index < input.lines.length; index++) {
    const line = input.lines[index];
    const lineRows = await sql`
      INSERT INTO journal_lines (
        journal_entry_id, line_number, account_id, description,
        debit, credit, currency, exchange_rate, base_debit, base_credit,
        customer_id, vendor_id, project_id, department
      ) VALUES (
        ${entry.id}, ${index + 1}, ${line.account_id}, ${line.description ?? null},
        ${line.debit || 0}, ${line.credit || 0},
        ${line.currency || 'USD'}, ${line.exchange_rate || 1},
        ${new Decimal(line.debit || 0).times(line.exchange_rate || 1).toNumber()},
        ${new Decimal(line.credit || 0).times(line.exchange_rate || 1).toNumber()},
        ${line.customer_id ?? null}, ${line.vendor_id ?? null},
        ${line.project_id ?? null}, ${line.department ?? null}
      )
      RETURNING *
    `;
    lines.push(lineRows[0]);
  }

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'create', 'journal_entry', ${entry.id},
      ${JSON.stringify({ entry_number: entryNumber, lines_count: lines.length })}
    )
  `;

  return { ...entry, lines };
}

/**
 * Posts a journal entry (changes status from draft to posted)
 */
export async function postJournalEntry(
  entryId: string,
  userId: string
): Promise<JournalEntry> {
  // Get the entry with period status
  const entryRows = await sql`
    SELECT je.*, fp.status AS period_status
    FROM journal_entries je
    LEFT JOIN fiscal_periods fp ON fp.id = je.period_id
    WHERE je.id = ${entryId}
    LIMIT 1
  `;
  const entry = entryRows[0];

  if (!entry) throw new Error('Journal entry not found');
  if (entry.status !== 'draft') {
    throw new Error(`Cannot post entry with status: ${entry.status}`);
  }
  if (entry.period_status === 'closed') {
    throw new Error('Cannot post to a closed period');
  }

  // Validate lines balance
  const linesRows = await sql`
    SELECT * FROM journal_lines WHERE journal_entry_id = ${entryId}
  `;

  const balance = validateJournalBalance(linesRows || []);
  if (!balance.valid) {
    throw new Error('Journal entry does not balance');
  }

  // Update status to posted
  const postedRows = await sql`
    UPDATE journal_entries
    SET status = 'posted', posted_by = ${userId}, posted_at = ${new Date().toISOString()}
    WHERE id = ${entryId}
    RETURNING *
  `;
  const posted = postedRows[0];
  if (!posted) throw new Error('Failed to post journal entry');

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (
      ${userId}, 'post', 'journal_entry', ${entryId},
      ${JSON.stringify({ status: 'draft' })},
      ${JSON.stringify({ status: 'posted' })}
    )
  `;

  return posted;
}

/**
 * Voids a posted journal entry
 */
export async function voidJournalEntry(
  entryId: string,
  userId: string,
  reason: string
): Promise<JournalEntry> {
  const entryRows = await sql`SELECT * FROM journal_entries WHERE id = ${entryId} LIMIT 1`;
  const entry = entryRows[0];

  if (!entry) throw new Error('Journal entry not found');
  if (entry.status === 'void') {
    throw new Error('Entry is already void');
  }

  const voidedRows = await sql`
    UPDATE journal_entries
    SET status = 'void', description = ${`${entry.description || ''}\n[VOIDED: ${reason}]`}
    WHERE id = ${entryId}
    RETURNING *
  `;
  const voided = voidedRows[0];
  if (!voided) throw new Error('Failed to void journal entry');

  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (
      ${userId}, 'void', 'journal_entry', ${entryId},
      ${JSON.stringify({ status: entry.status })},
      ${JSON.stringify({ status: 'void', reason })}
    )
  `;

  return voided;
}

/**
 * Creates a reversing entry for a posted journal entry
 */
export async function reverseJournalEntry(
  entryId: string,
  reversalDate: string,
  userId: string
): Promise<JournalEntryWithLines> {
  // Get original entry and lines
  const entryRows = await sql`SELECT * FROM journal_entries WHERE id = ${entryId} LIMIT 1`;
  const original = entryRows[0];

  if (!original) throw new Error('Journal entry not found');
  if (original.status !== 'posted') {
    throw new Error('Can only reverse posted entries');
  }

  const originalLines = await sql`
    SELECT * FROM journal_lines WHERE journal_entry_id = ${entryId}
  `;

  // Create reversal with swapped debits/credits
  const reversalLines: JournalLineInput[] = (originalLines || []).map((line: any) => ({
    account_id: line.account_id,
    description: `Reversal: ${line.description || ''}`,
    debit: line.credit, // Swap debit and credit
    credit: line.debit,
    currency: line.currency,
    exchange_rate: line.exchange_rate,
    customer_id: line.customer_id,
    vendor_id: line.vendor_id,
    project_id: line.project_id,
    department: line.department,
  }));

  const reversal = await createJournalEntry(
    {
      entry_date: reversalDate,
      description: `Reversal of ${original.entry_number}`,
      memo: `Reversing entry for ${original.entry_number}`,
      reference_type: 'reversal',
      reference_id: entryId,
      is_reversing: true,
      lines: reversalLines,
    },
    userId
  );

  // Update original entry to reference reversal
  await sql`
    UPDATE journal_entries SET reversed_entry_id = ${reversal.id} WHERE id = ${entryId}
  `;

  return reversal;
}

/**
 * Gets account balance as of a specific date
 */
export async function getAccountBalance(
  accountId: string,
  asOfDate: string
): Promise<Decimal> {
  const lines = await sql`
    SELECT jl.base_debit, jl.base_credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_id = ${accountId}
      AND je.status = 'posted'
      AND je.entry_date <= ${asOfDate}
  `;

  // Get account to determine normal balance
  const accountRows = await sql`
    SELECT normal_balance, account_type FROM accounts WHERE id = ${accountId} LIMIT 1
  `;
  const account = accountRows[0];

  let balance = new Decimal(0);
  for (const line of lines || []) {
    balance = balance.plus(line.base_debit || 0).minus(line.base_credit || 0);
  }

  // For credit-normal accounts (liabilities, equity, revenue), flip the sign
  if (account?.normal_balance === 'credit') {
    balance = balance.negated();
  }

  return balance;
}

/**
 * Gets account balances for a date range (for P&L accounts)
 */
export async function getAccountBalanceForPeriod(
  accountId: string,
  startDate: string,
  endDate: string
): Promise<Decimal> {
  const lines = await sql`
    SELECT jl.base_debit, jl.base_credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_id = ${accountId}
      AND je.status = 'posted'
      AND je.entry_date >= ${startDate}
      AND je.entry_date <= ${endDate}
  `;

  const accountRows = await sql`
    SELECT normal_balance FROM accounts WHERE id = ${accountId} LIMIT 1
  `;
  const account = accountRows[0];

  let balance = new Decimal(0);
  for (const line of lines || []) {
    balance = balance.plus(line.base_debit || 0).minus(line.base_credit || 0);
  }

  if (account?.normal_balance === 'credit') {
    balance = balance.negated();
  }

  return balance;
}

/**
 * Closes a fiscal period (locks it from further posting)
 */
export async function closePeriod(
  periodId: string,
  userId: string
): Promise<void> {
  // Check if all child periods are closed (for quarterly/annual)
  const children = await sql`
    SELECT id, status FROM fiscal_periods WHERE parent_period_id = ${periodId}
  `;

  const openChildren = (children || []).filter((c: any) => c.status !== 'closed');
  if (openChildren.length > 0) {
    throw new Error('Cannot close period with open child periods');
  }

  // Check for unposted entries in the period
  const periodRows = await sql`SELECT * FROM fiscal_periods WHERE id = ${periodId} LIMIT 1`;
  const period = periodRows[0];

  const unposted = await sql`
    SELECT id FROM journal_entries WHERE period_id = ${periodId} AND status = 'draft'
  `;

  if ((unposted || []).length > 0) {
    throw new Error(`Cannot close period with ${unposted?.length} unposted entries`);
  }

  // Close the period
  await sql`
    UPDATE fiscal_periods
    SET status = 'closed', locked_by = ${userId}, locked_at = ${new Date().toISOString()}
    WHERE id = ${periodId}
  `;

  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'close', 'fiscal_period', ${periodId},
      ${JSON.stringify({ status: 'closed', period_name: period?.name })}
    )
  `;
}
