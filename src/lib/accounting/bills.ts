// =====================================================
// Bill & AP Posting Logic
// Breco Safaris Ltd Financial System
// =====================================================

import { sql } from '@/lib/db';
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
  const rows = await sql`SELECT generate_bill_number() AS num`;
  if (!rows[0]?.num) throw new Error('Failed to generate bill number');
  return rows[0].num;
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
  const apRows = await sql`SELECT id FROM accounts WHERE code = ${DEFAULT_AP_ACCOUNT_CODE} LIMIT 1`;
  const apAccountId = apRows[0]?.id || null;

  // Create bill
  const billRows = await sql`
    INSERT INTO bills (
      bill_number, vendor_id, vendor_invoice_number, bill_date, due_date,
      payment_terms, notes, subtotal, tax_amount, total, amount_paid,
      status, ap_account_id, created_by
    ) VALUES (
      ${billNumber}, ${input.vendor_id}, ${input.vendor_invoice_number ?? null},
      ${input.bill_date}, ${input.due_date}, ${input.payment_terms || 30},
      ${input.notes ?? null}, ${totals.subtotal.toNumber()}, ${totals.taxAmount.toNumber()},
      ${totals.total.toNumber()}, 0, 'draft', ${apAccountId}, ${userId}
    )
    RETURNING *
  `;
  const bill = billRows[0];
  if (!bill) throw new Error('Failed to create bill');

  // Create bill lines
  const lines: any[] = [];
  for (let index = 0; index < input.lines.length; index++) {
    const line = input.lines[index];
    const lineTotals = totals.lineTotals[index];
    const lineRows = await sql`
      INSERT INTO bill_lines (
        bill_id, line_number, description, quantity, unit_cost, tax_rate,
        tax_amount, line_total, expense_account_id, product_id, project_id, department
      ) VALUES (
        ${bill.id}, ${index + 1}, ${line.description}, ${line.quantity},
        ${line.unit_cost}, ${line.tax_rate || 0}, ${lineTotals.taxAmount.toNumber()},
        ${lineTotals.lineTotal.toNumber()}, ${line.expense_account_id},
        ${line.product_id ?? null}, ${line.project_id ?? null}, ${line.department ?? null}
      )
      RETURNING *
    `;
    lines.push(lineRows[0]);
  }

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'create', 'bill', ${bill.id},
      ${JSON.stringify({ bill_number: billNumber, total: totals.total.toNumber() })}
    )
  `;

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
  const billRows = await sql`
    SELECT b.*, json_agg(bl.*) AS bill_lines
    FROM bills b
    LEFT JOIN bill_lines bl ON bl.bill_id = b.id
    WHERE b.id = ${billId}
    GROUP BY b.id
  `;
  const bill = billRows[0];
  if (!bill) throw new Error('Bill not found');
  if (bill.status !== 'draft' && bill.status !== 'approved') {
    throw new Error(`Cannot post bill with status: ${bill.status}`);
  }

  // Get vendor for journal entry description
  const vendorRows = await sql`SELECT name FROM vendors WHERE id = ${bill.vendor_id} LIMIT 1`;
  const vendor = vendorRows[0];

  // Get AP account
  const apRows = await sql`SELECT id FROM accounts WHERE code = ${DEFAULT_AP_ACCOUNT_CODE} LIMIT 1`;
  const apAccount = apRows[0];

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

  const billLines = bill.bill_lines || [];

  // Debit Expense/Asset accounts for each line
  for (const line of billLines) {
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
      const productRows = await sql`
        SELECT track_inventory, quantity_on_hand, cost_price
        FROM products WHERE id = ${line.product_id} LIMIT 1
      `;
      const product = productRows[0];

      if (product?.track_inventory) {
        // Update product quantity and weighted average cost
        const newQty = product.quantity_on_hand + line.quantity;
        const newCost =
          (product.quantity_on_hand * product.cost_price +
            line.quantity * line.unit_cost) /
          newQty;

        await sql`
          UPDATE products SET quantity_on_hand = ${newQty}, cost_price = ${newCost}
          WHERE id = ${line.product_id}
        `;

        // Record inventory movement
        await sql`
          INSERT INTO inventory_movements (
            product_id, movement_type, quantity, unit_cost, total_cost,
            reference_type, reference_id, created_by
          ) VALUES (
            ${line.product_id}, 'purchase', ${line.quantity}, ${line.unit_cost},
            ${line.line_total}, 'bill', ${billId}, ${userId}
          )
        `;

        // Create inventory lot for FIFO tracking
        await sql`
          INSERT INTO inventory_lots (product_id, quantity_received, quantity_remaining, unit_cost, received_date)
          VALUES (${line.product_id}, ${line.quantity}, ${line.quantity}, ${line.unit_cost}, ${bill.bill_date})
        `;
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
  const updatedRows = await sql`
    UPDATE bills SET status = 'approved', journal_entry_id = ${journalEntry.id}
    WHERE id = ${billId}
    RETURNING *
  `;
  const updatedBill = updatedRows[0];
  if (!updatedBill) throw new Error('Failed to update bill');

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'post', 'bill', ${billId},
      ${JSON.stringify({ status: 'approved', journal_entry_id: journalEntry.id })}
    )
  `;

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
  const numRows = await sql`SELECT generate_payment_number() AS num`;
  const paymentNumber = numRows[0]?.num;

  // Get AP account
  const apRows = await sql`SELECT id FROM accounts WHERE code = ${DEFAULT_AP_ACCOUNT_CODE} LIMIT 1`;
  const apAccount = apRows[0];

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
  const paymentRows = await sql`
    INSERT INTO bill_payments (
      payment_number, vendor_id, payment_date, amount, payment_method,
      reference_number, pay_from_account_id, journal_entry_id, notes, created_by
    ) VALUES (
      ${paymentNumber}, ${input.vendor_id}, ${input.payment_date}, ${input.amount},
      ${input.payment_method}, ${input.reference_number ?? null}, ${input.pay_from_account_id},
      ${journalEntry.id}, ${input.notes ?? null}, ${userId}
    )
    RETURNING *
  `;
  const payment = paymentRows[0];
  if (!payment) throw new Error('Failed to create bill payment');

  // Create payment applications and update bills
  for (const app of input.applications) {
    await sql`
      INSERT INTO bill_payment_applications (bill_payment_id, bill_id, amount_applied)
      VALUES (${payment.id}, ${app.bill_id}, ${app.amount_applied})
    `;

    // Update bill amount_paid and status
    const billRows = await sql`
      SELECT amount_paid, total FROM bills WHERE id = ${app.bill_id} LIMIT 1
    `;
    const bill = billRows[0];

    const newAmountPaid = (bill?.amount_paid || 0) + app.amount_applied;
    const newStatus = newAmountPaid >= (bill?.total || 0) ? 'paid' : 'partial';

    await sql`
      UPDATE bills SET amount_paid = ${newAmountPaid}, status = ${newStatus}
      WHERE id = ${app.bill_id}
    `;
  }

  // Log activity
  await sql`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (
      ${userId}, 'create', 'bill_payment', ${payment.id},
      ${JSON.stringify({ payment_number: paymentNumber, amount: input.amount })}
    )
  `;

  return { paymentId: payment.id, journalEntryId: journalEntry.id };
}

/**
 * Checks and updates overdue bill statuses
 */
export async function updateOverdueBills(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const rows = await sql`
    UPDATE bills
    SET status = 'overdue'
    WHERE status IN ('approved', 'partial')
      AND due_date < ${today}
    RETURNING id
  `;

  return rows.length;
}
