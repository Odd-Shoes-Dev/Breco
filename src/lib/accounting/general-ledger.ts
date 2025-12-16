// =====================================================
// General Ledger & Posting Logic
// Breco Safaris Ltd Financial System
// =====================================================

import { supabase } from '@/lib/supabase/client';
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
  source_module?: string;
  source_document_id?: string;
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
  const { data, error } = await supabase.rpc('generate_journal_number');
  if (error) throw new Error(`Failed to generate journal number: ${error.message}`);
  return data;
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
  const { data: period } = await supabase
    .from('fiscal_periods')
    .select('id')
    .eq('level', 'monthly')
    .lte('start_date', input.entry_date)
    .gte('end_date', input.entry_date)
    .single();

  // Create journal entry
  const { data: entry, error: entryError } = await supabase
    .from('journal_entries')
    .insert({
      entry_number: entryNumber,
      entry_date: input.entry_date,
      period_id: period?.id,
      description: input.description,
      memo: input.memo,
      source_module: input.source_module || 'manual',
      source_document_id: input.source_document_id,
      is_adjusting: input.is_adjusting || false,
      is_closing: input.is_closing || false,
      status: 'draft',
      created_by: userId,
    })
    .select()
    .single();

  if (entryError) throw new Error(`Failed to create journal entry: ${entryError.message}`);

  // Create journal lines
  const linesWithEntry = input.lines.map((line, index) => ({
    journal_entry_id: entry.id,
    line_number: index + 1,
    account_id: line.account_id,
    description: line.description,
    debit: line.debit || 0,
    credit: line.credit || 0,
    currency: line.currency || 'USD',
    exchange_rate: line.exchange_rate || 1,
    base_debit: new Decimal(line.debit || 0)
      .times(line.exchange_rate || 1)
      .toNumber(),
    base_credit: new Decimal(line.credit || 0)
      .times(line.exchange_rate || 1)
      .toNumber(),
    customer_id: line.customer_id,
    vendor_id: line.vendor_id,
    project_id: line.project_id,
    department: line.department,
  }));

  const { data: lines, error: linesError } = await supabase
    .from('journal_lines')
    .insert(linesWithEntry)
    .select();

  if (linesError) throw new Error(`Failed to create journal lines: ${linesError.message}`);

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'create',
    entity_type: 'journal_entry',
    entity_id: entry.id,
    new_values: { entry_number: entryNumber, lines_count: lines.length },
  });

  return { ...entry, lines };
}

/**
 * Posts a journal entry (changes status from draft to posted)
 */
export async function postJournalEntry(
  entryId: string,
  userId: string
): Promise<JournalEntry> {
  // Get the entry
  const { data: entry, error: fetchError } = await supabase
    .from('journal_entries')
    .select('*, fiscal_periods!inner(status)')
    .eq('id', entryId)
    .single();

  if (fetchError) throw new Error(`Journal entry not found: ${fetchError.message}`);
  if (entry.status !== 'draft') {
    throw new Error(`Cannot post entry with status: ${entry.status}`);
  }
  if (entry.fiscal_periods?.status === 'closed') {
    throw new Error('Cannot post to a closed period');
  }

  // Validate lines balance
  const { data: lines } = await supabase
    .from('journal_lines')
    .select('*')
    .eq('journal_entry_id', entryId);

  const balance = validateJournalBalance(lines || []);
  if (!balance.valid) {
    throw new Error('Journal entry does not balance');
  }

  // Update status to posted
  const { data: posted, error: postError } = await supabase
    .from('journal_entries')
    .update({
      status: 'posted',
      posted_by: userId,
      posted_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .select()
    .single();

  if (postError) throw new Error(`Failed to post journal entry: ${postError.message}`);

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'post',
    entity_type: 'journal_entry',
    entity_id: entryId,
    old_values: { status: 'draft' },
    new_values: { status: 'posted' },
  });

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
  const { data: entry, error: fetchError } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (fetchError) throw new Error(`Journal entry not found: ${fetchError.message}`);
  if (entry.status === 'void') {
    throw new Error('Entry is already void');
  }

  const { data: voided, error: voidError } = await supabase
    .from('journal_entries')
    .update({
      status: 'void',
      memo: `${entry.memo || ''}\n[VOIDED: ${reason}]`,
    })
    .eq('id', entryId)
    .select()
    .single();

  if (voidError) throw new Error(`Failed to void journal entry: ${voidError.message}`);

  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'void',
    entity_type: 'journal_entry',
    entity_id: entryId,
    old_values: { status: entry.status },
    new_values: { status: 'void', reason },
  });

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
  const { data: original, error: fetchError } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (fetchError) throw new Error(`Journal entry not found: ${fetchError.message}`);
  if (original.status !== 'posted') {
    throw new Error('Can only reverse posted entries');
  }

  const { data: originalLines } = await supabase
    .from('journal_lines')
    .select('*')
    .eq('journal_entry_id', entryId);

  // Create reversal with swapped debits/credits
  const reversalLines: JournalLineInput[] = (originalLines || []).map((line) => ({
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
      source_module: 'reversal',
      source_document_id: entryId,
      is_reversing: true,
      lines: reversalLines,
    },
    userId
  );

  // Update original entry to reference reversal
  await supabase
    .from('journal_entries')
    .update({ reversed_entry_id: reversal.id })
    .eq('id', entryId);

  return reversal;
}

/**
 * Gets account balance as of a specific date
 */
export async function getAccountBalance(
  accountId: string,
  asOfDate: string
): Promise<Decimal> {
  const { data: lines, error } = await supabase
    .from('journal_lines')
    .select('base_debit, base_credit, journal_entries!inner(entry_date, status)')
    .eq('account_id', accountId)
    .eq('journal_entries.status', 'posted')
    .lte('journal_entries.entry_date', asOfDate);

  if (error) throw new Error(`Failed to get account balance: ${error.message}`);

  // Get account to determine normal balance
  const { data: account } = await supabase
    .from('accounts')
    .select('normal_balance, account_type')
    .eq('id', accountId)
    .single();

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
  const { data: lines, error } = await supabase
    .from('journal_lines')
    .select('base_debit, base_credit, journal_entries!inner(entry_date, status)')
    .eq('account_id', accountId)
    .eq('journal_entries.status', 'posted')
    .gte('journal_entries.entry_date', startDate)
    .lte('journal_entries.entry_date', endDate);

  if (error) throw new Error(`Failed to get account balance: ${error.message}`);

  const { data: account } = await supabase
    .from('accounts')
    .select('normal_balance')
    .eq('id', accountId)
    .single();

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
  const { data: children } = await supabase
    .from('fiscal_periods')
    .select('id, status')
    .eq('parent_period_id', periodId);

  const openChildren = (children || []).filter((c) => c.status !== 'closed');
  if (openChildren.length > 0) {
    throw new Error('Cannot close period with open child periods');
  }

  // Check for unposted entries in the period
  const { data: period } = await supabase
    .from('fiscal_periods')
    .select('*')
    .eq('id', periodId)
    .single();

  const { data: unposted } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('period_id', periodId)
    .eq('status', 'draft');

  if ((unposted || []).length > 0) {
    throw new Error(`Cannot close period with ${unposted?.length} unposted entries`);
  }

  // Close the period
  await supabase
    .from('fiscal_periods')
    .update({
      status: 'closed',
      closed_by: userId,
      closed_at: new Date().toISOString(),
    })
    .eq('id', periodId);

  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'close',
    entity_type: 'fiscal_period',
    entity_id: periodId,
    new_values: { status: 'closed', period_name: period?.name },
  });
}
