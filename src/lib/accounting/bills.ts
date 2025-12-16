// =====================================================
// Bill & AP Posting Logic
// Breco Safaris Ltd Financial System
// =====================================================

import { supabase } from '@/lib/supabase/client';
import { createJournalEntry, postJournalEntry } from './general-ledger';
import type { Bill, BillWithLines } from '@/types/database';
import Decimal from 'decimal.js';

const DEFAULT_AP_ACCOUNT_CODE = '2000'; // Accounts Payable

interface PostBillResult {
  bill: Bill;
  journalEntryId: string;
}

/**
 * Generates the next bill number
 */
export async function generateBillNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_bill_number');
  if (error) throw new Error(`Failed to generate bill number: ${error.message}`);
  return data;
}

/**
 * Calculates bill totals from lines
 */
export function calculateBillTotals(
  lines: {
    quantity: number;
    unit_cost: number;
    tax_rate?: number;
  }[]
): {
  subtotal: Decimal;
  taxAmount: Decimal;
  total: Decimal;
  lineTotals: { lineTotal: Decimal; taxAmount: Decimal }[];
} {
  const lineTotals = lines.map((line) => {
    const lineSubtotal = new Decimal(line.quantity).times(line.unit_cost);
    const taxAmount = lineSubtotal.times(line.tax_rate || 0);
    return {
      lineTotal: lineSubtotal,
      taxAmount,
    };
  });

  const subtotal = lineTotals.reduce(
    (sum, lt) => sum.plus(lt.lineTotal),
    new Decimal(0)
  );
  const taxAmount = lineTotals.reduce(
    (sum, lt) => sum.plus(lt.taxAmount),
    new Decimal(0)
  );
  const total = subtotal.plus(taxAmount);

  return { subtotal, taxAmount, total, lineTotals };
}

/**
 * Creates a bill (draft status)
 */
export async function createBill(
  input: {
    vendor_id: string;
    vendor_invoice_number?: string;
    bill_date: string;
    due_date: string;
    payment_terms?: number;
    notes?: string;
    lines: {
      description: string;
      quantity: number;
      unit_cost: number;
      expense_account_id: string;
      product_id?: string;
      tax_rate?: number;
      project_id?: string;
      department?: string;
    }[];
  },
  userId: string
): Promise<BillWithLines> {
  const billNumber = await generateBillNumber();

  // Calculate totals
  const totals = calculateBillTotals(input.lines);

  // Get default AP account
  const { data: apAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', DEFAULT_AP_ACCOUNT_CODE)
    .single();

  // Create bill
  const { data: bill, error: billError } = await supabase
    .from('bills')
    .insert({
      bill_number: billNumber,
      vendor_id: input.vendor_id,
      vendor_invoice_number: input.vendor_invoice_number,
      bill_date: input.bill_date,
      due_date: input.due_date,
      payment_terms: input.payment_terms || 30,
      notes: input.notes,
      subtotal: totals.subtotal.toNumber(),
      tax_amount: totals.taxAmount.toNumber(),
      total: totals.total.toNumber(),
      amount_paid: 0,
      status: 'draft',
      ap_account_id: apAccount?.id,
      created_by: userId,
    })
    .select()
    .single();

  if (billError) throw new Error(`Failed to create bill: ${billError.message}`);

  // Create bill lines
  const billLines = input.lines.map((line, index) => {
    const lineTotals = totals.lineTotals[index];
    return {
      bill_id: bill.id,
      line_number: index + 1,
      description: line.description,
      quantity: line.quantity,
      unit_cost: line.unit_cost,
      tax_rate: line.tax_rate || 0,
      tax_amount: lineTotals.taxAmount.toNumber(),
      line_total: lineTotals.lineTotal.toNumber(),
      expense_account_id: line.expense_account_id,
      product_id: line.product_id,
      project_id: line.project_id,
      department: line.department,
    };
  });

  const { data: lines, error: linesError } = await supabase
    .from('bill_lines')
    .insert(billLines)
    .select();

  if (linesError) throw new Error(`Failed to create bill lines: ${linesError.message}`);

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'create',
    entity_type: 'bill',
    entity_id: bill.id,
    new_values: { bill_number: billNumber, total: totals.total.toNumber() },
  });

  return { ...bill, lines };
}

/**
 * Posts a bill to the general ledger
 * Creates journal entry: DR Expense/Asset, CR AP
 */
export async function postBill(
  billId: string,
  userId: string
): Promise<PostBillResult> {
  // Get bill with lines
  const { data: bill, error: fetchError } = await supabase
    .from('bills')
    .select('*, bill_lines(*)')
    .eq('id', billId)
    .single();

  if (fetchError) throw new Error(`Bill not found: ${fetchError.message}`);
  if (bill.status !== 'draft' && bill.status !== 'approved') {
    throw new Error(`Cannot post bill with status: ${bill.status}`);
  }

  // Get vendor for journal entry description
  const { data: vendor } = await supabase
    .from('vendors')
    .select('name')
    .eq('id', bill.vendor_id)
    .single();

  // Get AP account
  const { data: apAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', DEFAULT_AP_ACCOUNT_CODE)
    .single();

  // Build journal entry lines
  const journalLines: {
    account_id: string;
    description: string;
    debit: number;
    credit: number;
    vendor_id: string;
    project_id?: string;
    department?: string;
  }[] = [];

  // Debit Expense/Asset accounts for each line
  for (const line of bill.bill_lines) {
    journalLines.push({
      account_id: line.expense_account_id,
      description: `Bill ${bill.bill_number} - ${line.description}`,
      debit: line.line_total + line.tax_amount,
      credit: 0,
      vendor_id: bill.vendor_id,
      project_id: line.project_id,
      department: line.department,
    });

    // If this is an inventory purchase, update inventory
    if (line.product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('track_inventory, quantity_on_hand, cost_price')
        .eq('id', line.product_id)
        .single();

      if (product?.track_inventory) {
        // Update product quantity and weighted average cost
        const newQty = product.quantity_on_hand + line.quantity;
        const newCost =
          (product.quantity_on_hand * product.cost_price +
            line.quantity * line.unit_cost) /
          newQty;

        await supabase
          .from('products')
          .update({
            quantity_on_hand: newQty,
            cost_price: newCost,
          })
          .eq('id', line.product_id);

        // Record inventory movement
        await supabase.from('inventory_movements').insert({
          product_id: line.product_id,
          movement_type: 'purchase',
          quantity: line.quantity,
          unit_cost: line.unit_cost,
          total_cost: line.line_total,
          reference_type: 'bill',
          reference_id: billId,
          created_by: userId,
        });

        // Create inventory lot for FIFO tracking
        await supabase.from('inventory_lots').insert({
          product_id: line.product_id,
          quantity_received: line.quantity,
          quantity_remaining: line.quantity,
          unit_cost: line.unit_cost,
          received_date: bill.bill_date,
        });
      }
    }
  }

  // Credit AP for total
  journalLines.push({
    account_id: apAccount!.id,
    description: `Bill ${bill.bill_number}`,
    debit: 0,
    credit: bill.total,
    vendor_id: bill.vendor_id,
  });

  // Create and post journal entry
  const journalEntry = await createJournalEntry(
    {
      entry_date: bill.bill_date,
      description: `Bill ${bill.bill_number} - ${vendor?.name}`,
      source_module: 'purchases',
      source_document_id: billId,
      lines: journalLines,
    },
    userId
  );

  await postJournalEntry(journalEntry.id, userId);

  // Update bill status
  const { data: updatedBill, error: updateError } = await supabase
    .from('bills')
    .update({
      status: 'approved',
      journal_entry_id: journalEntry.id,
    })
    .eq('id', billId)
    .select()
    .single();

  if (updateError) throw new Error(`Failed to update bill: ${updateError.message}`);

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'post',
    entity_type: 'bill',
    entity_id: billId,
    new_values: { status: 'approved', journal_entry_id: journalEntry.id },
  });

  return { bill: updatedBill, journalEntryId: journalEntry.id };
}

/**
 * Records a bill payment
 */
export async function recordBillPayment(
  input: {
    vendor_id: string;
    payment_date: string;
    amount: number;
    payment_method: string;
    reference_number?: string;
    pay_from_account_id: string;
    notes?: string;
    applications: {
      bill_id: string;
      amount_applied: number;
    }[];
  },
  userId: string
): Promise<{ paymentId: string; journalEntryId: string }> {
  // Validate total applications equals payment amount
  const totalApplied = input.applications.reduce(
    (sum, app) => sum + app.amount_applied,
    0
  );
  if (Math.abs(totalApplied - input.amount) > 0.01) {
    throw new Error('Payment applications must equal payment amount');
  }

  // Generate payment number
  const { data: paymentNumber } = await supabase.rpc('generate_payment_number');

  // Get AP account
  const { data: apAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', DEFAULT_AP_ACCOUNT_CODE)
    .single();

  // Create journal entry: DR AP, CR Cash/Bank
  const journalEntry = await createJournalEntry(
    {
      entry_date: input.payment_date,
      description: `Bill payment - ${paymentNumber}`,
      source_module: 'bill_payments',
      lines: [
        {
          account_id: apAccount!.id,
          description: `Payment ${paymentNumber}`,
          debit: input.amount,
          credit: 0,
          vendor_id: input.vendor_id,
        },
        {
          account_id: input.pay_from_account_id,
          description: `Payment ${paymentNumber}`,
          debit: 0,
          credit: input.amount,
          vendor_id: input.vendor_id,
        },
      ],
    },
    userId
  );

  await postJournalEntry(journalEntry.id, userId);

  // Create payment record
  const { data: payment, error: paymentError } = await supabase
    .from('bill_payments')
    .insert({
      payment_number: paymentNumber,
      vendor_id: input.vendor_id,
      payment_date: input.payment_date,
      amount: input.amount,
      payment_method: input.payment_method,
      reference_number: input.reference_number,
      pay_from_account_id: input.pay_from_account_id,
      journal_entry_id: journalEntry.id,
      notes: input.notes,
      created_by: userId,
    })
    .select()
    .single();

  if (paymentError) throw new Error(`Failed to create bill payment: ${paymentError.message}`);

  // Create payment applications and update bills
  for (const app of input.applications) {
    await supabase.from('bill_payment_applications').insert({
      bill_payment_id: payment.id,
      bill_id: app.bill_id,
      amount_applied: app.amount_applied,
    });

    // Update bill amount_paid and status
    const { data: bill } = await supabase
      .from('bills')
      .select('amount_paid, total')
      .eq('id', app.bill_id)
      .single();

    const newAmountPaid = (bill?.amount_paid || 0) + app.amount_applied;
    const newStatus = newAmountPaid >= (bill?.total || 0) ? 'paid' : 'partial';

    await supabase
      .from('bills')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
      })
      .eq('id', app.bill_id);
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'create',
    entity_type: 'bill_payment',
    entity_id: payment.id,
    new_values: { payment_number: paymentNumber, amount: input.amount },
  });

  return { paymentId: payment.id, journalEntryId: journalEntry.id };
}

/**
 * Checks and updates overdue bill statuses
 */
export async function updateOverdueBills(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { data: overdueBills, error } = await supabase
    .from('bills')
    .update({ status: 'overdue' })
    .in('status', ['approved', 'partial'])
    .lt('due_date', today)
    .select('id');

  if (error) throw new Error(`Failed to update overdue bills: ${error.message}`);

  return overdueBills?.length || 0;
}
