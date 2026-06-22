import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { increaseInventoryForBill } from '@/lib/accounting/inventory-server';
import { createBillJournalEntry } from '@/lib/accounting/journal-entry-helpers';

// GET /api/bills/[id] - Get single bill
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const rows = await sql`
      SELECT
        b.*,
        json_build_object(
          'id', v.id, 'name', v.name, 'company_name', v.company_name,
          'email', v.email, 'phone', v.phone, 'address_line1', v.address_line1,
          'address_line2', v.address_line2, 'city', v.city, 'state', v.state,
          'zip_code', v.zip_code, 'country', v.country
        ) AS vendors
      FROM bills b
      LEFT JOIN vendors v ON v.id = b.vendor_id
      WHERE b.id = ${params.id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bills/[id] - Update bill
export async function PATCH(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const body = await request.json();

    // Get existing bill with lines
    const existingRows = await sql`
      SELECT b.*, json_agg(bl.*) AS bill_lines
      FROM bills b
      LEFT JOIN bill_lines bl ON bl.bill_id = b.id
      WHERE b.id = ${params.id}
      GROUP BY b.id
    `;

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const existing = existingRows[0];
    existing.bill_lines = existing.bill_lines?.filter((l: any) => l !== null) || [];
    const oldStatus = existing.status;

    // Prevent editing paid/void bills
    if (['paid', 'void'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Cannot edit paid or voided bills' },
        { status: 400 }
      );
    }

    // Get current user for journal entries
    const user = await getSession();

    // Get account IDs from codes if needed
    const lines = body.line_items || body.lines || [];
    const accountCodes = lines.map((line: any) => line.account_code).filter((code: any) => code);
    let accountMap: Record<string, string> = {};
    if (accountCodes.length > 0) {
      const accounts = await sql`SELECT id, code FROM accounts WHERE code = ANY(${accountCodes})`;
      if (accounts) {
        accountMap = Object.fromEntries(accounts.map((acc: any) => [acc.code, acc.id]));
      }
    }

    // Calculate new totals
    let subtotal = 0;
    let taxAmount = 0;

    lines.forEach((line: any) => {
      const unitCost = line.unit_cost || line.unit_price || 0;
      const lineSubtotal = line.quantity * unitCost;
      const lineTax = lineSubtotal * (line.tax_rate || 0);
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    });

    const total = subtotal + taxAmount;

    // Build update fields
    const updateFields: Record<string, any> = { subtotal, tax_amount: taxAmount, total };
    const allowedFields = ['vendor_id', 'bill_date', 'due_date', 'vendor_invoice_number', 'notes', 'status'];
    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    });

    const billRows = await sql`
      UPDATE bills
      SET
        subtotal = ${updateFields.subtotal},
        tax_amount = ${updateFields.tax_amount},
        total = ${updateFields.total},
        vendor_id = COALESCE(${updateFields.vendor_id ?? null}, vendor_id),
        bill_date = COALESCE(${updateFields.bill_date ?? null}, bill_date),
        due_date = COALESCE(${updateFields.due_date ?? null}, due_date),
        vendor_invoice_number = COALESCE(${updateFields.vendor_invoice_number ?? null}, vendor_invoice_number),
        notes = COALESCE(${updateFields.notes ?? null}, notes),
        status = COALESCE(${updateFields.status ?? null}, status)
      WHERE id = ${params.id}
      RETURNING *
    `;

    const bill = billRows[0];
    const newStatus = bill.status;

    // Handle inventory when bill is approved/posted
    if ((newStatus === 'approved' || newStatus === 'posted') && oldStatus === 'draft' && user) {
      const billLinesToProcess = lines.length > 0 ? lines : existing.bill_lines;

      const inventoryResult = await increaseInventoryForBill(
        null as any,
        bill.id,
        bill.bill_date,
        billLinesToProcess.map((line: any) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          unit_cost: line.unit_cost || line.unit_price || 0,
          line_total: line.line_total || line.quantity * (line.unit_cost || line.unit_price || 0),
          description: line.description,
        })),
        user.id
      );

      if (!inventoryResult.success) {
        console.error('Failed to update inventory for bill:', inventoryResult.error);
      }
    }

    // Create journal entry when bill is marked as 'approved' or 'posted'
    if (
      (newStatus === 'approved' || newStatus === 'posted') &&
      oldStatus !== 'approved' &&
      oldStatus !== 'posted' &&
      !bill.journal_entry_id &&
      user
    ) {
      const billLines = await sql`
        SELECT bl.*, a.code AS account_code
        FROM bill_lines bl
        LEFT JOIN accounts a ON a.id = bl.expense_account_id
        WHERE bl.bill_id = ${params.id}
      `;

      if (billLines && billLines.length > 0) {
        let billTotalFromLines = 0;
        billLines.forEach((line: any) => {
          billTotalFromLines += parseFloat(line.line_total || 0) + parseFloat(line.tax_amount || 0);
        });

        const journalBillLines = billLines.map((line: any) => ({
          account_code: line.account_code || '5000',
          amount: parseFloat(line.line_total || 0) + parseFloat(line.tax_amount || 0),
          description: line.description,
        }));

        const journalResult = await createBillJournalEntry(
          null as any,
          { id: bill.id, bill_number: bill.bill_number, bill_date: bill.bill_date, total: billTotalFromLines },
          journalBillLines,
          user.id
        );

        if (!journalResult.success) {
          console.error('Failed to create journal entry for bill:', journalResult.error);
          return NextResponse.json(
            { error: `Bill updated but journal entry failed: ${journalResult.error}` },
            { status: 500 }
          );
        }

        if (journalResult.journalEntry) {
          await sql`UPDATE bills SET journal_entry_id = ${journalResult.journalEntry.id} WHERE id = ${params.id}`;
        }
      }
    }

    // If lines are provided, update them
    if (lines.length > 0) {
      // Delete existing lines
      await sql`DELETE FROM bill_lines WHERE bill_id = ${params.id}`;

      // Create new lines
      const billLines = lines
        .filter((line: any) => {
          const unitCost = line.unit_cost || line.unit_price || 0;
          const hasDescription = line.description && line.description.trim();
          return hasDescription && line.quantity * unitCost > 0;
        })
        .map((line: any, index: number) => {
          const unitCost = line.unit_cost || line.unit_price || 0;
          const expenseAccountId = line.expense_account_id || (line.account_code ? accountMap[line.account_code] : null);
          return {
            bill_id: bill.id,
            line_number: index + 1,
            expense_account_id: expenseAccountId,
            product_id: line.product_id || null,
            project_id: line.project_id || null,
            department: line.department || null,
            description: line.description || '',
            quantity: line.quantity,
            unit_cost: unitCost,
            tax_rate: line.tax_rate || 0,
            tax_amount: line.quantity * unitCost * (line.tax_rate || 0),
            line_total: line.quantity * unitCost,
          };
        });

      if (billLines.length > 0) {
        for (const line of billLines) {
          await sql`
            INSERT INTO bill_lines (
              bill_id, line_number, expense_account_id, product_id, project_id,
              department, description, quantity, unit_cost, tax_rate, tax_amount, line_total
            ) VALUES (
              ${line.bill_id}, ${line.line_number}, ${line.expense_account_id},
              ${line.product_id}, ${line.project_id}, ${line.department},
              ${line.description}, ${line.quantity}, ${line.unit_cost},
              ${line.tax_rate}, ${line.tax_amount}, ${line.line_total}
            )
          `;
        }
      }
    }

    return NextResponse.json({ data: bill });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bills/[id] - Delete or void bill
export async function DELETE(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'void';

    // Get existing bill
    const existingRows = await sql`SELECT status, amount_paid FROM bills WHERE id = ${params.id}`;

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const existing = existingRows[0];

    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Bill is already voided' }, { status: 400 });
    }

    if (action === 'delete') {
      // Only allow delete for drafts with no payments
      if (existing.status !== 'draft' || existing.amount_paid > 0) {
        return NextResponse.json(
          { error: 'Can only delete draft bills with no payments' },
          { status: 400 }
        );
      }

      // Delete lines first
      await sql`DELETE FROM bill_lines WHERE bill_id = ${params.id}`;

      // Delete bill
      await sql`DELETE FROM bills WHERE id = ${params.id}`;

      return NextResponse.json({ message: 'Bill deleted' });
    } else {
      // Void the bill
      const rows = await sql`
        UPDATE bills SET status = 'void' WHERE id = ${params.id} RETURNING *
      `;

      return NextResponse.json({ data: rows[0] });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
