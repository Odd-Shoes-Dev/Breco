// =====================================================
// Invoice Posting Logic
// Breco Safaris Ltd Financial System
// =====================================================

import { sql } from '@/lib/db';
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
  const rows = await sql`SELECT generate_invoice_number() AS num`;
  if (!rows[0]?.num) throw new Error('Failed to generate invoice number');
  return rows[0].num;
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
  taxRate: number = 0
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
  taxRate: number = 0
): Promise<InvoiceWithLines> {
  const invoiceNumber = await generateInvoiceNumber();

  // Calculate totals
  const totals = calculateInvoiceTotals(input.lines, taxRate);

  // Get default AR account
  const arRows = await sql`SELECT id FROM accounts WHERE code = ${DEFAULT_AR_ACCOUNT_CODE} LIMIT 1`;
  const arAccountId = arRows[0]?.id || null;

  // Create invoice
  const invoiceRows = await sql`
    INSERT INTO invoices (
      invoice_number, customer_id, invoice_date, due_date, payment_terms,
      po_number, notes, subtotal, tax_amount, discount_amount, total,
      amount_paid, status, ar_account_id, created_by
    ) VALUES (
      ${invoiceNumber}, ${input.customer_id}, ${input.invoice_date}, ${input.due_date},
      ${input.payment_terms || 30}, ${input.po_number ?? null}, ${input.notes ?? null},
      ${totals.subtotal.toNumber()}, ${totals.taxAmount.toNumber()},
      ${totals.discountAmount.toNumber()}, ${totals.total.toNumber()},
      0, 'draft', ${arAccountId}, ${userId}
    )
    RETURNING *
  `;
  const invoice = invoiceRows[0];
  if (!invoice) throw new Error('Failed to create invoice');

  // Create invoice lines
  const lines: any[] = [];
  for (let index = 0; index < input.lines.length; index++) {
    const line = input.lines[index];
    const lineTotals = totals.lineTotals[index];
    const lineRows = await sql`
      INSERT INTO invoice_lines (
        invoice_id, line_number, product_id, description, quantity,
        unit_price, discount_percent, discount_amount, tax_rate, tax_amount,
        line_total, revenue_account_id
      ) VALUES (
        ${invoice.id}, ${index + 1}, ${line.product_id ?? null}, ${line.description},
        ${line.quantity}, ${line.unit_price}, ${line.discount_percent || 0},
        ${lineTotals.discountAmount.toNumber()},
        ${line.tax_rate !== undefined ? line.tax_rate : taxRate},
        ${lineTotals.taxAmount.toNumber()}, ${lineTotals.lineTotal.toNumber()},
        ${line.revenue_account_id ?? null}
      )
      RETURNING *
    `;
    lines.push(lineRows[0]);
  }

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'create', 'invoice', ${invoice.id},
      ${JSON.stringify({ invoice_number: invoiceNumber, total: totals.total.toNumber() })}
    )
  `;

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
  const invoiceRows = await sql`
    SELECT i.*, json_agg(il.*) AS invoice_lines
    FROM invoices i
    LEFT JOIN invoice_lines il ON il.invoice_id = i.id
    WHERE i.id = ${invoiceId}
    GROUP BY i.id
  `;
  const invoice = invoiceRows[0];
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status !== 'draft') {
    throw new Error(`Cannot post invoice with status: ${invoice.status}`);
  }

  // Get customer for journal entry description
  const customerRows = await sql`SELECT name FROM customers WHERE id = ${invoice.customer_id} LIMIT 1`;
  const customer = customerRows[0];

  // Get account IDs
  const arRows = await sql`SELECT id FROM accounts WHERE code = ${DEFAULT_AR_ACCOUNT_CODE} LIMIT 1`;
  const arAccount = arRows[0];

  const taxRows = await sql`SELECT id FROM accounts WHERE code = ${DEFAULT_SALES_TAX_ACCOUNT_CODE} LIMIT 1`;
  const taxAccount = taxRows[0];

  const revRows = await sql`SELECT id FROM accounts WHERE code = ${DEFAULT_REVENUE_ACCOUNT_CODE} LIMIT 1`;
  const defaultRevenueAccount = revRows[0];

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
  const invoiceLines = invoice.invoice_lines || [];
  const revenueByAccount = new Map<string, number>();
  for (const line of invoiceLines) {
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
  const updatedRows = await sql`
    UPDATE invoices
    SET status = 'sent', journal_entry_id = ${journalEntry.id}
    WHERE id = ${invoiceId}
    RETURNING *
  `;
  const updatedInvoice = updatedRows[0];
  if (!updatedInvoice) throw new Error('Failed to update invoice');

  // Update inventory if products are inventory items
  for (const line of invoiceLines) {
    if (line.product_id) {
      const productRows = await sql`
        SELECT track_inventory, quantity_on_hand FROM products WHERE id = ${line.product_id} LIMIT 1
      `;
      const product = productRows[0];

      if (product?.track_inventory) {
        // Reduce inventory
        await sql`
          UPDATE products
          SET quantity_on_hand = ${product.quantity_on_hand - line.quantity}
          WHERE id = ${line.product_id}
        `;

        // Record movement
        await sql`
          INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, created_by)
          VALUES (${line.product_id}, 'sale', ${-line.quantity}, 'invoice', ${invoiceId}, ${userId})
        `;
      }
    }
  }

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'post', 'invoice', ${invoiceId},
      ${JSON.stringify({ status: 'sent', journal_entry_id: journalEntry.id })}
    )
  `;

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
  const numRows = await sql`SELECT generate_payment_number() AS num`;
  const paymentNumber = numRows[0]?.num;

  // Get AR account
  const arRows = await sql`SELECT id FROM accounts WHERE code = ${DEFAULT_AR_ACCOUNT_CODE} LIMIT 1`;
  const arAccount = arRows[0];

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
  const paymentRows = await sql`
    INSERT INTO payments_received (
      payment_number, customer_id, payment_date, amount, payment_method,
      reference_number, deposit_to_account_id, journal_entry_id, notes, created_by
    ) VALUES (
      ${paymentNumber}, ${input.customer_id}, ${input.payment_date}, ${input.amount},
      ${input.payment_method}, ${input.reference_number ?? null}, ${input.deposit_to_account_id},
      ${journalEntry.id}, ${input.notes ?? null}, ${userId}
    )
    RETURNING *
  `;
  const payment = paymentRows[0];
  if (!payment) throw new Error('Failed to create payment');

  // Create payment applications and update invoices
  for (const app of input.applications) {
    await sql`
      INSERT INTO payment_applications (payment_id, invoice_id, amount_applied)
      VALUES (${payment.id}, ${app.invoice_id}, ${app.amount_applied})
    `;

    // Update invoice amount_paid and status
    const invoiceRows = await sql`
      SELECT amount_paid, total FROM invoices WHERE id = ${app.invoice_id} LIMIT 1
    `;
    const invoice = invoiceRows[0];

    const newAmountPaid = (invoice?.amount_paid || 0) + app.amount_applied;
    const newStatus =
      newAmountPaid >= (invoice?.total || 0) ? 'paid' : 'partial';

    await sql`
      UPDATE invoices SET amount_paid = ${newAmountPaid}, status = ${newStatus}
      WHERE id = ${app.invoice_id}
    `;
  }

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'create', 'payment_received', ${payment.id},
      ${JSON.stringify({ payment_number: paymentNumber, amount: input.amount })}
    )
  `;

  return { paymentId: payment.id, journalEntryId: journalEntry.id };
}

/**
 * Checks and updates overdue invoice statuses
 */
export async function updateOverdueInvoices(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const rows = await sql`
    UPDATE invoices
    SET status = 'overdue'
    WHERE status IN ('sent', 'partial')
      AND due_date < ${today}
    RETURNING id
  `;

  return rows.length;
}
