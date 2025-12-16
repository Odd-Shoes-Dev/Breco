// =====================================================
// Invoice Posting Logic
// Breco Safaris Ltd Financial System
// =====================================================

import { supabase } from '@/lib/supabase/client';
import { createJournalEntry, postJournalEntry } from './general-ledger';
import type { Invoice, InvoiceWithLines } from '@/types/database';
import Decimal from 'decimal.js';

const DEFAULT_AR_ACCOUNT_CODE = '1200'; // Accounts Receivable
const DEFAULT_SALES_TAX_ACCOUNT_CODE = '2200'; // Sales Tax Payable
const DEFAULT_REVENUE_ACCOUNT_CODE = '4100'; // Sales Revenue

interface PostInvoiceResult {
  invoice: Invoice;
  journalEntryId: string;
}

/**
 * Generates the next invoice number
 */
export async function generateInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_invoice_number');
  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`);
  return data;
}

/**
 * Calculates invoice totals from lines
 */
export function calculateInvoiceTotals(
  lines: {
    quantity: number;
    unit_price: number;
    discount_percent?: number;
    tax_rate?: number;
  }[],
  taxRate: number = 0.0625 // MA sales tax default
): {
  subtotal: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  total: Decimal;
  lineTotals: {
    lineTotal: Decimal;
    discountAmount: Decimal;
    taxAmount: Decimal;
  }[];
} {
  const lineTotals = lines.map((line) => {
    const lineSubtotal = new Decimal(line.quantity).times(line.unit_price);
    const discountAmount = lineSubtotal.times(line.discount_percent || 0).div(100);
    const afterDiscount = lineSubtotal.minus(discountAmount);
    const lineTaxRate = line.tax_rate !== undefined ? line.tax_rate : taxRate;
    const taxAmount = afterDiscount.times(lineTaxRate);
    const lineTotal = afterDiscount.plus(taxAmount);

    return {
      lineTotal: afterDiscount, // Line total before tax
      discountAmount,
      taxAmount,
    };
  });

  const subtotal = lineTotals.reduce(
    (sum, lt) => sum.plus(lt.lineTotal),
    new Decimal(0)
  );
  const discountAmount = lineTotals.reduce(
    (sum, lt) => sum.plus(lt.discountAmount),
    new Decimal(0)
  );
  const taxAmount = lineTotals.reduce(
    (sum, lt) => sum.plus(lt.taxAmount),
    new Decimal(0)
  );
  const total = subtotal.plus(taxAmount);

  return { subtotal, discountAmount, taxAmount, total, lineTotals };
}

/**
 * Creates an invoice (draft status)
 */
export async function createInvoice(
  input: {
    customer_id: string;
    invoice_date: string;
    due_date: string;
    payment_terms?: number;
    po_number?: string;
    notes?: string;
    lines: {
      product_id?: string;
      description: string;
      quantity: number;
      unit_price: number;
      discount_percent?: number;
      tax_rate?: number;
      revenue_account_id?: string;
    }[];
  },
  userId: string,
  taxRate: number = 0.0625
): Promise<InvoiceWithLines> {
  const invoiceNumber = await generateInvoiceNumber();

  // Calculate totals
  const totals = calculateInvoiceTotals(input.lines, taxRate);

  // Get default AR account
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', DEFAULT_AR_ACCOUNT_CODE)
    .single();

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      customer_id: input.customer_id,
      invoice_date: input.invoice_date,
      due_date: input.due_date,
      payment_terms: input.payment_terms || 30,
      po_number: input.po_number,
      notes: input.notes,
      subtotal: totals.subtotal.toNumber(),
      tax_amount: totals.taxAmount.toNumber(),
      discount_amount: totals.discountAmount.toNumber(),
      total: totals.total.toNumber(),
      amount_paid: 0,
      status: 'draft',
      ar_account_id: arAccount?.id,
      created_by: userId,
    })
    .select()
    .single();

  if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

  // Create invoice lines
  const invoiceLines = input.lines.map((line, index) => {
    const lineTotals = totals.lineTotals[index];
    return {
      invoice_id: invoice.id,
      line_number: index + 1,
      product_id: line.product_id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_percent: line.discount_percent || 0,
      discount_amount: lineTotals.discountAmount.toNumber(),
      tax_rate: line.tax_rate !== undefined ? line.tax_rate : taxRate,
      tax_amount: lineTotals.taxAmount.toNumber(),
      line_total: lineTotals.lineTotal.toNumber(),
      revenue_account_id: line.revenue_account_id,
    };
  });

  const { data: lines, error: linesError } = await supabase
    .from('invoice_lines')
    .insert(invoiceLines)
    .select();

  if (linesError) throw new Error(`Failed to create invoice lines: ${linesError.message}`);

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'create',
    entity_type: 'invoice',
    entity_id: invoice.id,
    new_values: { invoice_number: invoiceNumber, total: totals.total.toNumber() },
  });

  return { ...invoice, lines };
}

/**
 * Posts an invoice to the general ledger
 * Creates journal entry: DR AR, CR Revenue, CR Sales Tax
 */
export async function postInvoice(
  invoiceId: string,
  userId: string
): Promise<PostInvoiceResult> {
  // Get invoice with lines
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('*, invoice_lines(*)')
    .eq('id', invoiceId)
    .single();

  if (fetchError) throw new Error(`Invoice not found: ${fetchError.message}`);
  if (invoice.status !== 'draft') {
    throw new Error(`Cannot post invoice with status: ${invoice.status}`);
  }

  // Get customer for journal entry description
  const { data: customer } = await supabase
    .from('customers')
    .select('name')
    .eq('id', invoice.customer_id)
    .single();

  // Get account IDs
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', DEFAULT_AR_ACCOUNT_CODE)
    .single();

  const { data: taxAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', DEFAULT_SALES_TAX_ACCOUNT_CODE)
    .single();

  const { data: defaultRevenueAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', DEFAULT_REVENUE_ACCOUNT_CODE)
    .single();

  // Build journal entry lines
  const journalLines: {
    account_id: string;
    description: string;
    debit: number;
    credit: number;
    customer_id: string;
  }[] = [];

  // Debit AR for total
  journalLines.push({
    account_id: arAccount!.id,
    description: `Invoice ${invoice.invoice_number}`,
    debit: invoice.total,
    credit: 0,
    customer_id: invoice.customer_id,
  });

  // Credit Revenue for each line (grouped by account)
  const revenueByAccount = new Map<string, number>();
  for (const line of invoice.invoice_lines) {
    const accountId = line.revenue_account_id || defaultRevenueAccount!.id;
    const current = revenueByAccount.get(accountId) || 0;
    revenueByAccount.set(accountId, current + line.line_total);
  }

  revenueByAccount.forEach((amount, accountId) => {
    journalLines.push({
      account_id: accountId,
      description: `Invoice ${invoice.invoice_number} - Revenue`,
      debit: 0,
      credit: amount,
      customer_id: invoice.customer_id,
    });
  });

  // Credit Sales Tax if applicable
  if (invoice.tax_amount > 0) {
    journalLines.push({
      account_id: taxAccount!.id,
      description: `Invoice ${invoice.invoice_number} - Sales Tax`,
      debit: 0,
      credit: invoice.tax_amount,
      customer_id: invoice.customer_id,
    });
  }

  // Create and post journal entry
  const journalEntry = await createJournalEntry(
    {
      entry_date: invoice.invoice_date,
      description: `Invoice ${invoice.invoice_number} - ${customer?.name}`,
      source_module: 'sales',
      source_document_id: invoiceId,
      lines: journalLines,
    },
    userId
  );

  await postJournalEntry(journalEntry.id, userId);

  // Update invoice status
  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'sent',
      journal_entry_id: journalEntry.id,
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) throw new Error(`Failed to update invoice: ${updateError.message}`);

  // Update inventory if products are inventory items
  for (const line of invoice.invoice_lines) {
    if (line.product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('track_inventory, quantity_on_hand')
        .eq('id', line.product_id)
        .single();

      if (product?.track_inventory) {
        // Reduce inventory
        await supabase
          .from('products')
          .update({
            quantity_on_hand: product.quantity_on_hand - line.quantity,
          })
          .eq('id', line.product_id);

        // Record movement
        await supabase.from('inventory_movements').insert({
          product_id: line.product_id,
          movement_type: 'sale',
          quantity: -line.quantity,
          reference_type: 'invoice',
          reference_id: invoiceId,
          created_by: userId,
        });
      }
    }
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'post',
    entity_type: 'invoice',
    entity_id: invoiceId,
    new_values: { status: 'sent', journal_entry_id: journalEntry.id },
  });

  return { invoice: updatedInvoice, journalEntryId: journalEntry.id };
}

/**
 * Records a payment received against invoices
 */
export async function recordPaymentReceived(
  input: {
    customer_id: string;
    payment_date: string;
    amount: number;
    payment_method: string;
    reference_number?: string;
    deposit_to_account_id: string;
    notes?: string;
    applications: {
      invoice_id: string;
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

  // Get AR account
  const { data: arAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('code', DEFAULT_AR_ACCOUNT_CODE)
    .single();

  // Create journal entry: DR Cash/Bank, CR AR
  const journalEntry = await createJournalEntry(
    {
      entry_date: input.payment_date,
      description: `Payment received - ${paymentNumber}`,
      source_module: 'payments',
      lines: [
        {
          account_id: input.deposit_to_account_id,
          description: `Payment ${paymentNumber}`,
          debit: input.amount,
          credit: 0,
          customer_id: input.customer_id,
        },
        {
          account_id: arAccount!.id,
          description: `Payment ${paymentNumber}`,
          debit: 0,
          credit: input.amount,
          customer_id: input.customer_id,
        },
      ],
    },
    userId
  );

  await postJournalEntry(journalEntry.id, userId);

  // Create payment record
  const { data: payment, error: paymentError } = await supabase
    .from('payments_received')
    .insert({
      payment_number: paymentNumber,
      customer_id: input.customer_id,
      payment_date: input.payment_date,
      amount: input.amount,
      payment_method: input.payment_method,
      reference_number: input.reference_number,
      deposit_to_account_id: input.deposit_to_account_id,
      journal_entry_id: journalEntry.id,
      notes: input.notes,
      created_by: userId,
    })
    .select()
    .single();

  if (paymentError) throw new Error(`Failed to create payment: ${paymentError.message}`);

  // Create payment applications and update invoices
  for (const app of input.applications) {
    await supabase.from('payment_applications').insert({
      payment_id: payment.id,
      invoice_id: app.invoice_id,
      amount_applied: app.amount_applied,
    });

    // Update invoice amount_paid and status
    const { data: invoice } = await supabase
      .from('invoices')
      .select('amount_paid, total')
      .eq('id', app.invoice_id)
      .single();

    const newAmountPaid = (invoice?.amount_paid || 0) + app.amount_applied;
    const newStatus =
      newAmountPaid >= (invoice?.total || 0) ? 'paid' : 'partial';

    await supabase
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
      })
      .eq('id', app.invoice_id);
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'create',
    entity_type: 'payment_received',
    entity_id: payment.id,
    new_values: { payment_number: paymentNumber, amount: input.amount },
  });

  return { paymentId: payment.id, journalEntryId: journalEntry.id };
}

/**
 * Checks and updates overdue invoice statuses
 */
export async function updateOverdueInvoices(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { data: overdueInvoices, error } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .in('status', ['sent', 'partial'])
    .lt('due_date', today)
    .select('id');

  if (error) throw new Error(`Failed to update overdue invoices: ${error.message}`);

  return overdueInvoices?.length || 0;
}
